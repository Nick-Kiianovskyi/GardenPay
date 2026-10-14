-- ============================================================
-- GardenPay | migration 0010 | electricity meter readings view
-- ============================================================

-- Per-reading view with the previous reading of the same meter and
-- consumption = current - previous (first reading uses meter initial_reading).
-- security_invoker: visibility respects the querying user's RLS.
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

grant select on v_electricity_meter_readings to authenticated;