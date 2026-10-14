# GardenPay — PostgreSQL Database Structure

Target: **PostgreSQL 15+** (Supabase). Scope: Users, Roles, Members, Plots, ContributionTypes, Tariffs, WaterMeters, ElectricityMeters, Charges, Payments.

## Conventions

| Rule | Detail |
|---|---|
| Primary keys | `uuid` default `gen_random_uuid()` |
| Money | integer minor units (`bigint *_minor`), currency ISO-4217 (`EUR`) — no floats |
| Meter readings | `numeric(12,3)` exact decimal, unit = `m³` (water) / `kWh` (electricity) |
| Time | `date` for business dates, `timestamptz` for audit timestamps |
| Enums | `CHECK` constraints (editable without `ALTER TYPE`) |
| Immutability | `charges`, `payments` (financial) are append-only; corrections via compensating rows |
| Audit | `created_at` / `updated_at` maintained by trigger on every mutable table |

### Entity → Table mapping

| Domain entity | Table(s) |
|---|---|
| Users | `users`, `user_roles` |
| Roles | `roles`, `user_roles` |
| Members | `members` |
| Plots | `plots`, `plot_assignments` *(member↔plot history)* |
| ContributionTypes | `contribution_types` |
| Tariffs | `tariffs` |
| WaterMeters | `water_meters`, `water_meter_readings` |
| ElectricityMeters | `electricity_meters`, `electricity_meter_readings` |
| Charges | `charges` |
| Payments | `payments` |

---

## 1. DDL

```sql
-- ============================================================
-- GardenPay schema
-- ============================================================
create extension if not exists pgcrypto;    -- gen_random_uuid()
create extension if not exists btree_gist;  -- exclusion constraint on tariffs

-- ------------------------------------------------------------
-- Helper: updated_at maintenance
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================
-- USERS & ROLES
-- ============================================================

create table users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique
                check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name     text not null check (char_length(full_name) between 1 and 200),
  phone         text,
  locale        text not null default 'de' check (locale in ('de', 'en')),
  avatar_url    text,
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table roles (
  code        text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name        text not null unique,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table user_roles (
  user_id    uuid not null references users (id) on delete cascade,
  role_code  text not null references roles (code) on delete cascade,
  granted_by uuid references users (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id, role_code),
  check (expires_at is null or expires_at > granted_at)
);

create index user_roles_role_idx on user_roles (role_code);

-- ============================================================
-- MEMBERS
-- ============================================================

create table members (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references users (id) on delete set null,
  member_no  text not null unique
             check (member_no ~ '^[A-Za-z0-9\-]{2,20}$'),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name  text not null check (char_length(last_name) between 1 and 100),
  email      text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone      text,
  kind       text not null default 'full'
             check (kind in ('full', 'tenant', 'associate', 'honorary')),
  status     text not null default 'active'
             check (status in ('pending', 'active', 'suspended', 'lapsed')),
  joined_on  date not null default current_date,
  left_on    date,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (left_on is null or left_on >= joined_on)
);

create unique index members_email_uk
  on members (lower(email)) where email is not null;
create index members_status_idx on members (status);

-- ============================================================
-- PLOTS
-- ============================================================

create table plots (
  id         uuid primary key default gen_random_uuid(),
  plot_no    text not null unique
             check (char_length(plot_no) between 1 and 20),
  area_m2    numeric(8, 2) not null check (area_m2 > 0),
  zone       text,
  soil_type  text,
  owner_id   uuid references members (id) on delete set null,
  notes      text,
  status     text not null default 'free'
             check (status in ('free', 'allocated', 'reserved', 'out_of_service')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plots_status_idx on plots (status);
create index plots_owner_idx  on plots (owner_id) where owner_id is not null;

comment on column plots.owner_id is
  'Current plot owner (denormalized); history lives in plot_assignments';
comment on column plots.notes is 'Free-form notes about the plot';

-- Keep plot_assignments in sync with plots.owner_id:
-- close any open 'owner' assignment and open a new one (migration 0008)
create function public.sync_plot_owner_to_assignment()
  returns trigger
  language plpgsql
as $$
begin
  if old.owner_id is distinct from new.owner_id then
    update plot_assignments
       set end_on = current_date
     where plot_id = new.id
       and end_on is null
       and relation = 'owner';

    if new.owner_id is not null then
      insert into plot_assignments (plot_id, member_id, relation, start_on)
      values (new.id, new.owner_id, 'owner', current_date);
    end if;
  end if;

  return new;
end;
$$;

create trigger plots_owner_sync
  before insert or update of owner_id on plots
  for each row execute function public.sync_plot_owner_to_assignment();

-- Member <-> plot allocation history (resolves M:N)
create table plot_assignments (
  id         uuid primary key default gen_random_uuid(),
  plot_id    uuid not null references plots (id) on delete restrict,
  member_id  uuid not null references members (id) on delete restrict,
  relation   text not null default 'tenant'
             check (relation in ('owner', 'tenant')),
  start_on   date not null default current_date,
  end_on     date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_on is null or end_on >= start_on)
);

-- at most one active (open) assignment per plot
create unique index plot_assignments_active_uk
  on plot_assignments (plot_id) where end_on is null;
create index plot_assignments_member_idx on plot_assignments (member_id);

-- ============================================================
-- CONTRIBUTION TYPES & TARIFFS
-- ============================================================

create table contribution_types (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique
               check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name         text not null,
  description  text,
  kind         text not null
               check (kind in ('membership_fee', 'plot_rent', 'water',
                               'electricity', 'penalty', 'one_time', 'other')),
  billing_mode text not null default 'periodic'
               check (billing_mode in ('periodic', 'metered', 'manual')),
  meter_kind   text check (meter_kind in ('water', 'electricity')),
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- metered contributions require a meter kind; others must not declare one
  check ((billing_mode = 'metered') = (meter_kind is not null))
);

create table tariffs (
  id                   uuid primary key default gen_random_uuid(),
  contribution_type_id uuid not null references contribution_types (id) on delete cascade,
  name                 text not null,
  unit                 text not null default 'fixed'
                       check (unit in ('fixed', 'm3', 'kwh', 'm2', 'hour', 'piece')),
  amount_minor         bigint not null check (amount_minor >= 0),
  currency             text not null default 'EUR'
                       check (currency ~ '^[A-Z]{3}$'),
  valid_from           date not null,
  valid_to             date,                          -- null = open ended
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint tariffs_period_uk check (valid_to is null or valid_to > valid_from),
  constraint tariffs_type_unit_from_uk unique (contribution_type_id, unit, valid_from)
);

-- no overlapping validity windows per (contribution type, unit)
alter table tariffs add constraint tariffs_no_overlap
  exclude using gist (
    contribution_type_id with =,
    unit with =,
    daterange(valid_from, valid_to, '[)') with &&
  );

-- ============================================================
-- METERS & READINGS
-- ============================================================

create table water_meters (
  id               uuid primary key default gen_random_uuid(),
  meter_no         text not null unique,
  plot_id          uuid not null references plots (id) on delete restrict,
  status           text not null default 'active'
                   check (status in ('active', 'removed', 'faulty')),
  installed_on     date not null default current_date,
  removed_on       date,
  initial_reading  numeric(12, 3) not null default 0
                   check (initial_reading >= 0),      -- m3 at installation
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (removed_on is null or removed_on >= installed_on)
);

-- at most one active meter per plot
create unique index water_meters_active_plot_uk
  on water_meters (plot_id) where status = 'active';
create index water_meters_plot_idx on water_meters (plot_id);

create table electricity_meters (
  id               uuid primary key default gen_random_uuid(),
  meter_no         text not null unique,
  plot_id          uuid not null references plots (id) on delete restrict,
  status           text not null default 'active'
                   check (status in ('active', 'removed', 'faulty')),
  installed_on     date not null default current_date,
  removed_on       date,
  initial_reading  numeric(12, 3) not null default 0
                   check (initial_reading >= 0),      -- kWh at installation
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (removed_on is null or removed_on >= installed_on)
);

create unique index electricity_meters_active_plot_uk
  on electricity_meters (plot_id) where status = 'active';
create index electricity_meters_plot_idx on electricity_meters (plot_id);

create table water_meter_readings (
  id              uuid primary key default gen_random_uuid(),
  water_meter_id  uuid not null references water_meters (id) on delete cascade,
  read_on         date not null default current_date,
  reading         numeric(12, 3) not null check (reading >= 0),  -- m3
  read_by         uuid references users (id) on delete set null,
  note            text,
  created_at      timestamptz not null default now(),
  constraint water_meter_readings_uk unique (water_meter_id, read_on)
);

create index water_meter_readings_lookup_idx
  on water_meter_readings (water_meter_id, read_on desc);

create table electricity_meter_readings (
  id                   uuid primary key default gen_random_uuid(),
  electricity_meter_id uuid not null references electricity_meters (id) on delete cascade,
  read_on              date not null default current_date,
  reading              numeric(12, 3) not null check (reading >= 0),  -- kWh
  read_by              uuid references users (id) on delete set null,
  note                 text,
  created_at           timestamptz not null default now(),
  constraint electricity_meter_readings_uk unique (electricity_meter_id, read_on)
);

create index electricity_meter_readings_lookup_idx
  on electricity_meter_readings (electricity_meter_id, read_on desc);

-- readings must form a non-decreasing sequence per meter
-- (a meter exchange is modelled with a closing reading + status 'removed')
create or replace function public.tg_meter_reading_monotonic()
returns trigger
language plpgsql
as $$
declare
  v_prev     numeric(12, 3);
  v_next     numeric(12, 3);
  v_initial  numeric(12, 3);
  v_meter_id uuid;
begin
  if tg_table_name = 'water_meter_readings' then
    v_meter_id := new.water_meter_id;

    select r.reading into v_prev
      from water_meter_readings r
     where r.water_meter_id = v_meter_id
       and r.id <> new.id
       and r.read_on < new.read_on
     order by r.read_on desc
     limit 1;

    if v_prev is null then
      select m.initial_reading into v_initial
        from water_meters m where m.id = v_meter_id;
      v_prev := v_initial;
    end if;

    select r.reading into v_next
      from water_meter_readings r
     where r.water_meter_id = v_meter_id
       and r.id <> new.id
       and r.read_on > new.read_on
     order by r.read_on asc
     limit 1;
  else
    v_meter_id := new.electricity_meter_id;

    select r.reading into v_prev
      from electricity_meter_readings r
     where r.electricity_meter_id = v_meter_id
       and r.id <> new.id
       and r.read_on < new.read_on
     order by r.read_on desc
     limit 1;

    if v_prev is null then
      select m.initial_reading into v_initial
        from electricity_meters m where m.id = v_meter_id;
      v_prev := v_initial;
    end if;

    select r.reading into v_next
      from electricity_meter_readings r
     where r.electricity_meter_id = v_meter_id
       and r.id <> new.id
       and r.read_on > new.read_on
     order by r.read_on asc
     limit 1;
  end if;

  if v_prev is not null and new.reading < v_prev then
    raise exception 'meter reading % on % is lower than previous reading %',
      new.reading, new.read_on, v_prev;
  end if;

  if v_next is not null and new.reading > v_next then
    raise exception 'meter reading % on % exceeds next reading %',
      new.reading, new.read_on, v_next;
  end if;

  return new;
end;
$$;

create trigger water_meter_readings_monotonic
  before insert or update on water_meter_readings
  for each row execute function public.tg_meter_reading_monotonic();

create trigger electricity_meter_readings_monotonic
  before insert or update on electricity_meter_readings
  for each row execute function public.tg_meter_reading_monotonic();

-- ============================================================
-- CHARGES  (billing document / receivable line)
-- ============================================================

create sequence public.charge_no_seq start 1;

create table charges (
  id                         uuid primary key default gen_random_uuid(),
  charge_no                  text unique,              -- assigned by trigger: 2026-000123
  member_id                  uuid not null references members (id) on delete restrict,
  plot_id                    uuid references plots (id) on delete set null,
  contribution_type_id       uuid not null references contribution_types (id) on delete restrict,
  tariff_id                  uuid references tariffs (id) on delete set null,
  water_meter_reading_id     uuid unique references water_meter_readings (id) on delete restrict,
  electricity_meter_reading_id uuid unique references electricity_meter_readings (id) on delete restrict,
  period_from                date,
  period_to                  date,
  quantity                   numeric(12, 3) not null default 1 check (quantity > 0),
  unit                       text not null default 'fixed'
                             check (unit in ('fixed', 'm3', 'kwh', 'm2', 'hour', 'piece')),
  unit_price_minor           bigint not null check (unit_price_minor >= 0),
  -- derived: quantity * unit_price_minor (never stored/edited directly)
  amount_minor               bigint generated always as
                             (round(quantity * unit_price_minor)) stored,
  currency                   text not null default 'EUR'
                             check (currency ~ '^[A-Z]{3}$'),
  status                     text not null default 'open'
                             check (status in ('draft', 'open', 'partially_paid',
                                               'paid', 'void', 'cancelled')),
  issued_on                  date not null default current_date,
  due_on                     date not null default (current_date + 14),
  paid_minor                 bigint not null default 0
                             check (paid_minor >= 0),   -- cache, maintained by trigger
  note                       text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint charges_period_uk check (period_to is null or period_to >= period_from),
  -- at most one meter reading source per charge
  constraint charges_single_reading_ck check (
    (case when water_meter_reading_id is not null then 1 else 0 end
   + case when electricity_meter_reading_id is not null then 1 else 0 end) <= 1
  )
);

create index charges_member_idx    on charges (member_id, status);
create index charges_status_due_idx on charges (status, due_on)
  where status in ('draft', 'open', 'partially_paid');
create index charges_type_idx      on charges (contribution_type_id);
create index charges_plot_idx      on charges (plot_id) where plot_id is not null;

-- document number: YYYY-NNNNNN
create or replace function public.tg_assign_charge_no()
returns trigger
language plpgsql
as $$
begin
  if new.charge_no is null then
    new.charge_no := to_char(current_date, 'YYYY') || '-'
                     || lpad(nextval('public.charge_no_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger charges_assign_no
  before insert on charges
  for each row execute function public.tg_assign_charge_no();

-- ============================================================
-- PAYMENTS
-- ============================================================

create table payments (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members (id) on delete restrict,
  charge_id   uuid references charges (id) on delete restrict,  -- null = unallocated credit
  amount_minor bigint not null check (amount_minor > 0),
  kind        text not null default 'payment'
              check (kind in ('payment', 'refund')),
  method      text not null default 'bank_transfer'
              check (method in ('bank_transfer', 'sepa_direct_debit', 'cash', 'card', 'other')),
  status      text not null default 'cleared'
              check (status in ('pending', 'matched', 'cleared', 'void')),
  paid_on     date not null default current_date,
  reference   text,                          -- bank reference / receipt number
  received_by uuid references users (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index payments_member_idx  on payments (member_id, paid_on desc);
create index payments_charge_idx  on payments (charge_id)
  where charge_id is not null;
create index payments_reference_idx on payments (reference)
  where reference is not null;
create index payments_status_idx  on payments (status)
  where status = 'pending';

-- keep charges.paid_minor / charges.status in sync with allocations
create or replace function public.tg_refresh_charge_payment_state()
returns trigger
language plpgsql
as $$
declare
  v_ids   uuid[];
  v_id    uuid;
  v_paid  bigint;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.charge_id is not null then
    v_ids := array_append(v_ids, old.charge_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.charge_id is not null then
    v_ids := array_append(v_ids, new.charge_id);
  end if;

  if v_ids is null then
    return null;
  end if;

  select array_agg(distinct x) into v_ids from unnest(v_ids) x;

  foreach v_id in array v_ids loop
    select coalesce(sum(p.amount_minor
                        * case when p.kind = 'refund' then -1 else 1 end), 0)
      into v_paid
      from payments p
     where p.charge_id = v_id
       and p.status <> 'void';

    update charges c
       set paid_minor = greatest(v_paid, 0),
           status = case
             when c.status in ('void', 'cancelled') then c.status
             when v_paid >= c.amount_minor then 'paid'
             when v_paid > 0              then 'partially_paid'
             else 'open'
           end
     where c.id = v_id;
  end loop;

  return null;
end;
$$;

create trigger payments_refresh_charge
  after insert or update or delete on payments
  for each row execute function public.tg_refresh_charge_payment_state();

-- ============================================================
-- updated_at triggers
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'roles', 'members', 'plots', 'plot_assignments',
    'contribution_types', 'tariffs', 'water_meters', 'electricity_meters',
    'charges', 'payments'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on %I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;
```

---

## 2. RLS (Supabase)

```sql
alter table users            enable row level security;
alter table roles            enable row level security;
alter table user_roles       enable row level security;
alter table members          enable row level security;
alter table plots            enable row level security;
alter table plot_assignments enable row level security;
alter table contribution_types enable row level security;
alter table tariffs          enable row level security;
alter table water_meters     enable row level security;
alter table electricity_meters enable row level security;
alter table water_meter_readings    enable row level security;
alter table electricity_meter_readings enable row level security;
alter table charges          enable row level security;
alter table payments         enable row level security;

-- role helpers (security definer: bypass RLS on user_roles)
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

-- members: read/write own record; board manages all
create policy members_select_own_or_board on members
  for select using (user_id = auth.uid() or public.is_board());

create policy members_insert_board on members
  for insert with check (public.is_board());

create policy members_update_own_or_board on members
  for update using (user_id = auth.uid() or public.is_board());

create policy members_delete_board on members
  for delete using (public.has_role('admin'));

-- plots: everyone signed in can read; board writes
create policy plots_select_authenticated on plots
  for select to authenticated using (true);

create policy plots_write_board on plots
  for all to authenticated using (public.is_board()) with check (public.is_board());

-- charges: own charges; board/treasurer all
create policy charges_select_own_or_board on charges
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

-- payments: own payments; write restricted to treasurer
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

-- tariffs / contribution types: readable by signed-in users, writable by board
create policy tariffs_select_authenticated on tariffs
  for select to authenticated using (true);

create policy tariffs_write_board on tariffs
  for all to authenticated
  using (public.is_board()) with check (public.is_board());

create policy contribution_types_select on contribution_types
  for select to authenticated using (true);

create policy contribution_types_write_board on contribution_types
  for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- users: self-service + admin
create policy users_select_self_or_board on users
  for select using (id = auth.uid() or public.is_board());

create policy users_update_self_or_admin on users
  for update using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));

-- roles: read for everyone signed in; manage via admin
create policy roles_select on roles
  for select to authenticated using (true);

create policy user_roles_select on user_roles
  for select using (user_id = auth.uid() or public.is_board());

create policy user_roles_write_admin on user_roles
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- plot assignments: own history + board
create policy plot_assignments_select on plot_assignments
  for select using (member_id = public.current_member_id() or public.is_board());

create policy plot_assignments_write_board on plot_assignments
  for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- meters & readings: readable by members, maintained by board / workday lead
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
```

---

## 3. Reporting views

```sql
-- member ledger balance: payments minus charges (RLS-aware view)
create or replace view v_member_balance
with (security_invoker = true) as
select
  m.id            as member_id,
  m.member_no,
  m.first_name || ' ' || m.last_name as member_name,
  m.status,
  coalesce(ch.total_minor, 0)                        as charged_minor,
  coalesce(pa.total_minor, 0)                        as paid_minor,
  coalesce(pa.total_minor, 0) - coalesce(ch.total_minor, 0) as balance_minor,
  coalesce(ch.open_minor, 0)                         as outstanding_minor,
  coalesce(ch.overdue_minor, 0)                      as overdue_minor
from members m
left join (
  select member_id,
         sum(amount_minor) filter (where status not in ('void', 'cancelled')) as total_minor,
         sum(amount_minor) filter (where status in ('open', 'partially_paid')) as open_minor,
         sum(amount_minor) filter (where status in ('open', 'partially_paid')
                                     and due_on < current_date) as overdue_minor
    from charges
   group by member_id
) ch on ch.member_id = m.id
left join (
  select member_id,
         sum(amount_minor * case when kind = 'refund' then -1 else 1 end)
           filter (where status <> 'void') as total_minor
    from payments
   group by member_id
) pa on pa.member_id = m.id;

-- aging of open receivables (RLS-aware view)
create or replace view v_charge_aging
with (security_invoker = true) as
select
  c.id,
  c.charge_no,
  c.member_id,
  c.amount_minor,
  c.paid_minor,
  c.amount_minor - c.paid_minor as open_minor,
  c.due_on,
  current_date - c.due_on as days_overdue,
  case
    when current_date - c.due_on <= 0  then 'current'
    when current_date - c.due_on <= 30 then '1-30'
    when current_date - c.due_on <= 60 then '31-60'
    when current_date - c.due_on <= 90 then '61-90'
    else '90+'
  end as bucket
from charges c
where c.status in ('open', 'partially_paid');

-- water meter readings with previous reading + consumption (RLS-aware view)
create or replace view v_water_meter_readings
with (security_invoker = true) as
select
  r.id,
  r.water_meter_id,
  r.read_on,
  r.reading                           as reading_m3,
  r.note,
  r.created_at,
  m.meter_no,
  m.plot_id,
  p.plot_no,
  coalesce(
    lag(r.reading) over (
      partition by r.water_meter_id
      order by r.read_on
    ),
    m.initial_reading
  )                                   as previous_m3,
  round(
    r.reading - coalesce(
      lag(r.reading) over (
        partition by r.water_meter_id
        order by r.read_on
      ),
      m.initial_reading
    ),
    3
  )                                   as consumption_m3
from water_meter_readings r
join water_meters m on m.id = r.water_meter_id
join plots p on p.id = m.plot_id;

-- electricity meter readings with previous reading + consumption (RLS-aware view)
create or replace view v_electricity_meter_readings
with (security_invoker = true) as
select
  r.id,
  r.electricity_meter_id,
  r.read_on,
  r.reading                           as reading_kwh,
  r.note,
  r.created_at,
  m.meter_no,
  m.plot_id,
  p.plot_no,
  coalesce(
    lag(r.reading) over (
      partition by r.electricity_meter_id
      order by r.read_on
    ),
    m.initial_reading
  )                                   as previous_kwh,
  round(
    r.reading - coalesce(
      lag(r.reading) over (
        partition by r.electricity_meter_id
        order by r.read_on
      ),
      m.initial_reading
    ),
    3
  )                                   as consumption_kwh
from electricity_meter_readings r
join electricity_meters m on m.id = r.electricity_meter_id
join plots p on p.id = m.plot_id;
```

### 3.12 Debt views (migration 0011)

Debt = Σ(charges, non-void/cancelled) − Σ(payments, non-void; refunds negative).

```sql
create or replace view v_debt_by_member
with (security_invoker = true) as
select
  m.id          as member_id,
  m.member_no,
  m.first_name || ' ' || m.last_name as member_name,
  m.status,
  coalesce(ch.total_minor, 0)  as charges_minor,
  coalesce(p.total_minor, 0)   as payments_minor,
  coalesce(ch.total_minor, 0)
    - coalesce(p.total_minor, 0) as debt_minor
from members m
left join ( /* charges per member */   ) ch on ch.member_id = m.id
left join ( /* payments per member */  ) p  on p.member_id = m.id;
```

| View | Groups by | Notes |
|------|-----------|-------|
| `v_debt_by_member` | member | per-member `charges_minor`/`payments_minor`/`debt_minor` |
| `v_debt_by_plot` | plot | payments scoped to the plot's charges (`payments→charges.plot_id`) |
| `v_debt_by_service` | contribution type | by `contribution_types` |
| `v_debt_overall` | — | one row: totals + `debtors_count` (members with positive debt) |

`security_invoker = true`, `grant select ... to authenticated` on all four.

### 3.13 Financial report views (migration 0012)

| View | Shape | Notes |
|------|-------|-------|
| `v_financial_summary` | one row | charges total/count, by status, payments received/refunds/total, `debt_minor`, `credit_minor`, `debtors_count` |
| `v_charges_by_status` | per status | `status, count, amount_minor` |
| `v_payments_by_method` | per method+kind | non-void rows |
| `v_monthly_finance` | per `YYYY-MM` | charges, payments, running `balance_minor` (window over cumulative sums) |

All `security_invoker = true`, `grant select ... to authenticated`.

---

## 4. Seed data

```sql
insert into roles (code, name, description, is_system) values
  ('member',     'Member',           'Plot holder, self-service access',        true),
  ('workday_lead', 'Workday Lead',   'Coordinates workdays and tasks',          true),
  ('treasurer',  'Treasurer',        'Full finance permissions',                true),
  ('board',      'Board Member',     'Reads all, manages members and plots',    true),
  ('admin',      'Administrator',    'Users, roles, settings, audit',           true),
  ('auditor',    'Auditor',          'Read-only finance and reports',           true)
on conflict (code) do nothing;

insert into contribution_types (code, name, kind, billing_mode, meter_kind, sort_order) values
  ('membership_fee', 'Membership fee',      'membership_fee', 'periodic', null,     10),
  ('plot_rent',      'Plot rent',           'plot_rent',      'periodic', null,     20),
  ('water',          'Water consumption',   'water',          'metered',  'water',  30),
  ('electricity',    'Electricity',         'electricity',    'metered',  'electricity', 40),
  ('late_fee',       'Late payment fee',    'penalty',        'manual',   null,     50),
  ('special_levy',    'Special assessment',  'one_time',       'manual',   null,     60)
on conflict (code) do nothing;
```

---

## 5. Business rules enforced by the database

| # | Rule | Enforcement |
|---|---|---|
| 1 | One active (open) plot assignment per plot | partial unique index `plot_assignments_active_uk` |
| 2 | One active water/electricity meter per plot | partial unique indexes on both meter tables |
| 3 | Meter readings never decrease | trigger `tg_meter_reading_monotonic` (vs. prior reading or installation value) |
| 4 | One reading per meter per day | `unique (meter_id, read_on)` |
| 5 | No overlapping tariff validity windows per type+unit | exclusion constraint `tariffs_no_overlap` (btree_gist) |
| 6 | `metered` contribution type requires `meter_kind` (and vice versa) | CHECK on `contribution_types` |
| 7 | Charge amount = quantity × unit price | generated column `amount_minor` |
| 8 | Overpayment becomes member credit (payment never rejected) | `v_member_balance.balance_minor`; charge turns `paid` once `paid_minor >= amount_minor` |
| 9 | Charge status auto-tracks allocations | trigger `tg_refresh_charge_payment_state` |
| 10 | At most one meter reading per charge | XOR CHECK `charges_single_reading_ck` + `unique` on each reading FK |
| 11 | Unique document number per charge | sequence + trigger `tg_assign_charge_no` |
| 12 | Refunds reduce the settled amount | `payments.kind = 'refund'` inverted in trigger/view |
| 13 | Financial rows are append-only | RLS: only treasurer/admin may write; corrections = compensating rows |
| 14 | Members cannot be hard-deleted while referenced | `on delete restrict` from charges/payments/plots |

---

## 6. Extension points (not in current scope)

- **Bank transactions / reconciliation** — `bank_transactions` + unique `payments.bank_transaction_id` (see `docs/er-model.md`).
- **Double-entry ledger** — `accounts` + `ledger_entries` posted from charge/payment triggers.
- **Dunning** — `dunning_events` driven by `v_charge_aging`.
- **Households** — `households` table linked to `members`.
- **Meter-driven charge generation** — Edge Function reads `*_meter_readings`, computes quantity (`reading − previous reading`), inserts a `charges` row with the tariff valid on `read_on`.
