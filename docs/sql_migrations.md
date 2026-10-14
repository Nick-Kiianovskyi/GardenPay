# SQL Migrations — Log & Runbook

GardenPay database migrations, compatible with the **Supabase CLI** migration workflow
(`supabase/migrations/*.sql`, applied in filename order, tracked in `supabase_migrations.schema_migrations`).

Source of truth for the design: [`Structure.md`](../Structure.md) · Entity model: [`docs/er-model.md`](er-model.md)

---

## 1. File inventory

| # | File | Contents |
|---|------|----------|
| 1 | `supabase/migrations/20261008000001_extensions_and_base_functions.sql` | `pgcrypto`, `btree_gist`, `set_updated_at()` trigger function |
| 2 | `20261008000002_core_identity_and_plots.sql` | `users`, `roles`, `user_roles`, `members`, `plots`, `plot_assignments` — PKs, FKs, indexes, CHECK constraints, `updated_at` triggers |
| 3 | `20261008000003_contributions_tariffs_and_meters.sql` | `contribution_types`, `tariffs` (exclusion constraint), `water_meters`, `electricity_meters`, `*_meter_readings`, monotonic-reading trigger |
| 4 | `20261008000004_charges_payments_and_views.sql` | `charges` (generated `amount_minor`), `payments`, charge-no sequence, payment↔charge sync trigger, views `v_member_balance`, `v_charge_aging` (`security_invoker`) |
| 5 | `20261008000005_rls_policies.sql` | RLS enabled on all 14 tables, helper functions (`has_role`, `is_board`, `current_member_id`), 29 policies, execute grants |
| 6 | `20261008000006_seed_data.sql` | 6 roles, 6 contribution types (idempotent `on conflict do nothing`) |
| 7 | `20261008000007_roles_accountant_viewer.sql` | Roles `accountant`/`viewer`, helpers `is_admin()`/`is_accountant()`, MFA-gated finance write policies — see [`authentication.md`](authentication.md) §9 |
| 8 | `20261008000008_plots_owner_and_notes.sql` | `plots.owner_id` (denormalized current owner) + `plots.notes`, `plots_owner_idx`, `plots_owner_sync` trigger keeping `plot_assignments` history in sync |
| 9 | `20261008000009_water_meter_readings_view.sql` | `v_water_meter_readings` view — per-reading `previous_m3` (window `lag`) + `consumption_m3` (current − previous); `security_invoker` |
| 10 | `20261008000010_electricity_meter_readings_view.sql` | `v_electricity_meter_readings` view — per-reading `previous_kwh` + `consumption_kwh`; `security_invoker` |
| 11 | `20261008000011_debt_views.sql` | Debt = Charges − Payments: views `v_debt_by_member`, `v_debt_by_plot`, `v_debt_by_service`, `v_debt_overall` (`security_invoker`) |
| 12 | `20261008000012_financial_report_views.sql` | Financial report views `v_financial_summary`, `v_charges_by_status`, `v_payments_by_method`, `v_monthly_finance` (`security_invoker`) |

Every file was syntax-validated with `libpg-query` (the real PostgreSQL parser).

---

## 2. Prerequisites

```bash
npm i -g supabase          # Supabase CLI
supabase --version         # >= 1.x
```

- Project initialized once: `supabase init` (creates `supabase/config.toml` — commit it if missing).
- Local stack: Docker running.
- Postgres **15+** (required for `security_invoker` views).

---

## 3. Execution steps (runbook log)

### A. Local development

| Step | Command | Expected result |
|------|---------|-----------------|
| 1 | `supabase start` | Containers up; prints URL + DB connection string |
| 2 | `supabase db reset` | Drops/recreates local DB, applies **all 7 migrations in order**, runs seeds |
| 3 | `supabase migration list` | 6 rows, all marked `Applied` (no local/remote drift) |

### B. Create the next migration

| Step | Command | Note |
|------|---------|------|
| 1 | `supabase migration new <descriptive_name>` | Creates `supabase/migrations/<timestamp>_<name>.sql` |
| 2 | Edit the generated file | Additive DDL only (see §6 rules) |
| 3 | `supabase db reset` | Re-runs everything on a clean local DB |
| 4 | Run verification checklist (§4) | |
| 5 | Commit file + append row to §7 changelog | |

### C. Deploy to a linked (hosted) project

| Step | Command | Note |
|------|---------|------|
| 1 | `supabase link --project-ref <ref>` | One-time; creates `supabase/.temp` (gitignored) |
| 2 | `supabase migration list` | Shows local vs. remote drift — must be clean before push |
| 3 | `supabase db push` | Uploads unapplied migrations in order |
| 4 | `supabase migration list` | Confirm all `Applied` on remote |
| 5 | Run verification checklist (§4) against remote | `psql` from Dashboard → SQL Editor |

### D. Rollback / repair

Supabase has no automatic `down` migrations.

| Situation | Action |
|-----------|--------|
| Migration failed mid-way | Fix the file **only if it was never recorded as applied**; otherwise write a new corrective migration |
| Applied but broken | `supabase migration repair --status reverted <version>` then re-push after fixing |
| Destructive rollback needed | Write a compensating forward migration (drop/recreate objects); never hand-edit applied files |

---

## 4. Verification checklist (after every apply)

```sql
-- 14 tables present
select table_name from information_schema.tables
 where table_schema = 'public'
 order by table_name;
-- expect: charges, contribution_types, electricity_meter_readings, electricity_meters,
--         members, payments, plots, plot_assignments, roles, tariffs,
--         user_roles, users, water_meter_readings, water_meters

-- all tables have RLS enabled
select relname, relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and not relrowsecurity;
-- expect: 0 rows

-- policies count (expect 29)
select count(*) from pg_policies where schemaname = 'public';

-- key indexes exist
select indexname from pg_indexes
 where schemaname = 'public'
   and indexname in ('plot_assignments_active_uk', 'water_meters_active_plot_uk',
                     'electricity_meters_active_plot_uk', 'members_email_uk',
                     'charges_status_due_idx');
-- expect: 5 rows

-- exclusion constraint on tariffs
select conname from pg_constraint where conname = 'tariffs_no_overlap';

-- generated column works
insert into members (member_no, first_name, last_name)
values ('TEST-1', 'Test', 'Member');
insert into contribution_types (code, name, kind, billing_mode)
values ('test_fee', 'Test fee', 'other', 'periodic');
insert into tariffs (contribution_type_id, name, amount_minor, valid_from)
select id, 'test', 1000, date '2026-01-01' from contribution_types where code = 'test_fee';
insert into charges (member_id, contribution_type_id, tariff_id, quantity, unit_price_minor)
select m.id, c.id, t.id, 2, 500
  from members m, contribution_types c, tariffs t
 where m.member_no = 'TEST-1' and c.code = 'test_fee';
select charge_no, amount_minor from charges where charge_no is not null;
-- expect: amount_minor = 1000 (2 x 500), charge_no like '2026-%'

-- rollback of smoke data
delete from charges where charge_no is not null;
delete from tariffs where name = 'test';
delete from contribution_types where code = 'test_fee';
delete from members where member_no = 'TEST-1';
```

Supabase-specific checks (Dashboard → Authentication / Database):

1. **Table Editor**: all 14 tables visible, RLS toggle ON (yellow).
2. **Policies** tab: 29 policies listed.
3. Sign up a test user → confirm `auth.users` row + `public.users` row (if your signup trigger/backfill exists; otherwise insert `public.users` manually).
4. Call `select public.has_role('board');` as `authenticated` → `false` for a fresh user (no roles assigned).

---

## 5. Post-migration application steps

1. **Assign roles** (no seed grants admin — by design):
   ```sql
   insert into user_roles (user_id, role_code)
   select u.id, 'admin' from users u where u.email = 'you@example.com'
   on conflict do nothing;
   ```
2. **Confirm grants**: Supabase applies default privileges (`anon`, `authenticated`, `service_role` → all tables) automatically; migrations rely on this. Custom roles/grants are not required unless you change `default privileges`.
3. **Auth trigger** (if not present): create a `auth.users` → `public.users` sync trigger or populate `public.users` from your onboarding flow.
4. **Edge Functions**: `invoice-generation` (charge creation from readings/tariffs) is not part of these migrations — see `docs/architecture.md` §4.

---

## 6. Migration rules

1. Files are **append-only** once committed/applied — never edit an applied migration.
2. Timestamped filenames (`YYYYMMDDHHMMSS_name.sql`) — order = execution order.
3. **Additive first**: new columns nullable or with defaults; backfills in a separate migration.
4. Every new table: PK, FKs, `created_at`/`updated_at`, indexes for FK columns, RLS enabled + policies (a later migration).
5. Money: `bigint *_minor` only. Never `float`/`double precision` for money or meter quantities.
6. Validate locally with `supabase db reset` + §4 checklist **before** `db push`.
7. Seed data must be idempotent (`on conflict do nothing`).

---

## 7. Changelog

| Date | Migration version | Files | Environment | Status | Applied by |
|------|-------------------|-------|-------------|--------|------------|
| 2026-10-08 | `20261008000001` – `20261008000006` | initial schema (6 files) | local (pending remote) | syntax-validated | — |
| 2026-10-08 | `20261008000007` | roles accountant/viewer + policy changes (net policy count 29) | local (pending remote) | syntax-validated | — |

*Append one row per `db push` / applied batch: date, version range, environment (`local` / `staging` / `production`), status, operator.*
