# GardenPay

**GardenPay** is a web-based accounting system for a garden (allotment) association: a registry of plots and members, tariffs, meters, charges, contributions, payments, debtors and reports — all in one place.

> 🟢 **Production (Live):** https://garden-pay-seven.vercel.app/

---

## About

GardenPay automates the routine of a garden association — from keeping the registry to financial accounting and reporting. The system runs on **Supabase (PostgreSQL + Auth + RLS)** with a **React SPA** (Vite) on the frontend. All data access is protected by Row Level Security and a role-based model.

Key principles:
- Money is stored in minor units (`bigint *_minor`) — no floating point.
- Meter readings are exact `numeric(12,3)`.
- Financial documents (charges/payments) are immutable — corrections are made with compensating rows.
- Business rules are enforced at the database level (triggers, constraints, unique indexes).
- All validation messages and the interface are in Ukrainian.

---

## Features

**Authentication & access**
- Sign-in via Supabase Auth (email/password), password recovery and reset.
- Route guards by role (`RequireAuth`, `RequireRole`, `Can`).
- Member self-service account (`Profile`, `My bills`).

**Registries**
- **Members** — name, contacts, kind, status, membership dates.
- **Plots** — number, area, zone, soil type, status, owner; assignment history (`plot_assignments`).
- **Contribution types** — billing mode (`periodic` / `metered` / `manual`), meter kind.
- **Tariffs** — full history with validity windows, no overlaps, automatic resolution of the current tariff.

**Meters**
- Water and electricity meters, readings with a monotonic sequence.
- Reading submission, consumption calculation (current − previous) via SQL views.

**Finance**
- **Charges** — individual documents with a tariff snapshot (quantity × price), auto number `YYYY-NNNNNN`, status lifecycle.
- **Mass accrual** — bulk generation of charges for all active plots with a preview (see below).
- **Payments** — bank/cash/card/SEPA, manual and automatic settling of charges, overpayment becomes member credit.
- **Debtors** — debt aggregation by member/plot/service plus drill-down.
- **Reports** — financial summaries, monthly dynamics, breakdown by status/method + **export to Excel (`exceljs`) and PDF (`jspdf` + `jspdf-autotable`)**.

**Administration**
- User and role management, settings.
- A page to verify the Supabase integration.

---

## Mass accrual

A dedicated page (route `/accruals/mass`, "Finance" section), available to the administrator and accountant.

1. The user selects a **contribution type** and a **period** (from/to).
2. Clicks **"Calculate"** → the system builds a preview for all **active (allocated) plots** and shows a table: *Plot · Owner · Contribution type · Period · Amount*.
3. Clicks **"Save charges"** → rows are inserted into the `charges` table.

The calculation depends on the contribution type's billing mode:
- `periodic` (membership fee, plot rent) — **plot area in sotka (`area_m2 / 100`) × the tariff effective at the start of the period**;
- `metered` (water/electricity) — **consumption from readings within the period × the tariff on the reading date**;
- `manual` (penalty/special levy) — a fixed amount applied to every plot.

**The preview writes nothing to the database** (read-only). Plots without an owner, tariff or readings are listed in the "Skipped" block with a reason.

---

## Tech stack

**Frontend**
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 8](https://vite.dev/) — build tool and dev server
- [React Router 7](https://reactrouter.com/) — routing (lazy-loaded pages)
- [TanStack Query 5](https://tanstack.com/query) — server state and caching
- [React Hook Form](https://react-hook-form.com/) + [Zod 4](https://zod.dev/) — forms and validation
- [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) on [Radix UI](https://www.radix-ui.com/) — UI components
- [lucide-react](https://lucide.dev/) — icons, [Recharts](https://recharts.org/) — charts, [sonner](https://sonner.emilkowal.ski/) — toasts
- [exceljs](https://github.com/exceljs/exceljs), [jspdf](https://github.com/parallax/jsPDF) — report export
- [@fontsource-variable/geist](https://fontsource.org/) — font

**Backend / data**
- [Supabase](https://supabase.com/) — PostgreSQL 15+, Auth, Row Level Security
- SQL migrations (`supabase/migrations`) — schema, triggers, views, policies

**Tooling & deployment**
- [oxlint](https://oxc.rs/) — linter
- Vercel — frontend hosting
- npm — package manager

---

## Repository structure

```
GardenPay/
├── docs/                 # staged technical docs (architecture, auth, RLS, modules)
├── supabase/
│   ├── migrations/       # SQL migrations 0001–0012 (schema, views, RLS, seed)
│   ├── rls_policies_3roles.sql
│   └── seed.sql          # demo data (24 plots, members, tariffs, readings)
├── web/                  # React SPA
│   ├── src/
│   │   ├── app/          # router, providers
│   │   ├── components/   # layout · shared · ui (shadcn)
│   │   ├── config/       # navigation and role constants
│   │   ├── features/     # feature modules (see below)
│   │   ├── lib/          # supabase client, utilities
│   │   ├── types/        # types (roles, database)
│   │   └── validation/   # zod schemas
│   ├── .env.example
│   └── package.json
├── Structure.md          # detailed DB schema & business rules
├── README.md             # bilingual index
├── README_UK.md          # Ukrainian
└── README_EN.md          # English (this file)
```

**Modules in `web/src/features/`:** `auth`, `landing`, `dashboard`, `profile`, `billing` (my bills), `members`, `plots`, `contribution-types`, `tariffs`, `meters` (water/electricity), `charges` (+ `mass-accrual`), `payments`, `debtors`, `reports`, `admin` (users/roles/settings), `integration`, `misc`.

---

## Database

**Core tables:** `users`, `roles`, `user_roles`, `members`, `plots`, `plot_assignments`, `contribution_types`, `tariffs`, `water_meters`, `electricity_meters`, `water_meter_readings`, `electricity_meter_readings`, `charges`, `payments`.

**Analytics views (RLS-aware, `security_invoker`):** `v_member_balance`, `v_charge_aging`, `v_water_meter_readings`, `v_electricity_meter_readings`, `v_debt_by_member`, `v_debt_by_plot`, `v_debt_by_service`, `v_debt_overall`, `v_financial_summary`, `v_charges_by_status`, `v_payments_by_method`, `v_monthly_finance`.

**Business rules enforced at the DB level (selected):**
- One active assignment and one active meter per plot (partial unique indexes).
- Meter readings never decrease (trigger).
- Tariff validity windows never overlap (GiST exclusion, `btree_gist`).
- Charge amount = `quantity × unit_price_minor` (generated column).
- Charge status automatically tracks payments (trigger).
- One document per reading (XOR + unique), auto number `YYYY-NNNNNN`.

See [`Structure.md`](./Structure.md) and [`docs/`](./docs) for details.

---

## Roles & access

| Role | Purpose |
|---|---|
| **Administrator** | Full access: users, roles, registries, settings |
| **Accountant** | Charges, payments, reports and exports (writing to finance requires MFA / `aal2`) |
| **Viewer** | Read-only access to association data |
| **Member** | Self-service: own profile and own bills |

Access is implemented via Supabase RLS policies and the helpers `is_admin()`, `is_accountant()`, `has_role()`, `current_member_id()`. Navigation is filtered by role.

---

## Quick start (local)

**Requirements:** Node.js 20+ (LTS 22 recommended) and a Supabase project.

```bash
# 1. Clone the repository
git clone git@github.com:Nick-Kiianovskyi/GardenPay.git
cd GardenPay/web

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 4. Start the dev server
npm run dev
```

`web/.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com/).
2. Apply the SQL migrations in `supabase/migrations/` **in numeric order** (0001 → 0012), via the SQL Editor or the [Supabase CLI](https://supabase.com/docs/guides/cli).
3. (Optional) Load the demo data from `supabase/seed.sql`.
4. Optionally generate types: `supabase gen types typescript ... > web/src/types/database.ts`.

> Row Level Security is enabled on all tables — access is determined by the user's roles.

---

## Scripts (`web/`)

| Command | Action |
|---|---|
| `npm run dev` | Local dev server (Vite) |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint with oxlint |

---

## Deployment

The frontend is deployed on **Vercel**:
- Root Directory: `web`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Live:** https://garden-pay-seven.vercel.app/

---

## Documentation

The [`docs/`](./docs) folder contains staged technical documentation: architecture, authentication, the ER model, RLS, SQL migrations, as well as per-module runbook logs (plots, contribution types, tariffs, meters, charges, payments, debt, reports).
