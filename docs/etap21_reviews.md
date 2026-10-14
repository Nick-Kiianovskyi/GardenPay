# Etap 21 — Project Review · Log & Refactoring Plan

Full review of GardenPay across 5 dimensions (architecture, database, security, performance,
UI/UX). Findings are severity-tagged (High / Medium / Low) with `file:line`. The plan below turns
the findings into a phased, ordered refactoring roadmap with effort and acceptance criteria.

Reviewed by inspection of: `supabase/migrations/0001–0012`, `supabase/seed.sql`,
`supabase/rls_policies_3roles.sql`, `Structure.md`, `docs/*.md`, and the whole `web/` app.

---

## 1. Architecture review

| # | Sev | Finding | Location |
|---|-----|---------|----------|
| ARC-1 | **High** | **Unfinished feature placeholders are shipped as routed screens** (`TODO: implement feature`): Profile, My Charges, Admin Users/Roles/Settings | `web/src/components/shared/placeholder-page.tsx:17`, `features/profile/pages/profile-page.tsx`, `features/billing/pages/my-charges-page.tsx`, `features/admin/pages/*` |
| ARC-2 | **Middle** | 8 near-identical list pages (search debounce `setTimeout`, `PAGE_SIZES`, pagination, skeleton/empty/error, formatting) copy-pasted | `charges|payments|plots|members|tariffs|contribution-types|meters/water|meters/electricity` pages |
| ARC-3 | **Middle** | Duplicate reference-option hooks + ad-hoc string query keys (`['charge-members']`, `MEMBERS_KEY`, `OWNER_OPTIONS_KEY`, `SERVICES_KEY`, `METERS_KEY`…) — same data cached under different keys | `charges/api.ts:79,103,128`, `payments/api.ts:83`, `plots/api.ts:75`, `tariffs/api.ts:78`, `meters/*/api.ts:84` |
| ARC-4 | **Middle** | Money formatting re-implemented in 3+ places (`(x/100).toFixed(2)` in payment form, `Math.round(x)/100` in export libs) vs canonical `charges/business.ts:6` | `payment-form-dialog.tsx:53`, `reports/export/excel.ts:26`, `reports/export/pdf.ts:5` |
| ARC-5 | **Low** | No generated DB types (`web/src/types/database.ts` is `Record<string, never>`); hand-typed rows everywhere | `web/src/types/database.ts` |
| ARC-6 | **Low** | No tests, no test tooling; `tsconfig` strict off; minimal oxlint rules | `web/package.json`, `tsconfig.app.json`, `.oxlintrc.json` |
| ARC-7 | **Low** | `features/billing` (my-charges) and `features/landing` diverge from route/nav names; READMEs stale (Vite template) | `web/README.md`, root `README.md` |

**Improvements**: finish or un-route placeholders; extract `useDebouncedSearch`, `DataTable` +
pagination, and reference-data/query-key factory; one `money`/`formatDate` module; `supabase gen
types`; enable strict TS; add Vitest for `charges/business.ts` + validation schemas.

---

## 2. Database review

| # | Sev | Finding | Location |
|---|-----|---------|----------|
| DB-1 | **High** | `payments.member_id` is **not tied to `charges.member_id`** — a payment can be posted to member A against member B's charge (no FK/trigger/check) | `migrations/0004:78-95` vs `:13` |
| DB-2 | **Mid** | `tg_refresh_charge_payment_state` counts all `status <> 'void'` — **`pending` payments flip a charge to `paid`** before funds clear | `migrations/0004:106-149` |
| DB-3 | **Mid** | `v_member_balance.outstanding_minor`/`overdue_minor` sum full `amount_minor` instead of `amount_minor - paid_minor`; disagrees with `v_charge_aging` | `migrations/0004:189-197` vs `:214` |
| DB-4 | **Mid** | `plots.owner_id` (denormalized) + `plot_assignments_active_uk on (plot_id) where end_on is null` conflict: owner change on a plot with an open tenant assignment hits a unique violation / loses data | `migrations/0008:8-16,20-44`, `0002:112-114` |
| DB-5 | **Mid** | **"Append-only" claim is false** — `charges`/`payments` allow UPDATE/DELETE with no `audit_log` and no immutability trigger | `Structure.md:14,960`, `migrations/0005` |
| DB-6 | **Low** | `charge_no_seq` not `OWNED BY charges.charge_no`; document number year prefix uses `current_date` not `issued_on`; `charges.charge_no` stays nullable | `migrations/0004:5,63-66` |
| DB-7 | **Low** | Reading tables lack `updated_at`; `unit`/`quantity` consistency between charge/tariff/contribution-type not enforced | `migrations/0003` |
| DB-8 | **Low** | Sign convention differs: `v_member_balance.balance_minor = paid−charged` (credit-positive) vs `v_debt_*` (debt = charges−payments) | `migrations/0004:185` |

**Improvements**: cross-check PK on `(charge_id, member_id)` or validate in the state trigger;
classify `pending` payments out of `paid_minor`; fix outstanding sums in `v_member_balance`;
unique index `(plot_id, relation) where end_on is null`; add `audit_log` + append-only guard;
`alter sequence ... owned by`; month prefix from `issued_on`.

---

## 3. Security review

| # | Sev | Finding | Location |
|---|-----|---------|----------|
| SEC-1 | **High** | **Role model fragmented**: migrations define `is_admin() = has_role('admin')`; the standalone `rls_policies_3roles.sql` (NOT under `migrations/`) seeds a different code **`administrator`** and redefines `is_admin()`; the web client gates on `administrator`. Applied migration-only → granted `administrator` has no admin privileges; effective RLS ≠ intended. | `migrations/0007:17-20`, `rls_policies_3roles.sql:36-40`, `config/navigation.ts` |
| SEC-2 | **High** | `members_update_own_or_admin` lets a member **rewrite their own row** (`status`, `kind`, `member_no`, `email`, `joined_on`, `left_on`, `notes`) — self-reactivation possible; `users_update` allows editing `is_active`/`email` | `migrations/0007:47-50`, `0005:71-73`, `rls_policies_3roles.sql:144-146` |
| SEC-3 | **High** | Migration-7 read policies for **members/plot_assignments omit `accountant`** (accountant can't see the registry it must bill) | `migrations/0007:36-41,62-68` |
| SEC-4 | **Mid** | **Meter + reading SELECT is `using(true)`** for every authenticated user — all members' consumption data readable cross-member | `migrations/0005:140-199` |
| SEC-5 | **Mid** | Several policies **omit `TO authenticated`** → apply to `PUBLIC` (`anon`) and throw `permission denied for function`; broader surface than intended | `migrations/0005:68-69,81-101`, `0007:36-87`, `rls_policies_3roles.sql` |
| SEC-6 | **Mid** | Finance policies are `FOR ALL` (UPDATE/DELETE) for accountant/admin with **no audit trail** | `migrations/0007:101-135`, `rls_policies_3roles.sql:274-307` |
| SEC-7 | **Low** | No `auth.users → public.users` sync trigger — fresh sign-ups have no profile → no roles, and `has_role()` can't work for them | (absent; documented `docs/authentication.md`) |
| SEC-8 | **Low** | No `supabase/config.toml` — password policy, MFA enrollment enforcement, rate limits are doc-only | (absent) |

**Good**: no leaked secrets/keys; seed has no default admin password; helpers are `SECURITY
DEFINER` with pinned `search_path`.

**Improvements** (order-dependent): ① pick one canonical role set and fold `rls_policies_3roles.sql`
into a numbered migration; ② add `TO authenticated` everywhere; ③ narrow self-service
`UPDATE`/`users` policies (column-level grants or guarded `WITH CHECK`); ④ add `accountant` to
member/plot reads; ⑤ scope meter reads to own plots; ⑥ separate `SELECT/INSERT` from `UPDATE`,
persist `audit_log`; ⑦ add auth→profile sync trigger + `config.toml`.

---

## 4. Performance review

| # | Sev | Finding | Location |
|---|-----|---------|----------|
| PERF-1 | **Mid** | **Missing indexes on join/filter columns**: `charges.tariff_id`, `payments.received_by`, both `*_meter_readings.read_by`, `user_roles.granted_by`, `charges.issued_on`, `payments.paid_on`, general `charges.status`/`payments.status` (only partial indexes exist) → seq scans in FK checks and every report/debt/monthly view | `migrations/0004:16,91`, `0003:111,125`, `0002:39`, `0004:48-52,97-103`, `0012` |
| PERF-2 | **Mid** | **Reports/debtors hard-capped at 1000** with no server-side pagination → truncated results, misleading totals; export also capped | `reports/api.ts:28`, `debtors/api.ts:47` |
| PERF-3 | **Mid** | Dashboard fetches **all** `v_monthly_finance` rows then slices last 12 client-side; count queries run sequentially | `dashboard/api.ts:41-52`, `headCount` |
| PERF-4 | **Mid** | **`exceljs` + `jspdf` statically imported** on the reports route (bundled into the route chunk regardless of use) | `reports/pages/reports-page.tsx:44-49`, `export/excel.ts`, `export/pdf.ts` |
| PERF-5 | **Low** | Debounce duplicated in 8 pages; no manual chunking; `react-query` per-route split is otherwise OK | list pages, `vite.config.ts` |

**Improvements**: add the indexes (B-list); move report/debtor pagination to the server (or stream
export by cursor); dashboard `order(...).limit(12)` + parallel counts; `await import()` the export
libs inside click handlers; extract debounce hook; add `manualChunks` for vendor splits.

---

## 5. UI/UX review

| # | Sev | Finding | Location |
|---|-----|---------|----------|
| UX-1 | **High** | **App is half-English**: full Members page, all auth pages, landing, topbar, user menu, status pages, tags signal "not production" | `members/pages/members-page.tsx`, `features/auth/pages/*`, `components/layout/*`, `features/misc/pages/status-pages.tsx`, `features/landing/pages/home-page.tsx` |
| UX-2 | **High** | Authenticated users hitting `/` see the English "Sign in" card instead of the dashboard | `app/router.tsx:38-45`, `home-page.tsx` |
| UX-3 | **Mid** | i18n shell: `index.html` `lang="en"`, no description/CSP/theme-color | `web/index.html` |
| UX-4 | **Mid** | **Stale data across sessions**: `QueryClient` is module-level and never cleared on sign-out → next user sees previous user's cached data; mutations never invalidate `['dashboard']`, debtors, reports, option hooks | `app/providers.tsx:7`, `auth/auth-context.tsx:56-58`, `charges/api.ts:219` |
| UX-5 | **Mid** | A11y/locale inconsistency: English `sr-only`/`aria-label` on Members page vs Ukrainian elsewhere; locale-less `toLocaleDateString()` | `members-page.tsx:48,216` |
| UX-6 | **Low** | Raw enum values shown raw (`partially_paid` capitalized naively) | `reports/pages/reports-page.tsx:128` |
| UX-7 | **Low** | Roles load silently degrades (`error → []`, empty → default `['member']`) — user locked out with no message | `auth/auth-context.tsx:25-31` |

**Improvements**: unify on Ukrainian (or real i18n lib); redirect `/` → `/dashboard` when
authenticated; `queryClient.clear()` on auth change / sign-out; central `invalidateAll()` that
invalidates dashboard/debtors/reports/options; translate a11y labels; shared `formatDate('uk-UA')`;
map enums to labels; surface role-load errors.

---

## 6. Refactoring plan (phased)

Legend: `S` small (<0.5d) · `M` medium (0.5–2d) · `L` large (2–5d). Acc = acceptance criteria.

### Phase A — Security/hardening blockers (do first; prevents data damage & privilege bugs)
| # | Task | Sev | Effort | Acceptance |
|---|------|-----|--------|-----------|
| A1 | **Converge RBAC**: decide canonical codes (recommend `admin|accountant|viewer`; rename any `administrator` refs), fix `is_admin()`; convert `rls_policies_3roles.sql` into migration 0013 (or fold into 0007), delete the standalone file | Critical | M | one `is_admin()` def; policy counts match a test; web roles map to DB codes 1:1 |
| A2 | Add `TO authenticated` to all policies that currently omit it | Critical | S | `anon` provably denied on all data tables |
| A3 | Narrow self-service: column-restricted `members` update policy + `users` update (only display fields; `status/kinds/member_no/email/is_active` staff-only) | Critical | S/M | member can't change own status/member_no/email |
| A4 | Add `accountant` to members/plot_assignments read policies | Critical | S | accountant sees registry (matches docs) |
| A5 | `audit_log` table + append-only guard on `charges`/`payments` (UPDATE allowlisted fields, DELETEs logged or forbidden) | Critical | M | history immutable; every change recorded |
| A6 | Scope meter/reading SELECT to own plots (or document as public data) | High | M | cross-member reads blocked |
| A7 | `auth.users → public.users` sync trigger + `supabase/config.toml` (password min length, MFA, rate limits, `[db.seed]`) | High | M | fresh sign-up gets profile; policies provisioned by `db reset` |

### Phase B — DB correctness/performance
| # | Task | Sev | Effort | Acceptance |
|---|------|-----|--------|-----------|
| B1 | Indexes: `charges(tariff_id)`, `payments(received_by)`, `*_meter_readings(read_by)`, `user_roles(granted_by)`, `charges(issued_on)`, `payments(paid_on)`, `charges(status)`, `payments(status)` | Mid | S | report views EXPLAIN seq-free |
| B2 | `payments`↔`charges` member consistency (composite key or trigger check); exclude `pending` from `paid_minor` | High | M | cross-member payment rejected; pending no longer marks paid |
| B3 | Fix `v_member_balance` outstanding/overdue to `amount_minor - paid_minor`; harmonize sign docs | Mid | S | tally matches `v_charge_aging` |
| B4 | `plot_assignments_active_uk → (plot_id, relation)` ; owner-sync trigger idempotent | Mid | M | owner+tenant can coexist |
| B5 | `grant select` on `v_member_balance`/`v_charge_aging`; `create or replace view`; `alter sequence owned by`; year prefix from `issued_on`; enforce `charge_no` NOT NULL after backfill | Low | S | idempotent re-run; grants portable |

### Phase C — Frontend session/data integrity
| # | Task | Sev | Effort | Acceptance |
|---|------|-----|--------|-----------|
| C1 | `queryClient.clear()` on sign-out/auth changed | High | S | user switch shows no stale data |
| C2 | Central query-key factory + invalidate dashboard/debtors/reports/option-hooks on every mutation | Mid | M | after add member, it appears in charge form & dashboard without reload |
| C3 | Redirect `/` → `/dashboard` when authenticated | Mid | S | logged-in `/` lands on dashboard |
| C4 | Surface role-load errors instead of silent `[]`; explicit empty→`['member']` only when verified | Low | S | failures visible in UI |

### Phase D — Consistency / UX (presentation shippable)
| # | Task | Sev | Effort | Acceptance |
|---|------|-----|--------|-----------|
| D1 | Unify money (`minorToMajor` only from `charges/business.ts`) + `formatDate('uk-UA')` shared; remove local copies | Mid | S | grep returns single-source |
| D2 | Translate remaining English UI (members, auth, layout, landing, status) to Ukrainian; `index.html lang="uk"` + description | High | M | uk-only user-facing strings |
| D3 | Implement or un-route placeholder pages (Profile/My-Charges/Admin); delete `placeholder-page` if unused | High | M/L | no `TODO` reachable screens |
| D4 | `useDebouncedSearch` + shared `DataTable`/pagination; report `void all`/`cols` leftovers | Mid | M | 8 pages share primitives |
| D5 | A11y: consistent uk `sr-only`/`aria-label`; enum→label maps in reports | Low | S | screen-reader labels consistent |

### Phase E — Performance & quality
| # | Task | Sev | Effort | Acceptance |
|---|------|-----|--------|-----------|
| E1 | Lazy-load `exceljs`/`jspdf` via `await import()` in export handlers | Mid | S | reports chunk contains no export libs up-front |
| E2 | Server-side pagination for reports/debtors (or export-stream by cursor) | Mid | L | totals exact; preview paged |
| E3 | Dashboard: `order(month desc).limit(12)` + parallel head-counts | Mid | S | single fetch, no client slice |
| E4 | Strict TS (`strict: true`), `supabase gen types`, Vitest for business/validation, `manualChunks` | Low | M/L | `tsc` strict clean; tests green |
| E5 | READMEs, AGENTS.md conventions, CI (lint+build+`checkfiles.mjs`) | Low | M | fresh clone builds & lints |

### Suggested order
**A (1–7) → B (1–5) → C (1–4) → D → E.** Phases A–C are production blockers; D/E are
quality-of-life. Every step is documented per Etap convention (new `docs/` log + `Structure.md` /
`schema`/`sql_migrations.md` sync) and verified with build + lint + SQL-check before commit.

---

## 7. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-09 | Etap 21 — 5-dimension review + refactoring plan | `docs/etap21_reviews.md` | local | review (read-only); refactors pending | — |

*Append one row per environment application and per completed refactor.*