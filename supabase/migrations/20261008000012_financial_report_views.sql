-- ============================================================
-- GardenPay | migration 0012 | financial report views
-- ============================================================

create or replace view v_financial_summary
with (security_invoker = true) as
select
  (select coalesce(sum(amount_minor), 0) from charges
    where status not in ('void', 'cancelled')) as charges_total_minor,
  (select count(*) from charges
    where status not in ('void', 'cancelled')) as charges_count,
  (select coalesce(sum(amount_minor), 0) from charges
    where status = 'open') as charges_open_minor,
  (select coalesce(sum(amount_minor), 0) from charges
    where status = 'partially_paid') as charges_partial_minor,
  (select coalesce(sum(amount_minor), 0) from charges
    where status = 'paid') as charges_paid_minor,
  (select coalesce(sum(amount_minor), 0) from payments
    where status <> 'void' and kind = 'payment') as payments_received_minor,
  (select coalesce(sum(amount_minor), 0) from payments
    where status <> 'void' and kind = 'refund') as refunds_minor,
  (select coalesce(sum(amount_minor), 0) from payments
    where status <> 'void') as payments_total_minor,
  (
    select coalesce(sum(amount_minor), 0) from charges
     where status not in ('void', 'cancelled')
  ) - (
    select coalesce(sum(amount_minor), 0) from payments
     where status <> 'void'
  ) as debt_minor,
  (select coalesce(sum(debt_minor), 0) from v_debt_by_member
    where debt_minor < 0) as credit_minor,
  (select count(*) from v_debt_by_member where debt_minor > 0) as debtors_count;

create or replace view v_charges_by_status
with (security_invoker = true) as
select status,
       count(*) as count,
       coalesce(sum(amount_minor), 0) as amount_minor
from charges
group by status;

create or replace view v_payments_by_method
with (security_invoker = true) as
select method,
       kind,
       count(*) as count,
       coalesce(sum(amount_minor), 0) as amount_minor
from payments
where status <> 'void'
group by method, kind;

create or replace view v_monthly_finance
with (security_invoker = true) as
with raw as (
  select to_char(c.issued_on, 'YYYY-MM') as month,
         c.amount_minor as charges_minor,
         0 as payments_minor
    from charges c
   where c.status not in ('void', 'cancelled')
  union all
  select to_char(p.paid_on, 'YYYY-MM') as month,
         0 as charges_minor,
         p.amount_minor * case when p.kind = 'refund' then -1 else 1 end as payments_minor
    from payments p
   where p.status <> 'void'
)
select month,
       sum(charges_minor) as charges_minor,
       sum(payments_minor) as payments_minor,
       (sum(sum(charges_minor)) over (order by month)
          - sum(sum(payments_minor)) over (order by month)) as balance_minor
from raw
group by month
order by month;

grant select on v_financial_summary,
                v_charges_by_status,
                v_payments_by_method,
                v_monthly_finance to authenticated;