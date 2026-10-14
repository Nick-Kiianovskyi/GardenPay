# Etap 8 — React Application Architecture (karkas) · Log & Runbook

Frontend skeleton for GardenPay.

Stack: **React 18 + TypeScript + Vite + React Router (v6/v7) + Tailwind CSS + shadcn/ui**
Auth/state integration follows [`authentication.md`](authentication.md) (Supabase Auth, RLS-first).

---

## 1. Stack mapping

| Concern | Choice | Notes |
|---|---|---|
| Build / dev server | **Vite** | `npm create vite@latest -- --template react-ts` |
| Routing | **React Router** | `createBrowserRouter` + `RouterProvider`; lazy routes |
| Styling | **Tailwind CSS v3/v4** | via `@tailwindcss/vite` plugin or postcss |
| UI kit | **shadcn/ui** | `npx shadcn@latest init` → `components.json`, `src/lib/utils.ts` (`cn`), CSS variables |
| Server state | TanStack Query (recommended) | cache keyed by auth; invalidated on auth events |
| Auth client | `@supabase/supabase-js` | singleton in `src/lib/supabase.ts` |
| Path alias | `@/` → `src/` | `vite.config.ts` alias + `tsconfig` paths |
| Environment | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | typed in `.env` / `.env.example` |

---

## 2. Folder structure

```
GardenPay/
├─ index.html
├─ vite.config.ts              # @ alias, tailwind plugin, dev proxy (optional)
├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json
├─ components.json             # shadcn/ui config
├─ .env / .env.example
└─ src/
   ├─ main.tsx                 # entry: mount <Providers/>
   ├─ styles/
   │  └─ globals.css           # tailwind directives + theme vars (shadcn)
   ├─ app/
   │  ├─ App.tsx               # <Providers> + <RouterProvider>
   │  ├─ router.tsx            # createBrowserRouter, route table (co-located guards)
   │  └─ providers.tsx         # QueryClientProvider + AuthProvider + Toaster
   ├─ components/
   │  ├─ ui/                   # shadcn components (button, card, dialog, …)
   │  ├─ layout/               # PublicLayout, AppLayout, Sidebar, Topbar, UserMenu
   │  └─ shared/               # DataTable, PageHeader, ConfirmDialog, <Can/>
   ├─ features/                # feature modules (co-located pages + hooks + api)
   │  ├─ auth/                 # login, callback, guards, mfa
   │  ├─ dashboard/
   │  ├─ members/
   │  ├─ plots/
   │  ├─ tariffs/
   │  ├─ meters/
   │  ├─ billing/              # charges
   │  ├─ payments/
   │  ├─ reports/
   │  └─ admin/                # users, roles, audit
   ├─ hooks/                   # shared hooks (useDebounce, useMediaQuery…)
   ├─ lib/
   │  ├─ supabase.ts           # Supabase singleton (PKCE) — see authentication.md §5.1
   │  ├─ utils.ts              # cn(), formatters (money/date)
   │  └─ api/                  # typed query helpers per domain (Supabase RPC/from)
   ├─ config/
   │  └─ navigation.ts         # nav items filtered by role
   └─ types/
      └─ database.ts           # generated Supabase types (supabase gen types)
```

**Rules**

- Feature folders own their `pages.tsx`, `api.ts`, hooks and components — no global `pages/` dumping ground.
- Only `ui/`, `layout/`, `shared/` live in `components/`; everything feature-specific is co-located.
- `lib/` has no JSX; `app/` has no business logic.
- Database types never imported in features as `any` — always `Database['public']['Tables'][T]['Row']`.

---

## 3. Routing

### 3.1 Route table

| Path | Layout | Access (guard) | Feature |
|---|---|---|---|
| `/` | PublicLayout | public | Landing / garden info |
| `/login` | PublicLayout | anonymous only | Login (PKCE) |
| `/auth/callback` | PublicLayout | public | OAuth / magic-link / invite callback |
| `/forgot-password` · `/reset-password` | PublicLayout | public | Recovery |
| `/dashboard` | AppLayout | authenticated | Home |
| `/me` · `/me/bills` · `/me/plot` | AppLayout | authenticated (self) | Profile, own charges, own plot |
| `/members` | AppLayout | admin \| accountant \| viewer | Member registry (viewer: read-only) |
| `/plots` | AppLayout | admin \| accountant \| viewer | Plot registry |
| `/tariffs` · `/contribution-types` | AppLayout | admin \| accountant \| viewer | Prices (edits admin-only) |
| `/meters` | AppLayout | admin \| accountant \| viewer | Meters & readings |
| `/billing` | AppLayout | admin \| accountant | Charges (Accountant: write + MFA) |
| `/payments` | AppLayout | admin \| accountant | Payments & reconciliation |
| `/reports` | AppLayout | admin \| accountant | Aging, balance, exports |
| `/users` · `/roles` | AppLayout | admin | User & role management |
| `/audit` | AppLayout | admin | Audit log |
| `/settings` | AppLayout | admin | Schema/config |
| `/403` · `*` | ErrorLayout | any | Forbidden / 404 |

### 3.2 Router setup (shape)

```tsx
// src/app/router.tsx
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: lazy(() => import('@/features/landing/pages/HomePage')) },
      { path: 'login', element: <LoginPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { path: 'dashboard', element: lazy(() => import('@/features/dashboard/pages/DashboardPage')) },
      // self-service
      { path: 'me', element: lazy(() => import('@/features/profile/pages/ProfilePage')) },
      { path: 'me/bills', element: lazy(() => import('@/features/billing/pages/MyChargesPage')) },
      // readers (admin | accountant | viewer)
      { element: <RequireRole allow={['administrator','accountant']} />,
        children: [
          { path: 'billing',   element: lazy(() => import('@/features/billing/pages/ChargesPage')) },
          { path: 'payments',  element: lazy(() => import('@/features/payments/pages/PaymentsPage')) },
          { path: 'reports',   element: lazy(() => import('@/features/reports/pages/ReportsPage')) },
        ] },
      // admin only
      { element: <RequireRole allow={['administrator']} />,
        children: [
          { path: 'users',  element: lazy(() => import('@/features/admin/pages/UsersPage')) },
          { path: 'roles',  element: lazy(() => import('@/features/admin/pages/RolesPage')) },
          { path: 'settings', element: lazy(() => import('@/features/admin/pages/SettingsPage')) },
        ] },
      { path: '403', element: <ForbiddenPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage />, errorElement: <RouteError /> },
]);
```

- Lazy via `lazy(() => import(...))` wrapped in `<Suspense fallback={<PageSpinner/>}>` inside each layout.
- Reader routes (`/members`, `/plots`, `/tariffs`, `/meters`) use `RequireRole` with
  `['administrator','accountant','viewer']`.

---

## 4. Layouts

| Layout | Contents | Used for |
|---|---|---|
| **PublicLayout** | centered card container, small top brand bar, `<Outlet/>` | login, recovery, landing |
| **AppLayout** | `Sidebar` (role-filtered nav) + `Topbar` (UserMenu, MFA badge) + `<main><Outlet/></main>` | every authenticated page |
| **ErrorLayout** | minimal centered error shell | `/403`, `/404`, route errors |

Nav model — single source in `src/config/navigation.ts`:

```ts
export type NavItem = { title: string; href: string; allow: RoleCode[] };
export const NAV: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', allow: ALL_ROLES },
  { title: 'Members',   href: '/members',   allow: ['administrator','accountant','viewer'] },
  { title: 'Billing',   href: '/billing',   allow: ['administrator','accountant'] },
  { title: 'Payments',  href: '/payments',  allow: ['administrator','accountant'] },
  { title: 'Users',     href: '/users',     allow: ['administrator'] },
  // …
];
// Sidebar renders NAV.filter(i => i.allow.some(r => roles.includes(r)))
```

Presence in `NAV` is *display only*; authorization is enforced by `RequireRole` (RLS underneath).

---

## 5. Protected routes

Three building blocks (see also `authentication.md` §5.2–5.3):

```tsx
// src/features/auth/components/RequireAuth.tsx (shape)
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  if (isLoading) return <PageSpinner />;
  if (!session) return <Navigate to={`/login?next=${location.pathname}`} replace />;
  return children; // <Outlet/> when used as layout element
}

// src/features/auth/components/RequireRole.tsx (shape)
export function RequireRole({ allow, children }: { allow: RoleCode[]; children?: ReactNode }) {
  const { session, roles, isLoading } = useAuth();
  if (isLoading) return <PageSpinner />;
  if (!session) return <Navigate to={`/login?next=${location.pathname}`} replace />;
  if (!roles.some((r) => allow.includes(r as RoleCode)))
    return <Navigate to="/403" replace />;
  return children ?? <Outlet />;
}
```

| Guard | Role codes (from RLS set) |
|---|---|
| `RequireAuth` | any authenticated session |
| `RequireRole allow={['administrator','accountant','viewer']}` | readers |
| `RequireRole allow={['administrator','accountant']}` | finance |
| `RequireRole allow={['administrator']}` | user/role/settings/audit |

Supporting pieces:

- **`useAuth()`** — `AuthProvider` context exposing `{ session, user, roles, isLoading, signOut }`,
  roles via TanStack Query keyed by `user.id` (invalidated on `SIGNED_OUT`/`USER_UPDATED`).
- **`<Can action="charges.write">`** — granular button-level gating (same allow-list rule),
  cosmetic only; the API call still relies on RLS.
- **`returnUrl`** — on login redirect to `next` param; after login route to `/dashboard`.
- **MFA prompt** — finance pages show an inline "enable MFA / verify session" card when
  `user.aal !== 'aal2'` (mirrors the AAL2 RLS gate from `etap7_rls.md`).
- **`/auth/callback`** — consumes `code`/`token` from URL (`detectSessionInUrl`), then
  `<Navigate to={next ?? '/dashboard'}>`.

---

## 6. Providers & entry (shape)

```tsx
// src/app/providers.tsx
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster />            {/* shadcn sonner */}
      </AuthProvider>
    </QueryClientProvider>
  );
}
// src/app/App.tsx
export default function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
// src/main.tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

---

## 7. Setup runbook (log steps)

| Step | Action | Command / artifact | Verify |
|------|--------|--------------------|--------|
| A1 | Scaffold Vite + TS | `npm create vite@latest . -- --template react-ts` | `npm run dev` serves `/` |
| A2 | Install routing | `npm i react-router-dom @supabase/supabase-js @tanstack/react-query` | versions pinned |
| A3 | Tailwind | `npm i tailwindcss @tailwindcss/vite`; add plugin to `vite.config.ts`; `@import "tailwindcss"` in `globals.css` | dev CSS loads |
| A4 | shadcn/ui | `npx shadcn@latest init` (base color, CSS vars) | `components.json` created |
| A5 | Path alias | `vite.config.ts` `resolve.alias['@'] = /src`; `tsconfig.app.json` `paths` | `import '@/lib/utils'` typechecks |
| A6 | Env | `.env` + `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | types resolve |
| A7 | Skeleton dirs | create `app/`, `components/{ui,layout,shared}/`, `features/*`, `lib/`, `config/`, `types/` | `npm run build` passes |
| A8 | Router | implement `router.tsx` (§3) + `providers.tsx`, `App.tsx` (§6) | naigation renders |
| A9 | Guards | `AuthProvider`, `RequireAuth`, `RequireRole`, `navigation.ts` (§5) | see verification |
| A10 | Generate DB types | `supabase gen types typescript --project-id "$PROJECT_REF" > src/types/database.ts` | types compile |

Verification checklist:

| # | Test | Expected |
|---|---|:---:|
| V1 | `npm run dev` → `.` | landing page |
| V2 | visit `/dashboard` logged out | redirect `/login?next=/dashboard` |
| V3 | login → redirected to guarded `next` | |
| V4 | `/billing` as Viewer | redirect `/403` |
| V5 | `/users` as Accountant | redirect `/403` |
| V6 | nav shows only allowed items per role | |
| V7 | `/members` as Viewer renders read-only (no edit buttons) | `<Can>` gates |
| V8 | stale session → auto refresh → no page reload | `autoRefreshToken` |
| V9 | `npm run build` | typecheck passes, no `any` leaks |

---

## 8. As-built deviations (applied 2026-10-08)

Scaffolded in **`web/`** (monorepo-style: `supabase/` and `docs/` stay at repo root). Versions
resolved: React 19.2, Vite 8.3, TypeScript 6.0, Tailwind 4.3, shadcn/ui 4.21, react-router-dom 7.

| Doc (§) | Planned | As-built |
|---|---|---|
| §1 UI kit | `cn()` via clsx+tailwind-merge | shadcn v4 ships `cn` npm package: `src/lib/utils.ts` = `export { cn } from "cn"` |
| §1 components | `@radix-ui/*` | unified `radix-ui` package; icons `lucide-react`; fonts `@fontsource-variable/geist` |
| §4 Dark mode | inline | `next-themes` `ThemeProvider` wrapping `AuthProvider` (required by `Toaster`) |
| §2 types | `types/database.ts` generated types | added `types/role.ts` (`RoleCode` union); `database.ts` is a placeholder until `supabase gen types` |
| §3 `/me/plot` | self plot page | deferred — not yet in router |
| §7 A10 | `supabase gen types` | pending project link (`supabase init`); placeholder committed |
| §3 env | — | `web/.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); no `.env` committed |

Verification run: `npm run build` ✓ (tsc -b + vite build, 0 errors), `npm run lint` ✓ (oxlint, warnings
only — fast-refresh style, incl. inside shadcn's own files), dev server ✓ (`/`, `/login`, `/dashboard` → 200).

Route guard behavior is fully wired: `/dashboard` logged-out → `/login?next=/dashboard`,
`/billing` as Viewer → `/403`, `/users` as Accountant → `/403` (set roles in `web/src/features/auth/auth-context.tsx`
`loadRoles()` — queries RLS-scoped `user_roles`).

## 9. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-08 | Etap 8 — React skeleton architecture (structure, routing, layouts, guards) | `docs/etap8_karkasreact.md` | — | design reviewed | — |
| 2026-10-08 | A1–A9 applied: Vite+TS app in `web/`, Tailwind v4, shadcn/ui (16 components), router/layouts/guards, AuthProvider, lazy pages, dark mode | `web/` | local | verified (build/lint/dev) | — |
| 2026-10-08 | A10 pending | `web/src/types/database.ts` | — | blocked on `supabase init` | — |

*Append one row per environment application (local → staging → production).*