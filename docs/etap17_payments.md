# Etap 17 — Payments Module · Log & Runbook

Payment capture with **partial payments** and full **payment history**. Fields:
**Payment Date · Member · Plot · Service Type · Amount**. All validation messages in Ukrainian.

---

## 1. Data model & accounting guarantees (existing — no new migration)

`payments` (migration 0004):
- `member_id` (restrict), `charge_id` (restrict, **NULL = unallocated credit / аванс**),
  `amount_minor > 0`, `kind` (`payment|refund`), `method`,
  `status` (`pending|matched|cleared|void`), `paid_on`, `reference`, `note`.

Provided requirements map as follows:
- **Payment Date** → `paid_on`
- **Member** → `member_id`
- **Plot / Service Type** → carried by the linked charge (`payments.charge_id →
  charges → plots / contribution_types`); shown read-only once a charge is chosen
- **Amount** → `amount_minor` (EUR minor units)

**Partial payments**: one charge may receive any number of payments; each amount may be less than
the charge remainder. The trigger `payments_refresh_charge` (`tg_refresh_charge_payment_state`)
recomputes `charges.paid_minor` and `charges.status` on every payment INSERT/UPDATE/DELETE
(`open → partially_paid → paid`; void rows excluded), so partial allocation stays consistent
automatically.

**Payment history**: the list page shows all rows ordered by `paid_on desc` (then `created_at desc`),
searchable by reference / charge number; status lifecycle visible per row.

CRUD: create, edit (amount/date/method/status/charge — trigger rebalances), delete (trigger
rebalances too).

---

## 2. Feature structure

`web/src/features/payments/`

| File | Purpose |
|---|---|
| `types.ts` | `Payment`, `PaymentRow` (embeds member + charge w/ plot & service), write DTO, `OpenChargeOption`, `remainingMinor` |
| `api.ts` | `fetchPayments` (embeds `members`, `charges(charge_no, plots, contribution_types)`, search `reference`/`charges.charge_no`, `paid_on desc`, pagination); `usePaymentMemberOptions`, `useOpenChargesForMember` (open/partially_paid), create/update/delete (also invalidates charges cache) |
| `components/payment-form-dialog.tsx` | member → charge (with per-item remaining balance) → amount defaulted to remainder (edit preserves), date, method, status, reference, note; partial-payment guard (amount ≤ remainder, uk) |
| `components/delete-payment-dialog.tsx` | confirm; notes automatic rebalance |
| `pages/payments-page.tsx` | table: Дата · Член · Рахунок (послуга · ділянка) · Метод · Сума · Статус · Дії; «Аванс» shown for unallocated; search + pagination |

Route `/payments` (already wired) now serves the real module. `src/validation/payments.ts`
re-exported from `src/validation/index.ts`.

---

## 3. Validation (all messages Ukrainian — `src/validation/payments.ts`)

| Field | Rule | Message (uk) |
|---|---|---|
| `member_id` | required UUID | Оберіть члена · Невірний ідентифікатор члена |
| `charge_id` | optional UUID | Невірний ідентифікатор рахунку |
| `amount` | required, `\d+([.,]\d{1,2})?`, `> 0` | Вкажіть суму · Сума: максимум 2 знаки після коми · Сума має бути більшою за 0 |
| — | partial-payment guard (submit): amount ≤ remainder | Сума перевищує залишок рахунку (<X> €) |
| `paid_on` | required date | Обов’язкове поле · Невірна дата платежу |
| `method` | enum (5) | — |
| `status` | enum (показано без `void`) | — |
| `reference` | ≤ 100 | Максимум 100 символів |
| `note` | ≤ 500 | Максимум 500 символів |

---

## 4. Verification (runbook)

| # | Check | Status |
|:--|-------|:---:|
| V1 | `npm run build` — no TS errors | ✓ |
| V2 | `npm run lint` (oxlint) — no errors | ✓ |
| V3 | dev server `GET /payments` → 200 | ✓ |
| V4 | partial payment (< remainder) accepted; charge stays `partially_paid` | manual |
| V5 | full payment → charge becomes `paid` (trigger) | manual |
| V6 | several payments on one charge accumulate in history | manual |
| V7 | amount > remainder → uk message «Сума перевищує залишок рахунку (… €)» | manual |
| V8 | unallocated (no charge) → shown as «Аванс» | manual |
| V9 | edit amount / delete → charge `paid_minor`+status rebalanced | manual |
| V10 | search by reference / charge number | manual |

Known gap: unallocated credits are captured but their later re-allocation to a charge is out of
scope for this etap. Refunds (`kind='refund'`) are also not exposed in the UI (schema supports them).

---

## 5. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-09 | Etap 17 — Payments module (partial payments, history, uk validation) | §2 + `src/validation/payments.ts`, `src/validation/index.ts` | local | verified (V1–V3), data not applied (no runtime DB) | — |

*Append one row per environment application (local → staging → production).*