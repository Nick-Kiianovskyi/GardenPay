# Etap 16 — Charges Module · Log & Runbook

Billing documents (**charges**) with the business rules below. The tariff rate is snapshotted into
the charge at creation time — later tariff edits never rewrite history. All validation messages in
Ukrainian.

---

## 1. Business rules (as implemented)

| Service kind | Formula | Source |
|---|---|---|
| **Membership Fee** (`membership_fee`, also `plot_rent`) | **Area × Tariff per Sotka** | plot `area_m2` → `sotka = area_m2 / 100`; tariff = current tariff of the type at *today*; `quantity = sotka`, `unit` from tariff, `amount = round(sotka × unit_price)` |
| **Water** (`water`) | **Consumption × Water Tariff (actual date)** | charge picks a reading from `v_water_meter_readings`; `quantity = consumption_m3` (`unit = m3`); tariff = current water tariff whose window covers the **reading date** (`valid_from ≤ read_on < valid_to|∅`), unit `m3` |
| **Electricity** (`electricity`) | **Consumption × Electricity Tariff (actual date)** | same via `v_electricity_meter_readings`, `unit = kwh` |
| **Target Contribution** (`one_time`) | **Manual Amount** | user-entered EUR amount → `quantity=1`, `unit=fixed`, `unit_price_minor = amount`, no tariff |

**Tariff snapshot** — stored on the charge row: `tariff_id` + `unit_price_minor` + `quantity`
(and `amount_minor` is a generated column `round(quantity × unit_price_minor)`), so a charge keeps
the rate that was in effect, immune to later tariff/list price edits.

Per-charge also: `member_id` (required; auto-filled from the plot’s current owner for
membership/meter modes), optional `plot_id`, `water_meter_reading_id` / `electricity_meter_reading_id`
(≤1 via `charges_single_reading_ck`), `period_to = read_on` for meter modes, `due_on`,
`charge_no` (auto: `YYYY-NNNNNN`), `status` lifecycle (`draft → open → partially_paid → paid`, void/cancelled).

DB cross-references: `contributions` `on delete restrict`, `tariff_id` `on delete set null`,
`water/electricity_meter_reading_id` `on delete restrict`.

No new migration — all DDL existed in migration 0004 (+ views 0009/0010).

---

## 2. Feature structure

`web/src/features/charges/`

| File | Purpose |
|---|---|
| `business.ts` | pure calculation: `sotkaQuantity`, `tariffAtDate(tariffs, date, unit?)`, `chargeAmountMinor`, `majorToMinor`/`minorToMajor` |
| `api.ts` | `fetchCharges` (embeds member/plot/type/tariff snapshots, search `charge_no`/`note`, `issued_on desc`, pagination); option hooks: services (id/name/**kind**), plots (area + owner), members, `v_*_meter_readings` per plot, tariffs by type; `useCreateCharge`, `useDeleteCharge` |
| `components/charge-form-dialog.tsx` | **mode-driven** form (membership / meter / manual per service kind): service → subset of fields → live calculation preview with snapshot note; auto member-from-owner; per-mode uk business checks |
| `components/charge-details-dialog.tsx` | full snapshot view (tariff, qty, rate, amount, paid, remainder, due, note) |
| `components/delete-charge-dialog.tsx` | confirm; blocked by DB if payments reference the charge (`on delete restrict`) |
| `pages/charges-page.tsx` | table: Документ · Член · Послуга · Обсяг · Сума · Статус · Дії; search + pagination |

Route `/charges` re-pointed to the new module (router lazy import); the old placeholder
`features/billing/pages/charges-page.tsx` removed. `src/validation/charges.ts` re-exported from
`src/validation/index.ts`.

---

## 3. Validation (all messages Ukrainian — `src/validation/charges.ts`)

| Field | Rule | Message (uk) |
|---|---|---|
| `contribution_type_id` | required UUID | Оберіть послугу (тип внеску) · Невірний ідентифікатор послуги |
| `member_id` | optional UUID (required by business check per mode) | Невірний ідентифікатор члена · Оберіть члена · Для ділянки не вказано власника — оберіть члена |
| `plot_id` | optional UUID | Оберіть ділянку · Невірний ідентифікатор ділянки |
| `reading_id` | optional UUID | Оберіть показання · Невірний ідентифікатор показання |
| `manual_amount` | `\d+([.,]\d{1,2})?`, `>= 0` | Вкажіть суму · Сума: максимум 2 знаки після коми · Сума не може бути від’ємною |
| `due_on` | required date | Обов’язкове поле · Невірна дата терміну оплати |
| `note` | ≤ 500 | Максимум 500 символів |
| — | business (submit) | Немає дійсного тарифу для послуги «членський внесок» · Немає дійсного тарифу на дату показання |

---

## 4. Snapshot guarantee

- On create the form resolves the applicable tariff (per formula + actual date), then sends
  `tariff_id`, `quantity`, `unit_price_minor` — `amount_minor` is a **generated column**.
- Editing a tariff afterwards creates a new history row; existing charges keep their stored
  `unit_price_minor`/`amount_minor`. No recalculation is performed on existing charges.

---

## 5. Verification (runbook)

| # | Check | Status |
|:--|-------|:---:|
| V1 | `npm run build` — no TS errors | ✓ |
| V2 | `npm run lint` (oxlint) — no errors | ✓ |
| V3 | dev server `GET /charges` → 200 | ✓ |
| V4 | membership: area 650 m² → sotka 6,5 × tariff → amount preview | manual |
| V5 | water: pick reading → consumption × tariff at reading date (`m3`) | manual |
| V6 | electricity: kwh path; wrong-unit tariff ignored (`unit` filter) | manual |
| V7 | one_time: manual amount, no tariff required | manual |
| V8 | no current tariff → «Немає дійсного тарифу …» (uk) | manual |
| V9 | owner auto-fill; plot without owner → manual member required (uk) | manual |
| V10 | edit tariff later → existing charge keeps old rate (snapshot) | manual |
| V11 | delete charge with payments → DB error surfaces (English, gap) | manual |

Known gap: DB constraint errors (payment reference, restrict Violation) surface as English
`error.message`.

---

## 6. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-09 | Etap 16 — Charges module (4 billing formulas, tariff snapshot, uk validation) | §2 + `src/validation/charges.ts`, `src/validation/index.ts`, `app/router.tsx` | local | verified (V1–V3), data not applied (no runtime DB) | — |

*Append one row per environment application (local → staging → production).*