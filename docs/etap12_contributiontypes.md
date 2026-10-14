# Etap 12 — Contribution Types Module · Log & Runbook

Full CRUD registry for **contribution types** (дивізори внесків): Membership Fee, Water,
Electricity, Target Contribution, Other — backed by the `contribution_types` table (migration 0003).

---

## 1. Data model (existing — no new migration)

`contribution_types` (from `20261008000003_contributions_tariffs_and_meters.sql`):

| Field | Constraint |
|---|---|
| `code` | unique, `^[a-z][a-z0-9_]{1,30}$` |
| `name` | not null |
| `description` | nullable |
| `kind` | `membership_fee \| plot_rent \| water \| electricity \| penalty \| one_time \| other` |
| `billing_mode` | `periodic \| metered \| manual` (default `periodic`) |
| `meter_kind` | `water \| electricity`, nullable — `(billing_mode = 'metered') = (meter_kind is not null)` |
| `is_active` | boolean, default true |
| `sort_order` | int, default 0 |
| `created_at` / `updated_at` | timestamps |

RLS: `contribution_types` carries **read for all volume roles** and **write for admin only**
(covered by `rls_policies_3roles.sql` — admin `ALL` overrides are in place; no new policy needed).

---

## 2. Feature structure

`web/src/features/contribution-types/`

| File | Purpose |
|---|---|
| `types.ts` | `ContributionKind/BillingMode/MeterKind` consts + `ContributionType` row + `ContributionTypeWriteInput` |
| `api.ts` | `fetchContributionTypes` (search `code/name/description`, `sort_order`→`name`, pagination, count), create/update/delete mutations, `['contribution-types']` invalidation |
| `components/contribution-type-form-dialog.tsx` | create/edit dialog with uk labels; kind/billing/meter selects; `is_active` checkbox; description textarea |
| `components/delete-contribution-type-dialog.tsx` | confirm delete; warns that linked tariffs are removed (FK `on delete cascade`) |
| `pages/contribution-types-page.tsx` | table: Код · Назва · Вид · Нарахування · Лічильник · Статус · Дії; search (300 ms debounce), pagination 10/20/50, skeletons |

Supporting changes:
- `web/src/components/ui/checkbox.tsx` added (`npx shadcn@latest add checkbox`).
- Route `/contribution-types` added under `READER_ROLES` in `web/src/app/router.tsx`.
- New nav item **Contribution Types** (`Layers` icon) under Registry in `web/src/config/navigation.ts`.
- `web/src/validation/index.ts` re-exports the new schema/consts/labels.

---

## 3. Validation (all messages Ukrainian — `src/validation/contribution-types.ts`)

| Field | Rule | Message (uk) |
|---|---|---|
| `code` | required, `^[a-z][a-z0-9_]{1,30}$` | Обов’язкове поле · Код: латинські малі літери, цифри або знак підкреслення (до 30; починається з літери) |
| `name` | required, ≤ 100 | Обов’язкове поле · Максимум 100 символів |
| `description` | ≤ 500 | Максимум 500 символів |
| `kind` | enum (7) | — |
| `billing_mode` | enum (3) | — |
| `meter_kind` | enum; cross-field with `billing_mode` (superRefine) | Для режиму «за лічильником» обов’язково оберіть тип лічильника · Тип лічильника доступний лише для режиму «за лічильником» |
| `is_active` | boolean | — |

Mirrors the DB check `(billing_mode = 'metered') = (meter_kind is not null)`. Components hold no
validation logic — only `zodResolver`, `plotFormDefaults`-style defaults, and a pure `toWriteInput`
mapping.

Kind labels (uk): `membership_fee` Членський внесок · `plot_rent` Оренда ділянки · `water` Вода ·
`electricity` Електроенергія · `penalty` Штраф / пеня · `one_time` Цільовий внесок · `other` Інше.
Billing labels (uk): `periodic` Періодичний · `metered` За лічильником · `manual` Ручний.

### 3.1 Seed mapping (examples requested)
Suggested seed rows map onto the existing `kind`/`billing_mode`/`meter_kind`:

| Code | Name | kind | billing_mode | meter_kind |
|---|---|---|---|---|
| `membership_fee` | Членський внесок | membership_fee | periodic | — |
| `water` | Вода | water | metered | water |
| `electricity` | Електроенергія | electricity | metered | electricity |
| `target` | Цільовий внесок | one_time | manual | — |
| `other` | Інше | other | manual | — |

(`seed.sql` rows for these may be added on DB setup; UI supports all combos.)

---

## 4. Verification (runbook)

| # | Check | Status |
|:--|-------|:---:|
| V1 | `npm run build` — no TS errors | ✓ |
| V2 | `npm run lint` (oxlint) — no errors (pre-existing warnings only) | ✓ |
| V3 | dev server `GET /contribution-types` → 200 | ✓ |
| V4 | list shows seed data (code/name/kind/billing/meter/active) | manual |
| V5 | create with `billing_mode=metered`, no meter → uk message | manual |
| V6 | create with meter_kind but `billing_mode=periodic` → uk message | manual |
| V7 | invalid `code` (uppercase/space/leading digit) → uk message | manual |
| V8 | unique `code` collision → DB error surfaces (English, gap) | manual |
| V9 | delete type with tariffs → cascades; delete without tariffs → removes | manual |

Known gap: DB-generated errors (`unique` violation) surface as English `error.message`.

---

## 5. Changelog

| Date | Change | Files | Environment | Status | Applied by |
|------|--------|-------|-------------|--------|------------|
| 2026-10-09 | Etap 12 — Contribution Types CRUD + nav/route + uk validation | §2 + `src/validation/contribution-types.ts`, `src/validation/index.ts`, `app/router.tsx`, `config/navigation.ts`, `components/ui/checkbox.tsx` | local | verified (V1–V3), data not applied (no DB) | — |

*Append one row per environment application (local → staging → production).*