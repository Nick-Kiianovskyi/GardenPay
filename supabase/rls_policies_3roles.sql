-- ============================================================
-- GardenPay | Etap 7 — Row Level Security (consolidated, 3 roles)
-- Roles:
--   Administrator (admin)   : FULL access (all tables, all operations)
--   Accountant (accountant) : read members; manage charges + payments
--   Viewer (viewer)         : read-only on all association data
-- Plus member self-service access to own records.
--
-- Self-contained policy set: applies ON TOP of migrations 1-7
-- (idempotent: every pre-existing policy is dropped first).
-- Run via: psql -f supabase/rls_policies_3roles.sql
-- Log & steps: docs/etap7_rls.md
-- ============================================================

-- ------------------------------------------------------------
-- 0. Enable RLS (idempotent)
-- ------------------------------------------------------------
alter table users                      enable row level security;
alter table roles                      enable row level security;
alter table user_roles                 enable row level security;
alter table members                    enable row level security;
alter table plots                      enable row level security;
alter table plot_assignments           enable row level security;
alter table contribution_types         enable row level security;
alter table tariffs                    enable row level security;
alter table water_meters               enable row level security;
alter table electricity_meters         enable row level security;
alter table water_meter_readings       enable row level security;
alter table electricity_meter_readings enable row level security;
alter table charges                    enable row level security;
alter table payments                   enable row level security;

-- ------------------------------------------------------------
-- 1. Role codes (idempotent)
-- ------------------------------------------------------------
insert into roles (code, name, description, is_system) values
  ('administrator', 'Administrator', 'Full access to all data and functions', true),
  ('accountant',    'Accountant',    'Reads members; manages charges and payments', true),
  ('viewer',        'Viewer',        'Read-only access to association data', true)
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER, stable)
-- ------------------------------------------------------------
create or replace function public.has_role(p_role text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
      from user_roles ur
     where ur.user_id = auth.uid()
       and ur.role_code = p_role
       and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('administrator') or public.has_role('admin');
$$;

create or replace function public.is_accountant() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('accountant') or public.has_role('treasurer');
$$;

create or replace function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where user_id = auth.uid();
$$;

revoke execute on function public.has_role(text)       from public, anon;
revoke execute on function public.is_admin()           from public, anon;
revoke execute on function public.is_accountant()      from public, anon;
revoke execute on function public.current_member_id()  from public, anon;
grant  execute on function public.has_role(text)       to authenticated, service_role;
grant  execute on function public.is_admin()           to authenticated, service_role;
grant  execute on function public.is_accountant()      to authenticated, service_role;
grant  execute on function public.current_member_id()  to authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Drop legacy policies (from migrations 5 + 7)
-- ------------------------------------------------------------
drop policy if exists users_select_self_or_board on users;
drop policy if exists users_update_self_or_admin on users;
drop policy if exists roles_select on roles;
drop policy if exists user_roles_select on user_roles;
drop policy if exists user_roles_write_admin on user_roles;

drop policy if exists members_select_own_or_board on members;
drop policy if exists members_insert_board on members;
drop policy if exists members_insert_admin on members;
drop policy if exists members_update_own_or_board on members;
drop policy if exists members_update_own_or_admin on members;
drop policy if exists members_delete_admin on members;

drop policy if exists plots_select_authenticated on plots;
drop policy if exists plots_write_board on plots;
drop policy if exists plots_write_admin on plots;

drop policy if exists plot_assignments_select on plot_assignments;
drop policy if exists plot_assignments_write_board on plot_assignments;
drop policy if exists plot_assignments_write_admin on plot_assignments;

drop policy if exists contribution_types_select on contribution_types;
drop policy if exists contribution_types_write_board on contribution_types;
drop policy if exists contribution_types_write_admin on contribution_types;

drop policy if exists tariffs_select on tariffs;
drop policy if exists tariffs_write_board on tariffs;
drop policy if exists tariffs_write_admin on tariffs;

drop policy if exists water_meters_select on water_meters;
drop policy if exists water_meters_write on water_meters;

drop policy if exists electricity_meters_select on electricity_meters;
drop policy if exists electricity_meters_write on electricity_meters;

drop policy if exists water_readings_select on water_meter_readings;
drop policy if exists water_readings_write on water_meter_readings;

drop policy if exists electricity_readings_select on electricity_meter_readings;
drop policy if exists electricity_readings_write on electricity_meter_readings;

drop policy if exists charges_select_own_or_finance on charges;
drop policy if exists charges_write_treasurer on charges;
drop policy if exists charges_write_accountant on charges;

drop policy if exists payments_select_own_or_finance on payments;
drop policy if exists payments_write_treasurer on payments;
drop policy if exists payments_write_accountant on payments;

-- ------------------------------------------------------------
-- 4. USERS  (Administrator: full; user: self-service)
-- ------------------------------------------------------------
create policy users_select on users
  for select using (id = auth.uid() or public.is_admin());

create policy users_insert_admin on users
  for insert with check (public.is_admin());

create policy users_update on users
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy users_delete_admin on users
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 5. ROLES & USER_ROLES  (Administrator: full; user: own grants)
-- ------------------------------------------------------------
create policy roles_select on roles
  for select to authenticated using (true);

create policy user_roles_select on user_roles
  for select using (user_id = auth.uid() or public.is_admin());

create policy user_roles_write_admin on user_roles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 6. MEMBERS
--    Administrator: full | Accountant: read | Viewer: read
--    Member: own record (update); Administrator only: insert/delete
-- ------------------------------------------------------------
create policy members_select on members
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_accountant()
    or public.has_role('viewer')
  );

create policy members_insert_admin on members
  for insert with check (public.is_admin());

create policy members_update on members
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy members_delete_admin on members
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 7. PLOTS & PLOT_ASSIGNMENTS
--    read: any authenticated user | write: Administrator only
-- ------------------------------------------------------------
create policy plots_select on plots
  for select to authenticated using (true);

create policy plots_write_admin on plots
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy plot_assignments_select on plot_assignments
  for select using (
    member_id = public.current_member_id()
    or public.is_admin()
    or public.is_accountant()
    or public.has_role('viewer')
  );

create policy plot_assignments_write_admin on plot_assignments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 8. CONTRIBUTION_TYPES & TARIFFS
--    read: any authenticated user | write: Administrator only
-- ------------------------------------------------------------
create policy contribution_types_select on contribution_types
  for select to authenticated using (true);

create policy contribution_types_write_admin on contribution_types
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy tariffs_select on tariffs
  for select to authenticated using (true);

create policy tariffs_write_admin on tariffs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 9. METERS & READINGS
--    read: any authenticated user | write: Administrator only
-- ------------------------------------------------------------
create policy water_meters_select on water_meters
  for select to authenticated using (true);

create policy water_meters_write_admin on water_meters
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy electricity_meters_select on electricity_meters
  for select to authenticated using (true);

create policy electricity_meters_write_admin on electricity_meters
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy water_readings_select on water_meter_readings
  for select to authenticated using (true);

create policy water_readings_write_admin on water_meter_readings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy electricity_readings_select on electricity_meter_readings
  for select to authenticated using (true);

create policy electricity_readings_write_admin on electricity_meter_readings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 10. CHARGES
--    Administrator: full (bypasses MFA gate)
--    Accountant: read/write, finance writes require MFA (AAL2)
--    Viewer: read only | Member: own charges
-- ------------------------------------------------------------
create policy charges_select on charges
  for select using (
    member_id = public.current_member_id()
    or public.is_admin()
    or public.is_accountant()
    or public.has_role('viewer')
  );

create policy charges_write on charges
  for all to authenticated
  using (
    public.is_admin()
    or (public.is_accountant() and (auth.jwt() ->> 'aal') = 'aal2')
  )
  with check (
    public.is_admin()
    or (public.is_accountant() and (auth.jwt() ->> 'aal') = 'aal2')
  );

-- ------------------------------------------------------------
-- 11. PAYMENTS
--    Administrator: full | Accountant: read/write (MFA-gated)
--    Viewer: read only | Member: own payments
-- ------------------------------------------------------------
create policy payments_select on payments
  for select using (
    member_id = public.current_member_id()
    or public.is_admin()
    or public.is_accountant()
    or public.has_role('viewer')
  );

create policy payments_write on payments
  for all to authenticated
  using (
    public.is_admin()
    or (public.is_accountant() and (auth.jwt() ->> 'aal') = 'aal2')
  )
  with check (
    public.is_admin()
    or (public.is_accountant() and (auth.jwt() ->> 'aal') = 'aal2')
  );