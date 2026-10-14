-- ============================================================
-- GardenPay | migration 0003 | contribution types, tariffs, meters
-- ============================================================

-- ------------------------------------------------------------
-- CONTRIBUTION TYPES
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- TARIFFS (time-versioned price list per contribution type + unit)
-- ------------------------------------------------------------
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

comment on constraint tariffs_no_overlap on tariffs is
  'Tariff validity windows for the same contribution type + unit must not overlap';

-- ------------------------------------------------------------
-- METERS
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- METER READINGS
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- readings must form a non-decreasing sequence per meter
-- (a meter exchange is modelled with a closing reading + status 'removed')
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'contribution_types', 'tariffs', 'water_meters', 'electricity_meters'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on %I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;
