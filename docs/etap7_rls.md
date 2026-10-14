# Etap 7 — RLS Policies (Supabase) · Log & Runbook

Consolidated Row Level Security for the **3-role model**
(**Administrator · Accountant · Viewer**) on all 14 application tables.

Script: [`supabase/rls_policies_3roles.sql`](../supabase/rls_policies_3roles.sql)
Roles seed: `administrator`, `accountant`, `viewer` (legacy `admin`/`treasurer`/`board` are folded into
the helpers for backward compatibility — see §2).

---

## 1. Role → permission model

| Table | Administrator | Accountant | Viewer | Member (self) |
|---|:---:|:---:|:---:|:---:|
| `users` | RW (+ delete) | — | — | read/update own |
| `roles`, `user_roles` | RW | — | — | read own grants |
| `members` | RW | read | read | read/update own |
| `plots` | RW | read | read | read |
| `plot_assignments` | RW | read | read | own history |
| `contribution_types` | RW | read | read | read |
| `tariffs` | RW | read | read | read |
| `water_meters`, `electricity_meters` | RW | read | read | read |
| `*_meter_readings` | RW | read | read | read |
| `charges` | RW | read + **write (MFA)** | read | own |
| `payments` | RW | read + **write (MFA)** | read | own |

- **Viewer**: strictly read-only — no INSERT/UPDATE/DELETE policy exists for it anywhere.
- **Accountant**: financial write is gated on MFA (`auth.jwt()->>'aal' = 'aal2'`); members are
  read-only for the Accountant (people management stays with Administrator).
- **Administrator**: full `for all` on every table (finance writes bypass the MFA gate).

Total: **31 policies** across 14 tables (all `permissive`, OR-combined).

---

## 2. Helpers & legacy mapping

| Function | Resolves to role(s) |
|---|---|
| `has_role(p_role)` | exact code from `user_roles`, honoring `expires_at` |
| `is_admin()` | `administrator` **or** legacy `admin` |
| `is_accountant()` | `accountant` **or** legacy `treasurer` |
| `current_member_id()` | `members.id` for `auth.uid()` |

> The script drops all policies created by migrations 5 and 7 and replaces them with the
> consolidated set. It does **not** delete legacy role rows; it only maps them.
> To clean legacy codes later: `delete from user_roles where role_code in ('admin','treasurer');`
> **after** confirming no account depends on them.

---

## 3. Execution steps (runbook log)

Prerequisites:
- Migrations 1–7 applied (tables exist; `supabase init` done).
- Applied **after** migration 7 — or standalone on any superset DB (all statements are
  `drop policy if exists` + `create policy`).

| Step | Action | Command / where | Expected |
|------|--------|-----------------|----------|
| A1 | Apply locally | `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/rls_policies_3roles.sql` | no errors; 31 policies created |
| A2 | Verify count | `select count(*) from pg_policies where schemaname='public';` | `31` |
| A3 | Verify names | `select tablename, count(*) as policies from pg_policies where schemaname='public' group by 1 order by 1;` | all 14 tables listed |
| B1 | Apply on hosted project | Supabase Dashboard → SQL Editor → paste file → **Run** | "Success. No rows returned" per statement block |
| B2 | Re-verify count remotely | same query as A2 | `31` |
| C1 | Production guardrails | run in a maintenance window; `BEGIN` … review … `COMMIT` | record in §6 changelog |

Idempotency: re-running the script is safe (all policies re-dropped then re-created).

---

## 4. Per-role smoke tests (as a specific user)

Postgres evaluates RLS against the session claims; simulate directly:

```sql
-- prepare a fixture user + roles (replace uuid with a real auth.users id)
insert into users (id, email, full_name) values
  ('<user-uuid>', 'test@example.test', 'Test User');
insert into members (user_id, member_no, first_name, last_name)
  values ('<user-uuid>', 'T-0001', 'Test', 'User');
insert into user_roles (user_id, role_code) values
  ('<user-uuid>', 'accountant');

-- TEST ACCOUNTANT (role + MFA session aal2)
begin;
  set local role authenticated;
  set local request.jwt.claims =
        '{"sub":"<user-uuid>","role":"authenticated","aal":"aal2"}';
  select count(*) from members;      -- expect: rows (Accountant may read)
  select count(*) from charges;      -- expect: rows
  insert into payments (member_id, charge_id, amount_minor, method)
    select id, (select id from charges limit 1), 100, 'cash'
      from members where user_id = auth.uid();
  -- expect: inserted (1 row)
rollback;

-- TEST ACCOUNTANT WITHOUT MFA -> write must fail
begin;
  set local role authenticated;
  set local request.jwt.claims =
        '{"sub":"<user-uuid>","role":"authenticated","aal":"aal1"}';
  insert into payments (member_id, charge_id, amount_minor, method)
    select id, (select id from charges limit 1), 100, 'cash'
      from members where user_id = auth.uid();
  -- expect: ERROR: new row violates row-level security policy
rollback;

-- TEST VIEWER -> read ok, write denied
insert into user_roles (user_id, role_code) values ('<user-uuid>', 'viewer');
delete from user_roles where user_id = '<user-uuid>' and role_code = 'accountant';
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
  select count(*) from tariffs;      -- expect: rows
  update members set phone = 'x' where user_id = auth.uid();
  -- expect: ERROR: new row violates row-level security policy
rollback;

-- TEST ADMINISTRATOR -> full access
insert into user_roles (user_id, role_code) values ('<user-uuid>', 'administrator');
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
  delete from members where member_no = 'T-0001';  -- expect: 1 row deleted
rollback;
```

Cleanup fixture:

```sql
-- the insert above is inside a rolled-back txn -> only orphan rows remain; remove if created:
delete from user_roles where user_id = '<user-uuid>';
delete from members where member_no = 'T-0001';
```

---

## 5. Audit queries

```sql
-- every policy with its role conditions
select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public'
 order by tablename, cmd;

-- tables WITHOUT any select policy for Viewer (should be none among business tables)
select t.tablename
  from pg_tables t
  left join pg_policies p
         on p.schemaname = 'public' and p.tablename = t.tablename
        and p.cmd = 'SELECT'
        and (p.roles = '{authenticated}' or p.roles = '{public}')
 where t.schemaname = 'public' and t.tablename not in ('_prisma_migrations')
   and t.tablename != 'users'
 group by t.tablename
having count(p.policyname) = 0;
```

---

## 6. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-08 | Etap 7 consolidated 3-role RLS (31 policies / 14 tables) | `supabase/rls_policies_3roles.sql` | local | syntax-validated, pending apply | — |

*Append one row per environment application (local → staging → production).*