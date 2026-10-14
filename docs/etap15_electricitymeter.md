# Etap 15 — Electricity Meter Module · Log & Runbook

Journal of **electricity meter readings** with automatic **Consumption = Current Reading − Previous
Reading**. Fields: **Plot · Date · Previous Reading · Current Reading**. All validation messages in
Ukrainian. The module mirrors Etap 14 (water) for `electricity_meters` / `electricity_meter_readings`.

---

## 1. Data model

Existing tables (migration 0003):
- `electricity_meters` — physical device per plot (`meter_no`, `status` `active|removed|faulty`,
  `initial_reading` kWh, `installed_on/removed_on`); **at most one active meter per plot**
  (`electricity_meters_active_plot_uk`).
- `electricity_meter_readings` — one row per `(electricity_meter_id, read_on)` (unique),
  `reading numeric(12,3) >= 0` (kWh).
- `tg_meter_reading_monotonic()` trigger — **non-decreasing** readings per meter (shared with water).

New — **migration 0010** `20261008000010_electricity_meter_readings_view.sql` (validated with
libpg-query), mirror of the water view:

```sql
create or replace view v_electricity_meter_readings
with (security_invoker = true) as
select r.id, r.electricity_meter_id, r.read_on, r.reading as reading_kwh, r.note, r.created_at,
       m.meter_no, m.plot_id, p.plot_no,
       coalesce(lag(r.reading) over (partition by r.electricity_meter_id order by r.read_on),
                m.initial_reading) as previous_kwh,
       round(r.reading - coalesce(lag(r.reading) over (...), m.initial_reading), 3) as consumption_kwh
from electricity_meter_readings r
join electricity_meters m on m.id = r.electricity_meter_id
join plots p on p.id = m.plot_id;
```

- **Previous Reading** = previous reading of the same meter (`lag`), else `initial_reading`.
- **Consumption** = current − previous, non-negative (monotonic trigger).
- `Structure.md` §3 and `docs/sql_migrations.md` inventory (row 10) synced.

---

## 2. Feature structure

`web/src/features/meters/electricity/`

| File | Purpose |
|---|---|
| `types.ts` | `ElectricityMeterReadingRow` (view row: `previous_kwh`, `consumption_kwh`), meter option, write DTO |
| `api.ts` | `fetchElectricityReadings` (from `v_electricity_meter_readings`, search `plot_no`/`meter_no`, `read_on desc`, pagination); `useMeterOptions` (plots with active electricity meter via `electricity_meters!inner`); `usePreviousReading`; create/update/delete |
| `components/electricity-reading-form-dialog.tsx` | Plot (Select, read-only on edit) · Date · Current reading, live preview of previous + consumption, guard `reading >= previous` (uk) |
| `components/delete-electricity-reading-dialog.tsx` | confirm delete (meter № / plot / date) |
| `pages/electricity-meters-page.tsx` | table: Дата · Ділянка · Лічильник · Попереднє · Поточне · **Споживання, кВт·год** · Дії; search, pagination, skeletons |

`web/src/validation/electricity-meter-readings.ts` — schema + defaults (uk); re-exported from
`web/src/validation/index.ts`.

Logic identical to Etap 14, units **кВт·год**.

---

## 3. Validation (all messages Ukrainian)

| Field | Rule | Message (uk) |
|---|---|---|
| `plot_id` | required UUID | Оберіть ділянку · Невірний ідентифікатор ділянки |
| `read_on` | required date `YYYY-MM-DD` | Обов’язкове поле · Невірна дата зняття показання |
| `reading` | required, `\d+([.,]\d{1,3})?`, `>= 0`, `<= 999999.999` | Вкажіть поточне показання · Показання: максимум 3 знаки після коми · Показання не можуть бути від’ємними · Показання завелике (максимум 999999,999 кВт·год) |
| `note` | ≤ 500 | Максимум 500 символів |
| — | cross-field (form level) | Показання не можуть бути меншими за попереднє (<значення> кВт·год) |

---

## 4. Verification (runbook)

| # | Check | Status |
|:--|-------|:---:|
| V1 | `sqlcheck` migration 0010 | ✓ |
| V2 | `npm run build` — no TS errors | ✓ |
| V3 | `npm run lint` (oxlint) — no errors | ✓ |
| V4 | dev server `GET /electricity-meters` → 200 | ✓ |
| V5 | view returns `previous_kwh`/`consumption_kwh` (first reading uses `initial_reading`) | manual |
| V6 | form shows previous + consumption preview before submit | manual |
| V7 | reading < previous → uk message; insert rejected | manual |
| V8 | two readings same meter+date → unique violation (English, gap) | manual |
| V9 | only plots with an active electricity meter appear in the select | manual |
| V10 | edit keeps the same meter; monotonic re-check applies | manual |

Known gap: DB constraint violations (same-day duplicate, monotonic trigger) surface as English
`error.message`.

---

## 5. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-09 | Etap 15 — Electricity Meter readings module + auto-consumption view 0010 | §2 + `supabase/migrations/20261008000010_electricity_meter_readings_view.sql`, `Structure.md`, `docs/sql_migrations.md`, `src/validation/electricity-meter-readings.ts`, `src/validation/index.ts` | local | verified (V1–V4), DB not applied (no runtime) | — |

*Append one row per environment application (local → staging → production).*