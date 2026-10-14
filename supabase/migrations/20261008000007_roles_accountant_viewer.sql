-- ============================================================
-- GardenPay | migration 0007 | roles: administrator / accountant / viewer
-- See docs/authentication.md §9
-- ============================================================

-- ------------------------------------------------------------
-- 1. New role codes
-- ------------------------------------------------------------
insert into roles (code, name, description, is_system) values
  ('accountant', 'Accountant', 'Billing, payments, reports and exports', true),
  ('viewer',     'Viewer',     'Read-only access to association data',   true)
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- 2. Helper functions
-- ------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('admin');
$$;

create or replace function public.is_accountant() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('accountant') or public.has_role('treasurer');
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_accountant() from public, anon;
grant  execute on function public.is_admin(), public.is_accountant()
       to authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Members: staff read via viewer; writes restricted to admin
-- ------------------------------------------------------------
drop policy if exists members_select_own_or_board on members;
create policy members_select_own_or_board on members
  for select using (
    user_id = auth.uid()
    or public.is_board()
    or public.has_role('viewer')
  );

drop policy if exists members_insert_board on members;
create policy members_insert_admin on members
  for insert with check (public.is_admin());

drop policy if exists members_update_own_or_board on members;
create policy members_update_own_or_admin on members
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- members_delete_admin: unchanged (admin only)

-- ------------------------------------------------------------
-- 4. Plots & assignments: read broad, write admin only
-- ------------------------------------------------------------
drop policy if exists plots_write_board on plots;
create policy plots_write_admin on plots
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists plot_assignments_select on plot_assignments;
create policy plot_assignments_select on plot_assignments
  for select using (
    member_id = public.current_member_id()
    or public.is_board()
    or public.has_role('viewer')
  );

drop policy if exists plot_assignments_write_board on plot_assignments;
create policy plot_assignments_write_admin on plot_assignments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 5. Configuration: admin only (board decides prices)
-- ------------------------------------------------------------
drop policy if exists tariffs_write_board on tariffs;
create policy tariffs_write_admin on tariffs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists contribution_types_write_board on contribution_types;
create policy contribution_types_write_admin on contribution_types
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 6. Charges: read = member/board/accountant/viewer
--           write = admin, or accountant with MFA (AAL2)
-- ------------------------------------------------------------
drop policy if exists charges_select_own_or_finance on charges;
create policy charges_select_own_or_finance on charges
  for select using (
    member_id = public.current_member_id()
    or public.is_board()
    or public.is_accountant()
    or public.has_role('viewer')
  );

drop policy if exists charges_write_treasurer on charges;
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

-- ------------------------------------------------------------
-- 7. Payments: same pattern as charges
-- ------------------------------------------------------------
drop policy if exists payments_select_own_or_finance on payments;
create policy payments_select_own_or_finance on payments
  for select using (
    member_id = public.current_member_id()
    or public.is_board()
    or public.is_accountant()
    or public.has_role('viewer')
  );

drop policy if exists payments_write_treasurer on payments;
create policy payments_write_accountant on payments
  for all to authenticated
  using (
    public.is_admin()
    or (public.is_accountant() and (auth.jwt() ->> 'aal') = 'aal2')
  )
  with check (
    public.is_admin()
    or (public.is_accountant() and (auth.jwt() ->> 'aal') = 'aal2')
  );
