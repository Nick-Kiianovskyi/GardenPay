# Etap 19 — Reports Module · Log & Runbook

Six reports with on-screen preview and **Excel / PDF export**. The Report list is gated to
finance roles via existing `/reports` route (`FINANCE_ROLES`).

---

## 1. Reports

| # | Report | Data source | Key columns |
|---|--------|-------------|-------------|
| 1 | Боржники (Debtors) | `v_debt_by_member` | Член · № · Статус · Нараховано · Сплачено · Борг; filter «Лише боржники» (debt > 0) |
| 2 | Рахунки (Charges) | `charges` | № · Член · Ділянка · Послуга · Дата · Термін · Сума · Сплачено · Статус; filter by status |
| 3 | Платежі (Payments) | `payments` | Дата · Референс · Член · Рахунок · Метод · Сума · Статус; filter by status |
| 4 | Споживання води (Water) | `v_water_meter_readings` | Дата · Лічильник · Ділянка · Показник · Попередній · Споживання (м³) + total row |
| 5 | Споживання електроенергії (Electricity) | `v_electricity_meter_readings` | same, кВт⋅год + total row |
| 6 | Фінансове зведення (Financial Summary) | `v_financial_summary`, `v_charges_by_status`, `v_payments_by_method`, `v_monthly_finance` | summary cards + 3 tables (за статусами / за методами / помісячно) |

Money in minor units → formatted `uk-UA` (`,`, `€`). Preview capped at 1000 rows; export exports
the full filtered set.

---

## 2. SQL (migration 0012 — `supabase/migrations/20261008000012_financial_report_views.sql`)

Confirmed valid (`libpg-query`), not applied:
- `v_financial_summary` — scalar-subquery aggregates: totals by charge status, payments received /
  refunds / total, `debt_minor`, `credit_minor` (from `v_debt_by_member`), `debtors_count`.
- `v_charges_by_status` — `count` + `amount_minor` per charge status.
- `v_payments_by_method` — non-void payments grouped by `method, kind`.
- `v_monthly_finance` — `YYYY-MM` series with running `balance_minor`
  (`sum(sum(...)) over (order by month)`), refunds subtracted.

---

## 3. Frontend — `web/src/features/reports/`

| File | Purpose |
|---|---|
| `types.ts` | row types per report + `ReportKind` |
| `api.ts` | `useReport` (per-kind fetch + search + status/date filters; consumption via views; charges/payments embed member/plot/service/charge), `useFinancialSummary` (4 parallel queries) |
| `export/excel.ts` | `exceljs` generic writer: title/subtitle, frozen header, blue header fill, borders + autofilter, money `numFmt #,##0.00`, multi-sheet support; Blob download |
| `export/pdf.ts` | `jsPDF` + `jspdf-autotable`: generated-at footer, styled head, `uk-UA` money/number formatting; supports appended extra tables (summary) |
| `pages/reports-page.tsx` | 6 report cards, filter bar (search + status select), preview table, «Excel» / «PDF» buttons |

Dependencies added: `exceljs@^4.4.0`, `jspdf@^4.2.1`, `jspdf-autotable@^5.0.8`
(`xlsx` 0.18.5 was rejected due to known high-severity CVEs).

---

## 4. Validation & guarantees (all messages Ukrainian)

- No custom validators introduced — filters are free-form search (debounced) + status selection.
- Toasts: «Excel-файл збережено» / «PDF-файл збережено» / «Даних для експорту немає» /
  «Помилка експорту».
- Empty state: «За даними фільтрами даних немає.».
- Export is disabled while loading or empty; export never mutates data (CRUD stays in Charges /
  Payments / Meters modules — this module is read-only with export).

---

## 5. Verification (runbook)

| # | Check | Status |
|:--|-------|:---:|
| V1 | migration 0012 passes `libpg-query` check | ✓ |
| V2 | `npm run build` — no TS errors | ✓ |
| V3 | `npm run lint` (oxlint) — no errors (only pre-existing warnings) | ✓ |
| V4 | dev server `GET /reports` → 200 | ✓ |
| V5 | preview tables render per report with total row for consumption | manual |
| V6 | Excel export opens with correct columns, € numbers and autofilter | manual |
| V7 | PDF export renders all columns (landscape for charges/payments/debtors) | manual |
| V8 | summary export: 4 sheets (Підсумок + 3) / PDF with appended tables | manual |
| V9 | empty data → export disabled + uk toast | manual |
| V10 | role guard: non-finance roles see no /reports | manual |

---

## 6. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-09 | Etap 19 — Reports module (6 reports, Excel/PDF export) | `supabase/migrations/20261008000012_*.sql`, `web/src/features/reports/*`, `package.json` | local | verified (V1–V4), data not applied (no runtime DB) | — |

*Append one row per environment application (local → staging → production).*