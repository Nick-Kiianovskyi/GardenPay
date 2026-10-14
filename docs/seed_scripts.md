# Seed Scripts — Log & Runbook

Sample data for **Members, Plots, Tariffs, Contribution Types**.

Script: [`supabase/seed.sql`](../supabase/seed.sql) · Design: [`Structure.md`](../Structure.md) · Migrations: [`sql_migrations.md`](sql_migrations.md)

---

## 1. Contents (70 records)

| Entity | Records | Key columns | Idempotency key |
|--------|---------|-------------|-----------------|
| `contribution_types` | 8 | code, kind, billing_mode, meter_kind | `code` (`on conflict do nothing`) |
| `plots` | 24 | plot_no A‑01…F‑04, area_m2 150–650, zone, soil_type, status (all 4 states) | `plot_no` |
| `members` | 24 | member_no M‑0001…M‑0024, names, emails, kind (full/tenant/associate/honorary), status (active/pending/suspended/lapsed) | `member_no` |
| `tariffs` | 14 | price history per type + unit (`fixed`, `m2`, `m3`, `kwh`, `hour`), non‑overlapping validity windows | `(contribution_type_id, unit, valid_from)` |

Data properties exercised:

- 2 tariff generations per priced type (2020‑2024 vs. 2025+) — validates the `tariffs_no_overlap` exclusion constraint.
- All `plot.status`, `member.status`, `member.kind` CHECK values covered.
- Money values are **integer minor units** (e.g. `2500` = €25.00).
- Deterministic data → `db reset` twice yields identical state.

---

## 2. Prerequisites

```bash
supabase --version        # CLI installed
supabase init             # once per repo (creates supabase/config.toml)
```

Confirm `supabase/config.toml`:

```toml
[db.seed]
sql_paths = ["./seed.sql"]
```

(The default after `supabase init` points at `./seed.sql`.)

Migrations `20261008000001`–`0006` must be applied first — seeds run **after** migrations.

---

## 3. Execution steps (runbook log)

### A. Standard path — local reset

| Step | Action | Command | Expected result |
|------|--------|---------|-----------------|
| 1 | Start stack | `supabase start` | Containers healthy |
| 2 | Reset DB | `supabase db reset` | Migrations 1–6 applied, then `seed.sql` runs without errors |
| 3 | Verify counts | SQL in §4 | `8 / 24 / 24 / 14` |
| 4 | Verify idempotency | `supabase db reset` again | Same counts, no unique/exclusion violations |

### B. Manual path — run seeds only (existing DB)

| Step | Action | Command |
|------|--------|---------|
| 1 | Apply seeds | `psql "$SUPABASE_DB_URL" -f supabase/seed.sql` |
| 2 | Verify | §4 checklist |

or via **Dashboard → SQL Editor**: paste `supabase/seed.sql` → **Run** (safe: idempotent).

### C. Append/refresh data later

| Step | Action | Note |
|------|--------|------|
| 1 | Edit `supabase/seed.sql` (or a new `supabase/seeds/<name>.sql`) | Re-running only **inserts missing rows** — it never updates existing ones |
| 2 | Apply (§B) | |
| 3 | For changed values of already-seeded rows, use explicit `update ... where member_no = '...'` | Document such statements in §6 changelog |

---

## 4. Verification checklist

```sql
-- 1) record counts (expect: 8, 24, 24, 14)
select 'contribution_types' as entity, count(*) from contribution_types
union all select 'plots',   count(*) from plots
union all select 'members', count(*) from members
union all select 'tariffs', count(*) from tariffs
order by entity;

-- 2) tariff coverage per type + unit
select ct.code, t.unit, count(*) as versions,
       min(t.valid_from) as first_valid, max(coalesce(t.valid_to, '9999-12-31')) as last_valid
  from tariffs t
  join contribution_types ct on ct.id = t.contribution_type_id
 group by ct.code, t.unit
 order by ct.code, t.unit;

-- 3) no invalid validity windows (expect 0)
select count(*) from tariffs where valid_to is not null and valid_to <= valid_from;

-- 4) member kind/status distribution
select kind, status, count(*) from members group by kind, status order by kind, status;

-- 5) plot status distribution (expect all 4 states present)
select status, count(*) from plots group by status;

-- 6) referential sanity: every tariff points at a contribution type (expect 0)
select count(*) from tariffs t
  left join contribution_types ct on ct.id = t.contribution_type_id
 where ct.id is null;
```

Negative test (constraint proof — each statement should fail on its own; run them separately):

```sql
-- duplicate plot -> unique violation
insert into plots (plot_no, area_m2) values ('A-01', 100);

-- overlapping tariff -> exclusion violation
insert into tariffs (contribution_type_id, name, unit, amount_minor, valid_from, valid_to)
select id, 'bad', 'm3', 100, date '2025-06-01', date '2025-12-31'
  from contribution_types where code = 'water';
```

---

## 5. Notes & limitations

1. **No auth users**: `members.user_id` is `null` for all seed rows. To test RLS as a member, create an auth user (Dashboard → Authentication → Users), ensure the matching `public.users` profile row exists (signup trigger or manual insert), then:
   ```sql
   update members set user_id = '<auth-user-uuid>' where member_no = 'M-0001';
   insert into user_roles (user_id, role_code) values ('<auth-user-uuid>', 'member');
   ```
2. **No plot assignments / charges / payments**: outside the requested scope. `plot.status = 'allocated'` is illustrative; a later seed can add `plot_assignments`, metered readings, charges and payments to exercise the billing flow.
3. **Never run dev seeds against production** — or if used for a demo environment, record it in §6.
4. Seed rows are protected by the same FKs/CHECKs as live data; a failing seed indicates a schema problem.

---

## 6. Changelog

| Date | Script | Records | Environment | Status | Run by |
|------|--------|---------|-------------|--------|--------|
| 2026-10-08 | `supabase/seed.sql` (initial) | 70 (8/24/24/14) | local | syntax-validated | — |

*Append one row per seed application/extension: date, script, record count, environment, status, operator.*
