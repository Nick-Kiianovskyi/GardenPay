-- ============================================================
-- GardenPay | migration 0002 | users, roles, members, plots
-- ============================================================

-- ------------------------------------------------------------
-- USERS (1:1 with auth.users)
-- ------------------------------------------------------------
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

comment on table users is 'Application profile, 1:1 with auth.users';

-- ------------------------------------------------------------
-- ROLES
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- MEMBERS
-- ------------------------------------------------------------
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

comment on table members is
  'Registry of association members; user_id null = member without login';

-- ------------------------------------------------------------
-- PLOTS
-- ------------------------------------------------------------
create table plots (
  id         uuid primary key default gen_random_uuid(),
  plot_no    text not null unique
             check (char_length(plot_no) between 1 and 20),
  area_m2    numeric(8, 2) not null check (area_m2 > 0),
  zone       text,
  soil_type  text,
  status     text not null default 'free'
             check (status in ('free', 'allocated', 'reserved', 'out_of_service')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plots_status_idx on plots (status);

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

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['users', 'roles', 'members', 'plots', 'plot_assignments']
  loop
    execute format(
      'create trigger set_updated_at before update on %I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;
