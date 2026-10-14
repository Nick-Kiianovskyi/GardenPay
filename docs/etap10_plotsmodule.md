# Etap 10 — Plots Module · Log & Runbook

CRUD module for the plot registry plus the **central validation layer**.

Rule introduced in this etap: **all validation lives in `src/validation/`, all messages in
Ukrainian; React components never contain validation logic** (they only resolve schemas +
defaults via React Hook Form).

---

## 1. Central validation layer

`src/validation/`

| File | Contents |
|---|---|
| `index.ts` | barrel re-exporting both schemas |
| `members.ts` | `memberFormSchema`, `memberFormDefaults`, `todayIso`, `MemberFormValues` (refactored from `features/members/member-schema.ts`, now removed) |
| `plots.ts` | `plotFormSchema`, `plotFormDefaults`, `PlotFormValues` |

Single source of truth — identical rules to the DB CHECK constraints
(`supabase/migrations/*.sql`). No `zod` import appears inside `features/`:

- `features/*/pages` — only list/table/search/pagination
- `features/*/components/*-form-dialog.tsx` — only RHF + `zodResolver(schema)` + `toWriteInput` mapping
- dialogs perform **mapping**, never validation (no regex/length checks in components)

### 1.1 Messages (Ukrainian)

`validation/members.ts`

| Field | Rule | Message (uk) |
|---|---|---|
| `member_no` | `^[A-Za-z0-9-]{2,20}$` | Номер члена: 2–20 символів (літери, цифри, дефіс) |
| `first_name` / `last_name` | 1–100 | Обов’язкове поле / Максимум 100 символів |
| `email` | empty or regex | Недійсний формат email; max 200 |
| `phone` | ≤ 40 | Максимум 40 символів |
| `joined_on` | required | Обов’язкове поле |
| `left_on` | `>= joined_on` | Дата завершення не може бути раніше дати початку |

`validation/plots.ts`

| Field | Rule | Message (uk) |
|---|---|---|
| `plot_no` | 1–20 | Обов’язкове поле / Максимум 20 символів |
| `area_m2` | numeric `> 0`, ≤ `999999,99`, ≤ 2 decimals (`,` or `.` accepted) | Вкажіть площу ділянки · Площа: максимум 2 знаки після коми · Площа має бути більшою за 0 · Площа завелика |
| `zone` / `soil_type` | ≤ 100 | Максимум 100 символів |
| `status` | enum | — |

---

## 2. Plots module

Route `/plots` — read for **Administrator / Accountant / Viewer**, write **Administrator only**
(matches RLS `plots_select` / `plots_write_admin`).

### 2.1 Files

| File | Purpose |
|---|---|
| `features/plots/types.ts` | `Plot`, `PlotStatus` enum (journal `free/allocated/reserved/out_of_service`), `PlotWriteInput` |
| `features/plots/api.ts` | TanStack Query: `usePlots` (search by `plot_no`/`zone`/`soil_type`, `range()` pagination, exact count, `keepPreviousData`), `useCreatePlot`, `useUpdatePlot`, `useDeletePlot` (invalidates `['plots']`) |
| `features/plots/components/plot-form-dialog.tsx` | create/edit — RHF + `zodResolver(plotFormSchema)`, `Controller` for Select |
| `features/plots/components/delete-plot-dialog.tsx` | destructive confirm |
| `features/plots/pages/plots-page.tsx` | table, search (300 ms debounce), pagination (10/20/50), skeleton/empty/error states, admin-only actions |

### 2.2 Behavior notes

- Dict fields keep DB codes (`area_m2`, statuses); labels are localized in the page
  (`statusLabel`) — DB stays code-first, UI presents Ukrainian.
- Write actions gated via `<Can allow={ADMIN_ROLES}>`; a logged-in reader cannot create/edit/delete.
- Database errors (e.g. unique `plot_no`) surface via `toast.error(error.message)`.

---

## 3. Verification (runbook)

| # | Check | Status |
|---|-------|:---:|
| V1 | `npm run build` (tsc + vite) — no TS errors | ✓ |
| V2 | `npm run lint` (oxlint) — no new warnings | ✓ |
| V3 | dev server `GET /plots` → 200 | ✓ |
| V4 | create with empty fields → uk messages: «Обов’язкове поле», «Вкажіть площу ділянки» | manual |
| V5 | `area_m2 = 0`, `-5`, `1.234` → uk messages | manual |
| V6 | `left_on < joined_on` (member form) → uk message | manual |
| V7 | viewer/accountant session → no Add/Edit/Delete buttons | manual |
| V8 | duplicate `plot_no` → toast with uk? DB `error.message` (not localized) | note |

> V8 known gap: Supabase error strings are English. Localizing DB errors is future work
> (client-side error map by `error.code`), tracked in docs/changelog.

---

## 4. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-08 | Etap 10 — central `src/validation` (uk messages), Plots CRUD module | §2.1 + `src/validation/*` | local | verified (build/lint/route) | — |

*Append one row per environment application (local → staging → production).*