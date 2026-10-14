-- ============================================================
-- GardenPay | migration 0005 | row level security
-- ============================================================

-- ------------------------------------------------------------
-- enable RLS on every application table
-- ------------------------------------------------------------
alter table users                     enable row level security;
alter table roles                     enable row level security;
alter table user_roles                enable row level security;
alter table members                   enable row level security;
alter table plots                     enable row level security;
alter table plot_assignments          enable row level security;
alter table contribution_types        enable row level security;
alter table tariffs                   enable row level security;
alter table water_meters              enable row level security;
alter table electricity_meters        enable row level security;
alter table water_meter_readings      enable row level security;
alter table electricity_meter_readings enable row level security;
alter table charges                   enable row level security;
alter table payments                  enable row level security;

-- ------------------------------------------------------------
-- role helpers (SECURITY DEFINER: read user_roles without RLS loop)
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

create or replace function public.is_board()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.has_role('board')
      or public.has_role('treasurer')
      or public.has_role('admin');
$$;

create or replace function public.current_member_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from members where user_id = auth.uid();
$$;

revoke execute on function public.has_role(text)          from public, anon;
revoke execute on function public.is_board()              from public, anon;
revoke execute on function public.current_member_id()     from public, anon;
grant  execute on function public.has_role(text)          to authenticated, service_role;
grant  execute on function public.is_board()              to authenticated, service_role;
grant  execute on function public.current_member_id()     to authenticated, service_role;

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
create policy users_select_self_or_board on users
  for select using (id = auth.uid() or public.is_board());

create policy users_update_self_or_admin on users
  for update using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));

-- ------------------------------------------------------------
-- ROLES
-- ------------------------------------------------------------
create policy roles_select on roles
  for select to authenticated using (true);

create policy user_roles_select on user_roles
  for select using (user_id = auth.uid() or public.is_board());

create policy user_roles_write_admin on user_roles
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ------------------------------------------------------------
-- MEMBERS
-- ------------------------------------------------------------
create policy members_select_own_or_board on members
  for select using (user_id = auth.uid() or public.is_board());

create policy members_insert_board on members
  for insert with check (public.is_board());

create policy members_update_own_or_board on members
  for update using (user_id = auth.uid() or public.is_board());

create policy members_delete_admin on members
  for delete using (public.has_role('admin'));

-- ------------------------------------------------------------
-- PLOTS & ASSIGNMENTS
-- ------------------------------------------------------------
create policy plots_select_authenticated on plots
  for select to authenticated using (true);

create policy plots_write_board on plots
  for all to authenticated
  using (public.is_board()) with check (public.is_board());

create policy plot_assignments_select on plot_assignments
  for select using (member_id = public.current_member_id() or public.is_board());

create policy plot_assignments_write_board on plot_assignments
  for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- ------------------------------------------------------------
-- CONTRIBUTION TYPES & TARIFFS
-- ------------------------------------------------------------
create policy contribution_types_select on contribution_types
  for select to authenticated using (true);

create policy contribution_types_write_board on contribution_types
  for all to authenticated
  using (public.is_board()) with check (public.is_board());

create policy tariffs_select on tariffs
  for select to authenticated using (true);

create policy tariffs_write_board on tariffs
  for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- ------------------------------------------------------------
-- METERS & READINGS
-- ------------------------------------------------------------
create policy water_meters_select on water_meters
  for select to authenticated using (true);

create policy water_meters_write on water_meters
  for all to authenticated
  using (public.is_board() or public.has_role('workday_lead'))
  with check (public.is_board() or public.has_role('workday_lead'));

create policy electricity_meters_select on electricity_meters
  for select to authenticated using (true);

create policy electricity_meters_write on electricity_meters
  for all to authenticated
  using (public.is_board() or public.has_role('workday_lead'))
  with check (public.is_board() or public.has_role('workday_lead'));

create policy water_readings_select on water_meter_readings
  for select to authenticated using (true);

create policy water_readings_write on water_meter_readings
  for all to authenticated
  using (public.is_board() or public.has_role('workday_lead'))
  with check (public.is_board() or public.has_role('workday_lead'));

create policy electricity_readings_select on electricity_meter_readings
  for select to authenticated using (true);

create policy electricity_readings_write on electricity_meter_readings
  for all to authenticated
  using (public.is_board() or public.has_role('workday_lead'))
  with check (public.is_board() or public.has_role('workday_lead'));

-- ------------------------------------------------------------
-- CHARGES & PAYMENTS
-- ------------------------------------------------------------
create policy charges_select_own_or_finance on charges
  for select using (
    member_id = public.current_member_id()
    or public.has_role('treasurer')
    or public.has_role('board')
    or public.has_role('admin')
  );

create policy charges_write_treasurer on charges
  for all to authenticated
  using (public.has_role('treasurer') or public.has_role('admin'))
  with check (public.has_role('treasurer') or public.has_role('admin'));

create policy payments_select_own_or_finance on payments
  for select using (
    member_id = public.current_member_id()
    or public.has_role('treasurer')
    or public.has_role('board')
    or public.has_role('admin')
  );

create policy payments_write_treasurer on payments
  for all to authenticated
  using (public.has_role('treasurer') or public.has_role('admin'))
  with check (public.has_role('treasurer') or public.has_role('admin'));
