# Etap 14 — Water Meter Module · Log & Runbook

Journal of **water meter readings** with automatic **Consumption = Current Reading − Previous Reading**.
Fields: **Plot · Date · Previous Reading · Current Reading**. All validation messages in Ukrainian.

---

## 1. Data model

Existing tables (migration 0003):
- `water_meters` — a physical device attached to a plot (`plot_id`, `meter_no`, `status` `active|removed|faulty`, `initial_reading`, `installed_on/removed_on`); **at most one active meter per plot** (`water_meters_active_plot_uk`).
- `water_meter_readings` — one row per `(water_meter_id, read_on)` (unique), `reading numeric(12,3) >= 0`.
- `tg_meter_reading_monotonic()` trigger — readings per meter are a **non-decreasing sequence** (insert/update/delete guarded; meter exchange modeled via closing reading + `status='removed'`).

New — **migration 0009** `20261008000009_water_meter_readings_view.sql` (validated with libpg-query):

```sql
create or replace view v_water_meter_readings
with (security_invoker = true) as
select r.id, r.water_meter_id, r.read_on, r.reading as reading_m3, r.note, r.created_at,
       m.meter_no, m.plot_id, p.plot_no,
       coalesce(lag(r.reading) over (partition by r.water_meter_id order by r.read_on),
                m.initial_reading) as previous_m3,
       round(r.reading - coalesce(lag(r.reading) over (...), m.initial_reading), 3) as consumption_m3
from water_meter_readings r
join water_meters m on m.id = r.water_meter_id
join plots p on p.id = m.plot_id;
```

- **Previous Reading** = chronologically previous reading of the same meter (`lag`), else the meter's `initial_reading`.
- **Consumption** = current − previous; non-negative guaranteed by the monotonic trigger.
- `security_invoker` → the view respects the querying user's RLS.
- `Structure.md` (Reporting views §3) and `docs/sql_migrations.md` inventory (row 9) synced.

---

## 2. Feature structure

`web/src/features/meters/water/`

| File | Purpose |
|---|---|
| `types.ts` | `WaterMeterReadingRow` (view row incl. `previous_m3`, `consumption_m3`), `MeterOption`, write DTO |
| `api.ts` | `fetchWaterReadings` (from `v_water_meter_readings`, search `plot_no`/`meter_no`, `read_on desc`, pagination); `useMeterOptions` (plots with an **active** water meter — driven via embedded `water_meters!inner` filtered by `status='active'`); `usePreviousReading(meter, date)` (latest reading `< read_on`, else `initial_reading`); create/update/delete |
| `components/water-reading-form-dialog.tsx` | Plot (Select, disabled on edit) · Date · Current reading; live preview of **Попереднє показання** + **Споживання**; guards reading ≥ previous (uk message) |
| `components/delete-water-reading-dialog.tsx` | confirm delete with meter № + plot + date |
| `pages/water-meters-page.tsx` | table: Дата · Ділянка · Лічильник · Попереднє · Поточне · **Споживання, м³** · Дії; search (300 ms), pagination, skeletons |

`web/src/validation/water-meter-readings.ts` — schema + defaults (uk); re-exported from
`web/src/validation/index.ts`.

Business logic:
- **Consumption is computed in the DB view** (window `lag`), so it is correct across pages/sorts,
  not just within the current page of results.
- The form double-checks monotonicity before sending (`reading < previous` → uk error) as a
  convenience; the DB trigger is the real guard.

---

## 3. Validation (all messages Ukrainian)

| Field | Rule | Message (uk) |
|---|---|---|
| `plot_id` | required UUID | Оберіть ділянку · Невірний ідентифікатор ділянки |
| `read_on` | required date `YYYY-MM-DD` | Обов’язкове поле · Невірна дата зняття показання |
| `reading` | required, `\d+([.,]\d{1,3})?`, `>= 0`, `<= 999999.999` | Вкажіть поточне показання · Показання: максимум 3 знаки після коми · Показання не можуть бути від’ємними · Показання завелике (максимум 999999,999 м³) |
| `note` | ≤ 500 | Максимум 500 символів |
| — | cross-field (form level) | Показання не можуть бути меншими за попереднє (<значення> м³) |

---

## 4. Verification (runbook)

| # | Check | Status |
|:--|-------|:---:|
| V1 | `sqlcheck` migration 0009 | ✓ |
| V2 | `npm run build` — no TS errors | ✓ |
| V3 | `npm run lint` (oxlint) — no errors | ✓ |
| V4 | dev server `GET /water-meters` → 200 | ✓ |
| V5 | view returns `previous_m3`/`consumption_m3` (first reading uses `initial_reading`) | manual |
| V6 | form shows previous + consumption preview before submit | manual |
| V7 | reading < previous → uk message; insert rejected | manual |
| V8 | two readings same meter+date → unique violation (English, gap) | manual |
| V9 | only plots with an active meter appear in the Plot select | manual |
| V10 | edit keeps the same meter; monotonic re-check applies | manual |

Known gap: DB constraint violations (same-day duplicate, monotonic trigger) surface as English
`error.message`.

---

## 5. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-09 | Etap 14 — Water Meter readings module + auto-consumption view 0009 | §2 + `supabase/migrations/20261008000009_water_meter_readings_view.sql`, `Structure.md`, `docs/sql_migrations.md`, `src/validation/water-meter-readings.ts`, `src/validation/index.ts` | local | verified (V1–V4), DB not applied (no runtime) | — |

*Append one row per environment application (local → staging → production).*