-- ============================================================
-- GardenPay | migration 0004 | charges, payments, reporting views
-- ============================================================

create sequence public.charge_no_seq start 1;

-- ------------------------------------------------------------
-- CHARGES (receivable / billing line)
-- ------------------------------------------------------------
create table charges (
  id                           uuid primary key default gen_random_uuid(),
  charge_no                    text unique,            -- assigned by trigger: 2026-000123
  member_id                    uuid not null references members (id) on delete restrict,
  plot_id                      uuid references plots (id) on delete set null,
  contribution_type_id         uuid not null references contribution_types (id) on delete restrict,
  tariff_id                    uuid references tariffs (id) on delete set null,
  water_meter_reading_id       uuid unique references water_meter_readings (id) on delete restrict,
  electricity_meter_reading_id uuid unique references electricity_meter_readings (id) on delete restrict,
  period_from                  date,
  period_to                    date,
  quantity                     numeric(12, 3) not null default 1 check (quantity > 0),
  unit                         text not null default 'fixed'
                               check (unit in ('fixed', 'm3', 'kwh', 'm2', 'hour', 'piece')),
  unit_price_minor             bigint not null check (unit_price_minor >= 0),
  -- derived: quantity * unit_price_minor (never stored/edited directly)
  amount_minor                 bigint generated always as
                               (round(quantity * unit_price_minor)) stored,
  currency                     text not null default 'EUR'
                               check (currency ~ '^[A-Z]{3}$'),
  status                       text not null default 'open'
                               check (status in ('draft', 'open', 'partially_paid',
                                                 'paid', 'void', 'cancelled')),
  issued_on                    date not null default current_date,
  due_on                       date not null default (current_date + 14),
  paid_minor                   bigint not null default 0
                               check (paid_minor >= 0),   -- cache, maintained by trigger
  note                         text,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  constraint charges_period_uk check (period_to is null or period_to >= period_from),
  -- at most one meter reading source per charge
  constraint charges_single_reading_ck check (
    (case when water_meter_reading_id is not null then 1 else 0 end
   + case when electricity_meter_reading_id is not null then 1 else 0 end) <= 1
  )
);

create index charges_member_idx     on charges (member_id, status);
create index charges_status_due_idx on charges (status, due_on)
  where status in ('draft', 'open', 'partially_paid');
create index charges_type_idx       on charges (contribution_type_id);
create index charges_plot_idx       on charges (plot_id) where plot_id is not null;

comment on column charges.amount_minor is
  'Generated column: round(quantity * unit_price_minor), integer minor units';

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

-- ------------------------------------------------------------
-- PAYMENTS
-- ------------------------------------------------------------
create table payments (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members (id) on delete restrict,
  charge_id    uuid references charges (id) on delete restrict,  -- null = unallocated credit
  amount_minor bigint not null check (amount_minor > 0),
  kind         text not null default 'payment'
               check (kind in ('payment', 'refund')),
  method       text not null default 'bank_transfer'
               check (method in ('bank_transfer', 'sepa_direct_debit', 'cash', 'card', 'other')),
  status       text not null default 'cleared'
               check (status in ('pending', 'matched', 'cleared', 'void')),
  paid_on      date not null default current_date,
  reference    text,                          -- bank reference / receipt number
  received_by  uuid references users (id) on delete set null,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index payments_member_idx    on payments (member_id, paid_on desc);
create index payments_charge_idx    on payments (charge_id)
  where charge_id is not null;
create index payments_reference_idx on payments (reference)
  where reference is not null;
create index payments_status_idx    on payments (status)
  where status = 'pending';

-- keep charges.paid_minor / charges.status in sync with allocations
create or replace function public.tg_refresh_charge_payment_state()
returns trigger
language plpgsql
as $$
declare
  v_ids  uuid[];
  v_id   uuid;
  v_paid bigint;
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

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['charges', 'payments']
  loop
    execute format(
      'create trigger set_updated_at before update on %I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- VIEWS (security_invoker: respect RLS of the querying user)
-- requires PostgreSQL 15+
-- ------------------------------------------------------------

create view v_member_balance
with (security_invoker = true) as
select
  m.id                                                          as member_id,
  m.member_no,
  m.first_name || ' ' || m.last_name                            as member_name,
  m.status,
  coalesce(ch.total_minor, 0)                                   as charged_minor,
  coalesce(pa.total_minor, 0)                                   as paid_minor,
  coalesce(pa.total_minor, 0) - coalesce(ch.total_minor, 0)     as balance_minor,
  coalesce(ch.open_minor, 0)                                    as outstanding_minor,
  coalesce(ch.overdue_minor, 0)                                 as overdue_minor
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

create view v_charge_aging
with (security_invoker = true) as
select
  c.id,
  c.charge_no,
  c.member_id,
  c.amount_minor,
  c.paid_minor,
  c.amount_minor - c.paid_minor as open_minor,
  c.due_on,
  current_date - c.due_on       as days_overdue,
  case
    when current_date - c.due_on <= 0  then 'current'
    when current_date - c.due_on <= 30 then '1-30'
    when current_date - c.due_on <= 60 then '31-60'
    when current_date - c.due_on <= 90 then '61-90'
    else '90+'
  end                           as bucket
from charges c
where c.status in ('open', 'partially_paid');
