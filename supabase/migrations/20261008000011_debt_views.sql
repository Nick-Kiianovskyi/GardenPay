-- ============================================================
-- GardenPay | migration 0011 | debt views (Charges − Payments)
-- ============================================================
-- Debt = Σ(charges, non-void/cancelled) − Σ(payments, non-void; refunds negative).
-- security_invoker: visibility respects the querying user's RLS.

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
left join (
  select member_id, sum(amount_minor) as total_minor
    from charges
   where status not in ('void', 'cancelled')
   group by member_id
) ch on ch.member_id = m.id
left join (
  select member_id,
         sum(amount_minor * case when kind = 'refund' then -1 else 1 end) as total_minor
    from payments
   where status <> 'void'
   group by member_id
) p on p.member_id = m.id;

create or replace view v_debt_by_plot
with (security_invoker = true) as
select
  p.id      as plot_id,
  p.plot_no,
  m.member_no,
  m.first_name || ' ' || m.last_name as owner_name,
  coalesce(ch.total_minor, 0)  as charges_minor,
  coalesce(pa.total_minor, 0)  as payments_minor,
  coalesce(ch.total_minor, 0)
    - coalesce(pa.total_minor, 0) as debt_minor
from plots p
left join members m on m.id = p.owner_id
left join (
  select plot_id, sum(amount_minor) as total_minor
    from charges
   where status not in ('void', 'cancelled')
     and plot_id is not null
   group by plot_id
) ch on ch.plot_id = p.id
left join (
  select c.plot_id,
         sum(pa.amount_minor * case when pa.kind = 'refund' then -1 else 1 end) as total_minor
    from payments pa
    join charges c on c.id = pa.charge_id
   where pa.status <> 'void'
     and c.plot_id is not null
   group by c.plot_id
) pa on pa.plot_id = p.id;

create or replace view v_debt_by_service
with (security_invoker = true) as
select
  ct.id    as contribution_type_id,
  ct.code,
  ct.name,
  ct.kind,
  coalesce(ch.total_minor, 0)  as charges_minor,
  coalesce(pa.total_minor, 0)  as payments_minor,
  coalesce(ch.total_minor, 0)
    - coalesce(pa.total_minor, 0) as debt_minor
from contribution_types ct
left join (
  select contribution_type_id, sum(amount_minor) as total_minor
    from charges
   where status not in ('void', 'cancelled')
   group by contribution_type_id
) ch on ch.contribution_type_id = ct.id
left join (
  select c.contribution_type_id,
         sum(pa.amount_minor * case when pa.kind = 'refund' then -1 else 1 end) as total_minor
    from payments pa
    join charges c on c.id = pa.charge_id
   where pa.status <> 'void'
   group by c.contribution_type_id
) pa on pa.contribution_type_id = ct.id;

create or replace view v_debt_overall
with (security_invoker = true) as
select
  coalesce(sum(ch.total_minor), 0)  as charges_minor,
  coalesce(sum(p.total_minor), 0)   as payments_minor,
  coalesce(sum(ch.total_minor), 0)
    - coalesce(sum(p.total_minor), 0) as debt_minor,
  count(*) filter (
    where coalesce(ch.total_minor, 0) - coalesce(p.total_minor, 0) > 0
  ) as debtors_count
from members m
left join (
  select member_id, sum(amount_minor) as total_minor
    from charges
   where status not in ('void', 'cancelled')
   group by member_id
) ch on ch.member_id = m.id
left join (
  select member_id,
         sum(amount_minor * case when kind = 'refund' then -1 else 1 end) as total_minor
    from payments
   where status <> 'void'
   group by member_id
) p on p.member_id = m.id;

grant select on v_debt_by_member,
                v_debt_by_plot,
                v_debt_by_service,
                v_debt_overall to authenticated;