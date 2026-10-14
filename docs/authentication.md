# Authentication Architecture — GardenPay

Stack: **Supabase Auth** (GoTrue) + Postgres RLS + React/TypeScript.
Roles in scope: **Administrator**, **Accountant**, **Viewer**.

> File note: saved as `docs/authentication.md` (corrected from the requested `authefication.m`).

---

## 1. Goals & principles

| # | Principle | Implication |
|---|-----------|-------------|
| P1 | **RLS is the source of authorization** | Client guards are UX only; every query is filtered/checked by Postgres policies |
| P2 | **DB-first roles, not JWT-first** | Role grants take effect on the *next query* — no token refresh needed to revoke access |
| P3 | **Invite-only membership** | No open self-registration; users are created by an Administrator |
| P4 | **Least privilege per role** | 3 app roles; finance writes additionally require MFA (AAL2) |
| P5 | **Service role key never reaches the browser** | Admin operations run in Edge Functions or server code only |
| P6 | **Everything security-relevant is audited** | `auth.audit_log_entries` (Supabase) + app `audit_log` for role grants |

---

## 2. Role model

### 2.1 Roles

| Role | Code (`roles.code`) | Intent |
|------|---------------------|--------|
| Administrator | `admin` | Full control: users, roles, tariffs, config, members, finance, audit |
| Accountant | `accountant` | Executes billing and bookkeeping: charges, payments, refunds, reports/exports |
| Viewer | `viewer` | Read-only across association data; no exports, no writes |

Existing codes (`treasurer`, `board`, `auditor`, `member`, `workday_lead`) stay valid; `accountant` supersedes `treasurer`/`auditor` for new grants (see §9 migration). `member` remains the self-service role for plot holders and is orthogonal to these three staff roles.

### 2.2 Permission matrix

| Capability | Administrator | Accountant | Viewer |
|---|:---:|:---:|:---:|
| View members, plots, assignments, announcements | ✔ | ✔ | ✔ |
| Create/edit members, plot assignments | ✔ | ✖ | ✖ |
| View tariffs & contribution types | ✔ | ✔ | ✔ |
| Create/edit tariffs & contribution types | ✔ | ✖ | ✖ |
| Create/void charges | ✔ | ✔ | ✖ |
| Record payments & refunds | ✔ | ✔ | ✖ |
| View charges, payments, balances, aging | ✔ | ✔ | ✔ |
| Reports & CSV/DATEV export | ✔ | ✔ | ✖ |
| Manage users, roles, invitations | ✔ | ✖ | ✖ |
| Auth config (MFA policy, providers) | ✔ | ✖ | ✖ |
| Read `audit_log` | ✔ | ✔ | ✖ |
| Seed/config/import operations | ✔ | ✖ | ✖ |

Pricing (`tariffs`) stays Administrator-only: the board decides prices, the Accountant executes billing.

### 2.3 Enforcement map

| Layer | Mechanism |
|---|---|
| Database | RLS policies call `has_role()` / `is_admin()` / `is_accountant()` (`security definer`) |
| Database | Finance writes additionally require `auth.jwt() ->> 'aal' = 'aal2'` (MFA session) |
| API | Edge Functions verify JWT (`supabase.auth.getClaims()`); service-role calls server-side only |
| UI | React route guards + hidden nav items per role — **cosmetic only**, never trusted |

---

## 3. Authentication flows

### 3.1 Login (email + password, PKCE)

```
/login → supabase.auth.signInWithPassword (PKCE code verifier)
       → code exchange → Session {access_token (1h), refresh_token (rotating)}
       → onAuthStateChange(SIGNED_IN) → fetch profile + roles → render app
```

- **PKCE** flow (`flowType: 'pkce'`) — no implicit token in URL fragments; code verifier stored in `localStorage` by supabase-js.
- Refresh tokens are **rotated on every use**; reuse detection invalidates the family (Supabase default).

### 3.2 Alternative sign-in methods

| Method | Use | Config |
|---|---|---|
| Magic link | Passwordless fallback for members | Email provider "Magic Link" |
| Google OAuth | Board convenience | Configure OAuth client; redirect allow-list |
| Invite link | **Primary onboarding** (P3) | `admin.inviteUserByEmail(email, { redirectTo })` from Edge Function |

### 3.3 Session lifecycle

| Event | Handling |
|---|---|
| App start | `getSession()` — restores from storage, silently refreshes if expired |
| Token expiry (1 h) | `autoRefreshToken: true` — refresh in background; no UX impact |
| Refresh failure (revoked/expired) | `onAuthStateChange → TOKEN_REFRESH_FAILED / SIGNED_OUT` → redirect `/login?next=<path>` |
| Role changed while online | No re-login needed — policies read `user_roles` per query (P2) |
| Logout | `signOut({ scope: 'local' })` → clear React Query cache → redirect `/login` |
| Password reset | `resetPasswordForEmail` → `/auth/callback` → `updateUser({ password })` (recovery flow) |

### 3.4 MFA (TOTP)

- **Enforced** for Administrator and Accountant (UI prompts `mfa.enroll` on first login; finance writes rejected server-side until AAL2 — §2.3).
- Optional for Viewer.
- Enforcement in RLS:

```text
-- policy fragment (full statements in §9.2)
using (
  public.is_admin()
  or (public.has_role('accountant') and (auth.jwt() ->> 'aal') = 'aal2')
)
```

- Recovery codes are shown once at enrollment (Supabase handles storage; document the process for the board).

### 3.5 Bootstrap (first Administrator)

1. Sign up manually with the board e-mail (temporarily allow sign-up **or** create the user in Dashboard → Authentication → Users).
2. Run the bootstrap SQL (§9.3) mapping that `auth.uid` → `admin`.
3. Enroll MFA immediately.
4. All further users are invited (§3.2).

---

## 4. Token & claims architecture

| Token | Lifetime | Contents (relevant) |
|---|---|---|
| Access token (JWT) | 1 h (project setting `jwt_exp = 3600`) | `sub` = auth user id, `role = "authenticated"`, `aal`, `app_metadata`, `exp` |
| Refresh token | Rotating; absolute timeout 30 days | Opaque; stored by supabase-js |

**Why app roles are *not* put in the JWT (default):**
`has_role()` queries `user_roles` → revocations apply instantly; no forced logout/refresh after demotion. The JWT `role` claim is the *Postgres* role (`authenticated`), never an app role.

**Optional optimization** (only if role checks become hot): mirror roles into `app_metadata.roles`
via Admin API on every grant/revoke — they then appear in `auth.jwt()` and can be read in policies.
Trade-off: stale until the access token expires (≤1 h) and requires an update hook on `user_roles`.
Start with DB-first (P2); introduce claims only with measurements.

**RLS integration (already shipped in `20261008000005_rls_policies.sql`):**

```text
has_role(p_role text)          -- SECURITY DEFINER, reads user_roles for auth.uid()
is_board()                     -- board | treasurer | admin  (legacy aggregation)
current_member_id()            -- members.id for auth.uid()
```

---

## 5. Client implementation (React + TypeScript)

### 5.1 Client setup

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,      // handles magic-link/invite/OAuth callbacks
    },
  },
);
```

- One singleton; `Database` type generated from the schema (`supabase gen types typescript`).
- Never import a service-role key in client code (CI lint rule: forbid `SERVICE_ROLE` in `src/`).

### 5.2 Auth context

```tsx
// src/auth/AuthProvider.tsx (shape)
const [session, setSession] = useState<Session | null>(null);

useEffect(() => {
  supabase.auth.getSession().then(({ data }) => setSession(data.session));
  const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
  return () => sub.subscription.unsubscribe();
}, []);
```

Roles are loaded with TanStack Query keyed by `session.user.id`:

```ts
const { data: roles } = useQuery({
  queryKey: ['roles', user?.id],
  queryFn: async () => (await supabase.from('user_roles').select('role_code')).data.map(r => r.role_code),
  enabled: !!user,
});
```

RLS already restricts the result to *self + board-managed* rows; the UI additionally requires the exact staff codes from §2. Invalidate on `SIGNED_OUT` / `USER_UPDATED`.

### 5.3 Route protection

```tsx
// src/auth/RequireRole.tsx (shape)
export function RequireRole({ allow, children }: { allow: RoleCode[]; children: JSX.Element }) {
  const { session, roles, isLoading } = useAuth();
  if (isLoading)            return <AppSpinner />;
  if (!session)             return <Navigate to={`/login?next=${location.pathname}`} replace />;
  if (!allow.some(r => roles.includes(r))) return <Navigate to="/403" replace />;
  return children;
}
```

Route table:

| Route group | Guard |
|---|---|
| `/login`, `/auth/callback`, public plot info | anonymous |
| `/dashboard`, `/me/*` (own invoices, profile) | authenticated + `member` |
| `/members`, `/plots`, `/tariffs` (read) | `admin` \| `accountant` \| `viewer` |
| `/members/new`, `/plots/edit`, `/tariffs/*` (write) | `admin` |
| `/billing`, `/payments`, `/reports` | `admin` \| `accountant` |
| `/users`, `/roles`, `/audit` | `admin` |

Write buttons/forms are additionally wrapped in `<Can action="charges.write">` — but every mutation is still rejected by RLS if the role is missing (defense in depth).

---

## 6. Backend implementation details

### 6.1 Data path (browser → PostgREST → RLS)

All CRUD goes through PostgREST with the user's JWT. Policies from migration `000005` decide visibility/mutability. No API layer to secure beyond RLS.

### 6.2 Edge Functions (Deno)

| Function | Auth | Notes |
|---|---|---|
| `invite-user` | `getClaims()` + `is_admin()` check | wraps `admin.inviteUserByEmail` |
| `set-role` | claims + admin check | updates `user_roles`, writes `audit_log` |
| `invoice-generation` | scheduled (cron) | uses **service role** internally; never exposed |
| `export-*` | claims + `accountant`/`admin` + AAL2 | streams CSV; logs to `audit_log` |

```ts
// every user-facing Edge Function starts with:
const { data: { claims }, error } = await supabase.auth.getClaims(); // verifies JWT signature
if (error || !claims) return new Response('unauthorized', { status: 401 });
const isAdmin = await supabase.rpc('has_role', { p_role: 'admin' }); // service client, after uid context
```

Deploy with `--no-verify-jwt` **only** for cron/health endpoints.

### 6.3 Admin API usage

- `createServerClient(url, SERVICE_ROLE_KEY)` — only in Edge Function `Deno.env` or CI.
- User management surface: `inviteUserByEmail`, `updateUserById` (app_metadata/MFA), `generateLink` (password reset), `deleteUser` (deprovision).
- Every admin action writes `audit_log (actor, action, target, before/after)`.

### 6.4 Provisioning sequence (invite → active)

1. Administrator calls `invite-user` → email with magic link (`redirectTo` = app origin + `/auth/callback`).
2. User sets password via link → `auth.users` row exists → app trigger/first-login upsert creates `public.users`.
3. `set-role` grants e.g. `member` (and `viewer`/`accountant` if staff).
4. First login prompts MFA if role ∈ {admin, accountant}.

---

## 7. Security hardening checklist

| Area | Setting |
|---|---|
| Passwords | min 12 chars, breach detection ("protect against leaked passwords") ON |
| JWT expiry | 3600 s; refresh rotation + reuse interval 10 s |
| Redirect allow-list | exact origins only: `http://localhost:5173/*`, `https://<app>/*` |
| Sign-up | disabled (invite-only) after bootstrap; providers: Email + optional Google |
| MFA | required for `admin`, `accountant` (AAL2 enforced in finance write policies) |
| Rate limiting | Supabase built-in on `/token` & `/otp`; app-level throttle on login form |
| CORS | only app origins on Edge Functions |
| Client bundle | anon key only; `SERVICE_ROLE` forbidden via lint/CI |
| Audit | `auth.audit_log_entries` + app `audit_log` for role grants/finance exports |
| Session mgmt | Dashboard: "sign out other sessions" available for compromised accounts |

---

## 8. Error handling

| Scenario | Behavior |
|---|---|
| Expired/revoked refresh | `SIGNED_OUT` → `/login?next=…`; toast "session expired" |
| 403 from RLS (stale UI) | Query error boundary → refetch roles once → else `/403` |
| MFA not enrolled but required | Finance write fails (AAL2) → UI routes to `/settings/security` enroll flow |
| Invite link reused/expired | Supabase error surfaced on `/auth/callback` → "request new invite" |
| Role revoked mid-session | Effective immediately on next query (DB-first, P2) |
| Unknown role code in DB | UI falls back to `/dashboard` (member scope only) |

---

## 9. Migration & provisioning SQL

Sections 9.1 + 9.2 are shipped as
**`supabase/migrations/20261008000007_roles_accountant_viewer.sql`**
(applied by `supabase db reset` / `supabase db push`). §9.3 stays manual — it targets a real user.

### 9.1 Add the two new role codes

```sql
insert into roles (code, name, description, is_system) values
  ('accountant', 'Accountant', 'Billing, payments, reports and exports', true),
  ('viewer',     'Viewer',     'Read-only access to association data',   true)
on conflict (code) do nothing;
```

### 9.2 Policy updates (drop + recreate; additive)

Migration `...0007` performs the following (always `drop policy if exists` → `create policy`):

| # | Change | Policies |
|---|--------|----------|
| 1 | helpers + execute grants | `is_admin()`, `is_accountant()` |
| 2 | members: staff read (viewer), writes admin-only, members keep own-update | `members_select_own_or_board`, `members_insert_admin`, `members_update_own_or_admin` |
| 3 | plots & assignments: write admin-only; assignments readable by viewer | `plots_write_admin`, `plot_assignments_select`, `plot_assignments_write_admin` |
| 4 | configuration: admin-only (board decides prices) | `tariffs_write_admin`, `contribution_types_write_admin` |
| 5 | charges read: member / board / accountant / viewer | `charges_select_own_or_finance` |
| 6 | charges write: admin, **or accountant with MFA session (AAL2)** | `charges_write_accountant` |
| 7 | payments: same pattern as charges | `payments_select_own_or_finance`, `payments_write_accountant` |

Key policy — finance write gated by MFA:

```sql
create policy charges_write_accountant on charges
  for all to authenticated
  using (
    public.is_admin()
    or (public.is_accountant() and (auth.jwt() ->> 'aal') = 'aal2')
  )
  with check (
    public.is_admin()
    or (public.is_accountant() and (auth.jwt() ->> 'aal') = 'aal2')
  );
```

Notes:

- Policy count unchanged: **29** (12 dropped ↔ 12 created).
- Legacy codes: `treasurer` ≡ `is_accountant()` (now MFA-gated); `board` keeps read everywhere but loses writes on members/plots/tariffs → Administrator-only per §2.2.

### 9.3 Bootstrap first Administrator

```sql
-- replace with the real auth user id from Dashboard → Authentication
insert into user_roles (user_id, role_code)
select u.id, 'admin'
  from users u
 where u.email = 'board@example.org'
on conflict (user_id, role_code) do nothing;
```

---

## 10. Setup runbook (log steps)

### A. Supabase project configuration

| Step | Action | Where | Expected |
|------|--------|-------|----------|
| A1 | Confirm **Site URL** = app origin | Authentication → URL Configuration | e.g. `http://localhost:5173` (dev) |
| A2 | Add redirect allow-list | same page | `/auth/callback`, `/login` for each env |
| A3 | JWT expiry = 3600 s, refresh reuse interval 10 s | Authentication → Settings (JWT template / Auth config) | applied |
| A4 | Disable public sign-ups | Authentication → Providers → Email | "Allow new users to sign up" OFF (after bootstrap) |
| A5 | Enable breach-password protection | Authentication → Settings | ON |
| A6 | (Optional) enable Google OAuth | Providers → Google | client id/secret set |

### B. Database setup

| Step | Command / SQL | Expected |
|------|---------------|----------|
| B1 | `supabase db reset` (local) or `supabase db push` | migrations 1–7 applied |
| B2 | verify roles | `select code from roles order by 1;` includes `accountant`, `viewer` |
| B3 | verify policies | `select policyname from pg_policies where policyname like '%accountant%';` → `charges_write_accountant`, `payments_write_accountant` |
| B4 | `select count(*) from pg_policies where schemaname='public';` | `29` (migration 7 is drop+replace, net 0) |

### C. Client setup

| Step | Action | Expected |
|------|--------|----------|
| C1 | `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client builds |
| C2 | Add `src/lib/supabase.ts` (§5.1) | singleton created |
| C3 | Wrap app in `AuthProvider` (§5.2) | session persisted across reload |
| C4 | Add `RequireRole` guards per route table (§5.3) | `/users` redirects to `/403` for non-admins |
| C5 | CI rule: forbid `SERVICE_ROLE` in client bundle | lint passes |

### D. Bootstrap & onboarding

| Step | Action | Expected |
|------|--------|----------|
| D1 | Create board user (temporary sign-up or Dashboard) | row in `auth.users` + `public.users` |
| D2 | Run §9.3 | `user_roles` contains `admin` |
| D3 | Log in, enroll MFA (TOTP) | `aal2` on next session |
| D4 | Re-disable public sign-up (A4) | invites only from now on |
| D5 | Invite first Accountant via `invite-user` Edge Function | email received; role `accountant` after accept |
| D6 | Create a Viewer the same way | role `viewer` |

### E. Verification checklist (per role)

| # | Test | Administrator | Accountant | Viewer |
|---|---|:---:|:---:|:---:|
| E1 | Login + session restore | ✔ | ✔ | ✔ |
| E2 | View members/plots | ✔ | ✔ | ✔ |
| E3 | Edit member | ✔ | ✖ (403) | ✖ (403) |
| E4 | Edit tariff | ✔ | ✖ | ✖ |
| E5 | Create charge (with MFA session) | ✔ | ✔ | ✖ |
| E6 | Create charge **without** MFA | ✔ | ✖ (AAL2 required) | ✖ |
| E7 | Record payment / refund | ✔ | ✔ | ✖ |
| E8 | Export report CSV | ✔ | ✔ | ✖ |
| E9 | Manage users/roles | ✔ | ✖ | ✖ |
| E10 | Direct SQL (bypass UI): `insert into payments …` | ✔ | ✔ w/ AAL2 | ✖ |
| E11 | Revocation: remove `accountant` → next query fails | — | ✔ (immediate) | — |
| E12 | Logout clears cache; `/login?next=` restore | ✔ | ✔ | ✔ |

Run E10 from the SQL editor **as the test user** (or via the app's query console) to prove RLS, not the UI, is enforcing.

---

## 11. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-08 | Initial auth architecture (admin/accountant/viewer) | `docs/authentication.md`, §9 | — | design + SQL reviewed | — |
| 2026-10-08 | Promoted to migration | `supabase/migrations/20261008000007_roles_accountant_viewer.sql` | local | syntax-validated, pending `db push` | — |
| | §9.3 bootstrap executed (D2) | — | local | pending | — |

*Append one row per environment application of the migration / bootstrap and per provider/config change (A1–A6).*
