# Etap 13 — Tariffs Module · Log & Runbook

CRUD + **full history** for tariffs, with the **current tariff derived automatically** from the
validity window. Fields: **Service Type · Tariff Rate · Unit · Effective Date** (plus optional end
date). All validation messages in Ukrainian.

---

## 1. Data model (existing — no new migration)

`tariffs` (migration 0003), source of truth `Structure.md`:

| Field | Rule |
|---|---|
| `contribution_type_id` | FK → `contribution_types`, `on delete cascade` |
| `name` | not null — auto-copied from the chosen service (not exposed as a separate field) |
| `unit` | `fixed \| m3 \| kwh \| m2 \| hour \| piece` (default `fixed`) |
| `amount_minor` | `bigint >= 0` — stored in minor units (cents) |
| `currency` | default `EUR` (not exposed in UI) |
| `valid_from` | date, not null — **effective date** |
| `valid_to` | date or **NULL = open-ended** |

History guarantees (DB level):
- `tariffs_period_uk`: `valid_to is null or valid_to > valid_from`
- `tariffs_type_unit_from_uk`: unique `(contribution_type_id, unit, valid_from)`
- `tariffs_no_overlap` (GiST exclusion): no two windows for the same service + unit overlap.

**Current tariff** = the row whose window contains today:
`valid_from <= today AND (valid_to IS NULL OR valid_to > today)`. Because of the no-overlap
exclusion, at most one row is current per (service, unit) at any time — determined automatically.

RLS (`rls_policies_3roles.sql`): `tariffs_select` for Administrator / Accountant / Viewer;
`tariffs_write_admin` — writes Administrator-only. Delete is safe: `charges.tariff_id` is
`on delete set null`.

---

## 2. Feature structure

`web/src/features/tariffs/`

| File | Purpose |
|---|---|
| `types.ts` | `Tariff`, `TariffRow` (embed `contribution_types(name)`), `TariffWriteInput`, `TariffStatus` |
| `api.ts` | `fetchTariffs` (embed service name, order service→`valid_from desc`, search by name, pagination + count), `useServiceOptions()` (from `contribution_types`), create/update/delete |
| `components/tariff-form-dialog.tsx` | form: Послуга (Select) · Тариф € (decimal, `,`/`.` accepted) · Одиниця (Select) · Діє з (date) · Діє до (date, empty = perpetual); rate → `amount_minor` |
| `components/delete-tariff-dialog.tsx` | confirm; notes that charge references are detached (`on delete set null`) |
| `pages/tariffs-page.tsx` | table: Послуга · Тариф € · Одиниця · Діє з · Діє до · Статус · Дії; search (300 ms), pagination 10/20/50, skeletons |

`web/src/validation/tariffs.ts` — schema + defaults + `TARIFF_UNITS` + uk unit labels;
re-exported from `web/src/validation/index.ts`.

Money handling: UI works in major units (`150.50`), stored as `amount_minor` (`15050`), displayed
back as major units with `uk-UA` formatting — integers in the DB, no float drift.

---

## 3. Validation (all messages Ukrainian — `src/validation/tariffs.ts`)

| Field | Rule | Message (uk) |
|---|---|---|
| `contribution_type_id` | required UUID | Оберіть послугу (тип внеску) · Невірний ідентифікатор послуги |
| `rate` | required, `\d+([.,]\d{1,2})?`, `>= 0` (mirrors `amount_minor >= 0`) | Вкажіть розмір тарифу · Тариф: максимум 2 знаки після коми · Тариф не може бути від’ємним |
| `unit` | enum | — |
| `valid_from` | required date `YYYY-MM-DD` | Обов’язкове поле · Невірна дата початку дії |
| `valid_to` | optional date | Невірна дата завершення дії · (superRefine) Дата завершення має бути пізнішою за дату початку |

`valid_to` cross-field check mirrors `tariffs_period_uk`. Overlap between rows is additionally
guarded by the DB exclusion constraint — an English error surfaces if violated (known gap).

---

## 4. Verification (runbook)

| # | Check | Status |
|:--|-------|:---:|
| V1 | `npm run build` — no TS errors | ✓ |
| V2 | `npm run lint` (oxlint) — no errors | ✓ |
| V3 | dev server `GET /tariffs` → 200 | ✓ |
| V4 | create row window containing today → badge «дійсний зараз» | manual |
| V5 | future `valid_from` → «майбутній»; past `valid_to < today` → «завершений» | manual |
| V6 | same service+unit overlapping window → DB exclusion error | manual |
| V7 | `rate = 1,50` and `1.5` both accepted; stored `150` minor → shown `1,50` | manual |
| V8 | empty service / negative rate / `valid_to <= valid_from` → uk messages | manual |
| V9 | delete tariff → charges reference set to null | manual |

Known gap: conflict rows from the GiST exclusion surface as English `error.message`.

---

## 5. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-09 | Etap 13 — Tariffs CRUD + history + auto current tariff + uk validation | §2 + `src/validation/tariffs.ts`, `src/validation/index.ts` | local | verified (V1–V3), data not applied (no DB) | — |

*Append one row per environment application (local → staging → production).*