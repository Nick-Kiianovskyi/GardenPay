# Etap 11 — Plots Module (real CRUD) · Log & Runbook

Full CRUD for plots with the required field set — **Plot Number · Area · Owner · Notes**.
Ownership model: **one member may own multiple plots** (verified by `owner_id → members`).

---

## 1. Data model (migration 0008)

`supabase/migrations/20261008000008_plots_owner_and_notes.sql` (syntax-validated with libpg-query)

```sql
alter table plots
  add column owner_id uuid references members (id) on delete set null,
  add column notes    text;

create index plots_owner_idx on plots (owner_id) where owner_id is not null;

create trigger plots_owner_sync
  before insert or update of owner_id on plots
  for each row execute function public.sync_plot_owner_to_assignment();
```

- `owner_id` → `members(id)` — **1 plot : 1 owner, 1 member : N plots**.
- `plot_assignments` keeps the full history; trigger `sync_plot_owner_to_assignment()` closes any
  open `owner` assignment and opens a new one whenever `owner_id` changes (respects the partial
  unique index `plot_assignments_active_uk`).
- `on delete set null` — removing a member clears ownership; history persists.
- `Structure.md` and `docs/sql_migrations.md` (inventory, now 8 migrations) synced.

RLS: unaffected — `plots_select`/`plots_write_admin` cover the new columns; assignment writes are
admin-only (`plot_assignments_write_admin`) and driven by the trigger.

---

## 2. Module structure

`web/src/features/plots/`

| File | Change |
|---|---|
| `types.ts` | `Plot` + `owner_id`, `notes`; `OwnerSummary`; `PlotRow` (list row with embedded owner); `PlotWriteInput` |
| `api.ts` | `fetchPlots` embeds `members(id, member_no, first_name, last_name)` via FK `owner_id`; new `useOwnerOptions()` (member dropdown); `useDeletePlot` now deletes `plot_assignments` first (FK `on delete restrict`), then the plot |
| `components/plot-form-dialog.tsx` | added **Власник** (Select fed by `useOwnerOptions`, «Без власника» option) and **Нотатки** (shadcn `textarea`) |
| `components/delete-plot-dialog.tsx` | warns that ownership assignments are removed |
| `pages/plots-page.tsx` | table columns: Ділянка · Площа · **Власник** · Зона · Статус · **Нотатки** |

`web/src/components/ui/textarea.tsx` added via `npx shadcn@latest add textarea`.

### 2.1 Wait-list UX

Search still runs on `plot_no`/`zone`/`soil_type`; owner is displayed from the embed and filterable
by name in future etap.

---

## 3. Validation (all messages Ukrainian, in `src/validation/plots.ts`)

| Field | Rule | Message (uk) |
|---|---|---|
| `plot_no` | required, ≤ 20 | Обов’язкове поле / Максимум 20 символів |
| `area_m2` | numeric `> 0`, ≤ `999999,99`, ≤ 2 decimals | Вкажіть площу ділянки · Площа: максимум 2 знаки після коми · Площа має бути більшою за 0 · Площа завелика |
| `owner_id` | optional UUID | Невірний ідентифікатор власника |
| `notes` | ≤ 2000 | Максимум 2000 символів |
| `zone` / `soil_type` | ≤ 100 | Максимум 100 символів |
| `status` | enum | — |

Components hold **no validation logic** — only `zodResolver(plotFormSchema)` and a pure
`toWriteInput` mapping (`'' → null`, `',' → '.'` for decimals).

---

## 4. Verification (runbook)

| # | Check | Status |
|---|-------|:---:|
| V1 | `sqlcheck` migration 0008 (libpg-query) | ✓ |
| V2 | `npm run build` — no TS errors | ✓ |
| V3 | `npm run lint` (oxlint) — clean | ✓ |
| V4 | dev server `GET /plots` → 200 | ✓ |
| V5 | create plot with owner → list shows owner name | manual (requires seeded members) |
| V6 | change owner on edit → old owner closed, new open assignment (query `plot_assignments`) | manual |
| V7 | delete plot with owner → no FK-restrict error (assignments cleaned first) | manual |
| V8 | delete a member who owns plots → `plots.owner_id` becomes NULL (FK set null) | manual |
| V9 | empty/short `plot_no`, `area=0`, `area=1.234`, `notes>2000` → uk messages | manual |

Known gap: DB-generated errors (`unique` violation etc.) surface as English `error.message` —
localization by error code is future work.

---

## 5. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-08 | Etap 11 — real Plots CRUD (Plot No / Area / Owner / Notes), 1 member : N plots, migration 0008 | §2 + `supabase/migrations/20261008000008_plots_owner_and_notes.sql`, `Structure.md`, `docs/sql_migrations.md` | local | verified (V1–V4), migrations not applied (no DB) | — |

*Append one row per environment application (local → staging → production).*