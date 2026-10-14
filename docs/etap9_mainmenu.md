# Etap 9 — Main Menu Navigation · Log & Runbook

Responsive application navigation for GardenPay (React skeleton from Etap 8).

Menu groups: **Main · Registries · Finance · System** — 11 items.

---

## 1. Menu spec

| # | Item | Route | Guard | Icon (lucide-react) | Section |
|---|------|-------|:---:|---|---|
| 1 | Dashboard | `/dashboard` | authenticated | `LayoutDashboard` | Menu |
| 2 | Members | `/members` | admin \| accountant \| viewer | `Users` | Registries |
| 3 | Plots | `/plots` | admin \| accountant \| viewer | `Map` | Registries |
| 4 | Tariffs | `/tariffs` | admin \| accountant \| viewer | `Tags` | Registries |
| 5 | Water Meters | `/water-meters` | admin \| accountant \| viewer | `Droplets` | Registries |
| 6 | Electricity Meters | `/electricity-meters` | admin \| accountant \| viewer | `Zap` | Registries |
| 7 | Charges | `/charges` | admin \| accountant | `ReceiptText` | Finance |
| 8 | Payments | `/payments` | admin \| accountant | `CreditCard` | Finance |
| 9 | Debtors | `/debtors` | admin \| accountant | `UserMinus` | Finance |
| 10 | Reports | `/reports` | admin \| accountant | `BarChart3` | Finance |
| 11 | Settings | `/settings` | admin only | `Settings` | System |

Secondary (not in menu, always available): **My profile** `/me`, **My charges** `/me/bills`
via the UserMenu dropdown.

> Route rename: former `/billing` → `/charges`. No live links depend on the old path.

---

## 2. Data model

`src/config/navigation.ts`

- `NavItem` — `{ title, href, allow: RoleCode[], icon: LucideIcon }`
- `NavSection` — `{ id, label, items }` (grouping headers)
- Role sets — `ALL_ROLES`, `READER_ROLES`, `FINANCE_ROLES`, `ADMIN_ROLES`
  (`admin`→`administrator`, `accountant`, `viewer`; matches `etap7_rls.md`)
- `filterNavSections(roles)` — drops disallowed items and empty sections

Authorization rules live in the **route guards** (`RequireRole`, RLS below); the menu filter is
cosmetic only — a user could still type a URL, the guard will reject (→ `/403`).

---

## 3. Responsive sidebar

| Breakpoint | Behavior |
|---|---|
| `lg` and up (≥1024px) | fixed sidebar `w-64` (`hidden … lg:flex`), content offset `lg:pl-64` |
| `< lg` (mobile/tablet) | sidebar hidden; hamburger in the Topbar opens a `Sheet` drawer (side=left, auto-closes on navigation) |

Implementation (`src/components/layout/`):

- `nav-items.tsx` — shared, renders grouped sections; reused by both the fixed sidebar and the
  mobile drawer (`onNavigate` closes the drawer).
- `sidebar.tsx` — desktop-only shell (brand + `NavItems`).
- `topbar.tsx` — mobile menu trigger (`<Sheet>`), self-close button, brand on small screens.
- `app-layout.tsx` — interplay: `flex` column, `lg:pl-64` offset; main keeps `p-4 lg:p-6`.

---

## 4. Files changed / added (Etap 9)

| File | Change |
|---|---|
| `web/src/config/navigation.ts` | rewritten: sections + icons + `filterNavSections` |
| `web/src/components/layout/nav-items.tsx` | **new** — shared grouped menu |
| `web/src/components/layout/sidebar.tsx` | responsive (`hidden lg:flex`) |
| `web/src/components/layout/topbar.tsx` | mobile `Sheet` drawer trigger |
| `web/src/components/layout/app-layout.tsx` | `lg:pl-64` offset |
| `web/src/app/router.tsx` | routes: `/charges` (renamed), `/water-meters`, `/electricity-meters`, `/debtors`; `/meters` removed |
| `web/src/features/meters/pages/water-meters-page.tsx` | **new** placeholder |
| `web/src/features/meters/pages/electricity-meters-page.tsx` | **new** placeholder |
| `web/src/features/debtors/pages/debtors-page.tsx` | **new** placeholder |
| `web/src/features/meters/pages/meters-page.tsx` | deleted (superseded) |

---

## 5. Verification (runbook)

| # | Command / check | Expected |
|---|-----------------|----------|
| V1 | `npm run build` | passes, 0 TS errors |
| V2 | `npm run lint` | no errors (cosmetic fast-refresh warnings allowed) |
| V3 | dev server → `GET /charges`, `/debtors`, `/water-meters`, `/electricity-meters`, `/settings` | `200` |
| V4 | resize to `<1024px` | hamburger appears; drawer opens left; navigation auto-closes |
| V5 | resize to `≥1024px` | fixed sidebar shown; content offset resets |
| V6 | login as viewer | menu hides Charges/Payments/Debtors/Reports, even though URL `/charges` → guard → `/403` |
| V7 | active item highlight on current route | yes; `end` on `/dashboard` |

---

## 6. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-08 | Etap 9 — 11-item grouped main menu + responsive sidebar (desktop fixed / mobile drawer) | §4 list | local | verified (build/lint/routes) | — |

*Append one row per environment application (local → staging → production).*