# Etap 20 — Dashboard Page · Log & Runbook

Association-wide summary with **cards + charts (Recharts)**, fully **responsive**.
Log: the exact etap title asked for `docs/etap20_reports.md`.

---

## 1. Cards (top grid)

| Card | Metric | Source |
|------|--------|--------|
| Членів | count | `SELECT count(*) members` |
| Ділянок | count | `SELECT count(*) plots` |
| Рахунки | count + sum | `v_financial_summary` (`charges_count`, `charges_total_minor`) |
| Платежі | count + sum | `supabase count(head)` + `v_financial_summary.payments_total_minor` |
| Загальний борг | count of debtors + debt sum | `v_financial_summary` (`debtors_count`, `debt_minor`; red accent if > 0) |

No new migration — reuses existing views (`v_financial_summary`, `v_monthly_finance`,
`v_debt_by_member`, `v_debt_by_service`). Migration 0012 remains valid/required.

---

## 2. Charts (Recharts `^3.10.1` added)

All wrapped in `Card` + `<ResponsiveContainer>` (height 256 px) → responsive at every breakpoint.

| Chart | Type | Source |
|-------|------|--------|
| Рахунки за місяцями | vertical bar (blue) | `v_monthly_finance`, last 12 months |
| Платежі за місяцями | vertical bar (green) | `v_monthly_finance`, last 12 months |
| Найбільші боржники | horizontal bar (red), top 5 | `v_debt_by_member ORDER BY debt_minor DESC LIMIT 5` |
| Борг за послугами | vertical bar (red), top 8 services | `v_debt_by_service ORDER BY debt_minor DESC LIMIT 8` |

Axes/tooltips in € (minor→major, `uk-UA`); month labels `MM.YY`; long names truncated client-side;
empty dataset → uk empty state «Даних за … недостатньо.».

---

## 3. Frontend — `web/src/features/dashboard/`

| File | Purpose |
|---|---|
| `types.ts` | `DashboardData` (counts, finance, monthly, topDebtors, debtByService) |
| `api.ts` | `useDashboard` — batched `Promise.all` of 5 queries (staleTime 60 s) |
| `pages/dashboard-page.tsx` | 5 `StatCard`s (icon, value, sub, red alert), 2×2 chart grid (single column on mobile), skeletons while pending |

Route `/dashboard` (existing, all authenticated roles) now serves the real module.

---

## 4. Responsiveness

- Cards: `grid-cols-2` on mobile → `lg:grid-cols-5`.
- Charts: `grid-cols-1` → `lg:grid-cols-2`; each chart `h-64 w-full` via `ResponsiveContainer`.
- Y/X axis ticks shrink (fontSize 11) and use compact `€`/`т` formatting for large values.

---

## 5. Verification (runbook)

| # | Check | Status |
|:--|-------|:---:|
| V1 | `npm run build` — no TS errors | ✓ |
| V2 | `npm run lint` (oxlint) — no errors | ✓ |
| V3 | dev server `GET /dashboard` → 200 | ✓ |
| V4 | 5 cards show counts + € amounts; debt card red when > 0 | manual |
| V5 | 4 charts render; tooltips show months/services in Ukrainian | manual |
| V6 | monthly charts limited to last 12 months | manual |
| V7 | рesponsive: 2-col cards on mobile, 5 on desktop; charts stack | manual |
| V8 | skeletons while loading; error message on failure | manual |

---

## 6. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-09 | Etap 20 — Dashboard (cards + Recharts charts, responsive) | `web/src/features/dashboard/*`, `package.json` (recharts) | local | verified (V1–V3), data not applied (no runtime DB) | — |

*Append one row per environment application (local → staging → production).*