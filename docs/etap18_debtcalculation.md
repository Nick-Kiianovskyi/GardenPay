# Etap 18 — Debt Calculation Module · Log & Runbook

Debt = **Charges − Payments**. Read-only computed reports in four dimensions, plus a drill-down
detail with an inline «new payment» action (Ukrainian UI throughout).

---

## 1. Formula & semantics

```
Debt_minor = Σ(charges.amount_minor  where status NOT IN ('void','cancelled'))
            − Σ(payments.amount_minor where status <> 'void';
                refunds (kind='refund') subtract: * −1)
```

- **By Member** — per `members`, member-level totals (member ledger).
- **By Plot** — per `plots`; payments scoped to the plot's charges (`payments→charges.plot_id`),
  unallocated member payments do not offset a plot until linked to one of its charges.
- **By Service** — per `contribution_types`, across all members.
- **Overall Association** — one row: total charged, total paid, total debt, and `debtors_count`
  (members with positive debt).

All money in EUR minor units; UI formats with `minorToMajor` (comma/2dp, `uk-UA`).

---

## 2. SQL (migration 0011 — `supabase/migrations/20261008000011_debt_views.sql`)

Confirmed valid (`libpg-query`), not applied (no runtime DB):

| View | Groups by | Columns |
|------|-----------|---------|
| `v_debt_by_member` | member | `member_id, member_no, member_name, status, charges_minor, payments_minor, debt_minor` |
| `v_debt_by_plot` | plot | `plot_id, plot_no, member_no, owner_name, charges_minor, payments_minor, debt_minor` |
| `v_debt_by_service` | contribution type | `contribution_type_id, code, name, kind, charges_minor, payments_minor, debt_minor` |
| `v_debt_overall` | — | `charges_minor, payments_minor, debt_minor, debtors_count` |

All views: `security_invoker = true`, `grant select ... to authenticated`.

---

## 3. Frontend — `web/src/features/debtors/`

| File | Purpose |
|---|---|
| `types.ts` | row + entity types (`DebtByMemberRow`, `DebtByPlotRow`, `DebtByServiceRow`, `DebtOverallRow`, `DebtScope`) |
| `api.ts` | `useDebtRows` (per-scope fetch + search `member_no|member_name` / `plot_no|owner_name` / `code|name`, order by `debt_minor desc`), `useDebtOverall`, drill-down `useDebtorCharges` / `useDebtorPayments` (plot/service payments filtered through embedded `charges`) |
| `components/debt-detail-dialog.tsx` | drill-down: list of the entity's charges (сума/сплачено/статус) + payments (дата/рахунок/сума/статус); «Новий платіж» shortcut (member rows) |
| `pages/debtors-page.tsx` | 4 summary cards (Нараховано · Сплачено · Загальний борг · Боржників) + tabs «За членами», «За ділянками», «За послугами»; search (300 ms); clickable rows |

Reuse / integration:
- `PaymentFormDialog` gained optional `initialMemberId` so a payment can be opened pre-scoped to
  the selected debtor (create path only).
- New payment and charges CRUD live in the Charges/Payments modules; the detail dialog links out
  conceptually (footer note) — debt is always a projection, never written.
- Route `/debtors` (existing, `Can allow={FINANCE_ROLES}`) now serves the real module.

---

## 4. Validation (all messages Ukrainian)

Reused validators (already uk): `paymentFormSchema` (amount >0, ≤2 decimals, «Сума має бути
більшою за 0»), `chargeFormSchema`. No new forms were introduced (search inputs are un-validated);
any future form must keep messages in Ukrainian per project rule.

---

## 5. Verification (runbook)

| # | Check | Status |
|:--|-------|:---:|
| V1 | migration 0011 passes `libpg-query` check | ✓ |
| V2 | `npm run build` — no TS errors | ✓ |
| V3 | `npm run lint` (oxlint) — no errors | ✓ |
| V4 | dev server `GET /debtors` → 200 | ✓ |
| V5 | member with debt appears in „За членами“ with destructive badge | manual |
| V6 | plot debt shows only payments linked to that plot's charges | manual |
| V7 | refund reduces service/member totals (negative sign handled) | manual |
| V8 | overall cards match Σ of member rows | manual |
| V9 | drill-down shows correct charges + payments per entity | manual |
| V10 | „Новий платіж“ opens payment form pre-scoped to the debtor | manual |

---

## 6. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-09 | Etap 18 — Debt = Charges − Payments (by member/plot/service/overall) | §2 + `web/src/features/debtors/*`, `payment-form-dialog.tsx` (`initialMemberId`) | local | verified (V1–V4), data not applied (no runtime DB) | — |

*Append one row per environment application (local → staging → production).*