# Інструкція розгортання бази даних GardenPay у Supabase

Цільовий проєкт: `https://femxmyfqksjoonfrnrht.supabase.co` (наразі порожній — таблиць немає).
Ця інструкція описує, як розгорнути **існуючу** схему без змін міграцій та коду.

---

## 1. Аналіз складу `supabase/`

| Файл | Призначення | Ідемпотентний? |
|---|---|---|
| `migrations/2026100800000[1-4]_*.sql` | Схема: extensions, `users`/`roles`/`members`/`plots`/`plot_assignments`, `contribution_types`/`tariffs`/`meters`, `charges`/`payments`, базові views, функції/тригери | Ні (`create table` без `if not exists`) |
| `migrations/20261008000005_rls_policies.sql` | Перший набір RLS-політик (ролі board/treasurer/admin/workday_lead) + `has_role`/`is_board`/`current_member_id` | Ні (`create policy` без `drop if exists`) |
| `migrations/20261008000006_seed_data.sql` | Ролі (`member`…`auditor`) + 6 видів внесків | Так (`on conflict do nothing`) |
| `migrations/20261008000007_roles_accountant_viewer.sql` | Ролі `accountant`/`viewer`, функції `is_admin`/`is_accountant`, перепис політик під нову модель (drop+create) | Частково (drop+create політик) |
| `migrations/20261008000008_plots_owner_and_notes.sql` | `plots.owner_id`/`notes` + тригер синхронізації з `plot_assignments` | Ні (`add column`) |
| `migrations/20261008000009-10_*_meter_readings_view.sql` | Views показників лічильників | Так (`create or replace view`) |
| `migrations/20261008000011_debt_views.sql` | `v_debt_by_member/plot/service/overall` | Так (`create or replace view`) |
| `migrations/20261008000012_financial_report_views.sql` | `v_financial_summary`, `v_charges_by_status`, `v_payments_by_method`, `v_monthly_finance` | Так (`create or replace view`) |
| `rls_policies_3roles.sql` | **Фінальний консолідований набір RLS** (ролі administrator/accountant/viewer + self-service). Видаляє всі legacy-політики з 0005 і 0007 і створює нові. **Повторне виконання — безпечне** | Так (спочатку все `drop policy if exists`) |
| `seed.sql` | Демо-дані: 8 видів внесків, 24 ділянки, 24 члени, 14 тарифів. **Лише для dev/test** | Так (`on conflict do nothing`) |

### Критичні залежності порядку
- 0001 → (extensions + `set_updated_at`) перед усіма.
- 0005 → до 0007 (0007 `drop policy` для політик, створених у 0005).
- 0007 → до `rls_policies_3roles.sql` (той видаляє політики 0005 **і** 0007).
- 0011 → до 0012 (`v_financial_summary` читає `v_debt_by_member`).
- 0008 → після 0002 (`plots`); 0009/0010 → після 0003 (meters/plots).
- `seed.sql` → після 0001–0012 (таблиці `members`/`plots`/`tariffs` мають існувати).
- `rls_policies_3roles.sql` → після 0001–0012 (самодостатній, але вимагає таблиць і функцій).

> Висновок: для **порожнього** проєкту є лише один коректний порядок —
> **0001 → 0002 → … → 0012 → rls_policies_3roles.sql → (опційно seed.sql)**.

---

## 2. Варіант 1 — Supabase CLI

Попередньо: на цій машині CLI **не встановлено** (перевірено), тож спочатку встановлення.

### 2.0 Встановлення CLI
```bash
# Windows (winget) або
winget install Supabase.CLI
# Windows (scoop)
scoop install supabase
# macOS
brew install supabase/tap/supabase
# npm (будь-яка ОС)
npm install -g supabase
```

### 2.1 Команди (порядок виконання)
Виконувати з кореня репозиторію `C:\Users\nick\projects\GardenPay`:

```bash
# 1. Авторизація (відкриє браузер)
supabase login

# 2. Ініціалізація локальної папки (створює supabase/config.toml) — один раз
supabase init

# 3. Прив'язка до реального проєкту (запитає пароль БД або connection string)
supabase link --project-ref femxmyfqksjoonfrnrht

# 4. Розгортання міграцій 0001..0012 (автоматично у порядку імен файлів)
supabase db push
#    неінтерактивний варіант:
#    SUPABASE_DB_PASSWORD=<пароль бази> supabase db push

# 5. Застосувати ФІНАЛЬНИЙ набір RLS (після міграцій!)
supabase db execute --file supabase/rls_policies_3roles.sql

# 6. Опційно — демо-дані, ТІЛЬКИ для dev/test
supabase db execute --file supabase/seed.sql
```

> Якщо версія CLI не підтримує `supabase db execute`, кроки 5–6 виконати через
> SQL Editor (варіант 2) або `psql "$DATABASE_URL" -f <файл>`, де
> `DATABASE_URL = postgresql://postgres.<ref>:<password>@aws-0-<регіон>.pooler.supabase.com:6543/postgres`.

**Важливо:** `supabase db push` відстежує застосовані міграції в таблиці
`supabase_migrations.schema_migrations`, тому повторний запуск нічого не зробить.
`rls_policies_3roles.sql` та `seed.sql` **не є** міграціями — CLI їх сам не запустить.

---

## 3. Варіант 2 — SQL Editor

1. Увійти в Dashboard → **SQL Editor** → **New query**.
2. Відкрити файл → виділити весь вміст (Ctrl+A) → **Run**.
3. Перевірити, що в результаті немає помилок. Лише після успіху — наступний файл.
4. Порядок виконання **суворо**:

| Крок | Файл |
|---|---|
| 1 | `supabase/migrations/20261008000001_extensions_and_base_functions.sql` |
| 2 | `…0002_core_identity_and_plots.sql` |
| 3 | `…0003_contributions_tariffs_and_meters.sql` |
| 4 | `…0004_charges_payments_and_views.sql` |
| 5 | `…0005_rls_policies.sql` |
| 6 | `…0006_seed_data.sql` |
| 7 | `…0007_roles_accountant_viewer.sql` |
| 8 | `…0008_plots_owner_and_notes.sql` |
| 9 | `…0009_water_meter_readings_view.sql` |
| 10 | `…0010_electricity_meter_readings_view.sql` |
| 11 | `…0011_debt_views.sql` |
| 12 | `…0012_financial_report_views.sql` |
| 13 | `supabase/rls_policies_3roles.sql` (обов'язково, фінальний RLS) |
| 14 | `supabase/seed.sql` (**опційно**, лише dev/test) |

> Рекомендація: кожен файл обгорнути у `BEGIN; … COMMIT;` (вставити `BEGIN;` перед
> вмістом і `COMMIT;` після), щоб уникнути часткового застосування при збої.
> Найчастіша причина збою — файл вже застосовано раніше (повторний запуск).

---

## 4. Перевірка після розгортання

Виконати в SQL Editor (або CLI). Наведені запити повертають те, що має існувати.

### 4.1 Таблиці (очікується 14)
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
```
Очікується: `charges, contribution_types, electricity_meter_readings, electricity_meters,
members, payments, plot_assignments, plots, roles, tariffs, user_roles, users,
water_meter_readings, water_meters`.

### 4.2 Views (очікується 12)
```sql
select table_name from information_schema.views
where table_schema = 'public' order by table_name;
```
Очікується: `v_charge_aging, v_charges_by_status, v_debt_by_member, v_debt_by_plot,
v_debt_by_service, v_debt_overall, v_electricity_meter_readings, v_financial_summary,
v_member_balance, v_monthly_finance, v_payments_by_method, v_water_meter_readings`.

### 4.3 Функції (очікується 10)
```sql
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by p.proname;
```
Очікується: `current_member_id, has_role, is_accountant, is_admin, is_board,
set_updated_at, sync_plot_owner_to_assignment, tg_assign_charge_no,
tg_meter_reading_monotonic, tg_refresh_charge_payment_state`.

### 4.4 Ролі (application-level, таблиця `roles` — очікується 9)
```sql
select code, name from roles order by code;
```
Очікується: `admin, administrator, accountant, auditor, board, member, treasurer,
viewer, workday_lead`.
(DB-ролі `anon`/`authenticated`/`service_role` створюються платформою автоматично,
нашими файлами не зачіпаються.)

### 4.5 RLS policies (після кроку 13 — очікується 29)
```sql
select tablename, policyname from pg_policies
where schemaname = 'public' order by tablename, policyname;
```
Очікується: `users` (select/insert/update/delete), `roles` (select),
`user_roles` (select/write_admin), `members` (select/insert_admin/update/delete_admin),
`plots` (select/write_admin), `plot_assignments` (select/write_admin),
`contribution_types` & `tariffs` (select/write_admin),
`water_meters`/`electricity_meters`/`water_meter_readings`/`electricity_meter_readings`
(select/write_admin), `charges` (select/write), `payments` (select/write).
Усього `1*4 + 1 + 2 + 4 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 = 29`.

### 4.6 Seed-дані (лише якщо виконувався `seed.sql`)
```sql
select 'contribution_types' as t, count(*) from contribution_types
union all select 'plots', count(*) from plots
union all select 'members', count(*) from members
union all select 'tariffs', count(*) from tariffs;
```
Очікується: 8 / 24 / 24 / 14.

### 4.7 Smoke-тест зв'язності з боку застосунку
Після розгортання оновити `/dashboard` у браузері (сторінки данників більше не мають
повертати `PGRST205`). Авторизований користувач має отримати роль через `user_roles`
(наприклад `administrator`), а self-service дачника працює через `members.user_id = auth.uid()`.

---

## 5. Безпечні дії vs ризик втрати даних

### Безпечно
- Повне розгортання **з нуля** (порожній проєкт): міграції 0001→0012, потім
  `rls_policies_3roles.sql`, потім опційно `seed.sql`.
- Повторний запуск `rls_policies_3roles.sql` — ідемпотентний (спочатку видаляє
  наявні політики).
- Повторний запуск `seed.sql` — ідемпотентний (`on conflict do nothing`).
- `supabase db push` на проєкті, де міграції вже застосовані, — не робить нічого
  (відстеження через `supabase_migrations.schema_migrations`).
- Перезапуск `0009`–`0012` у сукупності — `create or replace view`, безпечно.

### Ризик втрати/пошкодження даних
- **Повторний ручний запуск міграцій 0001–0008 у SQL Editor** на частково/повністю
  розгорнутій БД: `create table`/`add column` дають помилку «already exists» або
  часткове застосування файлу → непослідовний стан. Міграції **не** ідемпотентні.
- **`supabase db reset` / зміна транзакцій**, яка прибирає таблиці: `users` має
  `on delete cascade` з `auth.users` — видалення користувача з Auth видалить профіль.
- **`seed.sql` у продакшн-базі з реальними даними**: додасть 24 «демо»-членів,
  ділянки та тарифи поверх реальних. Видаляти їх доведеться вручну.
- `rls_policies_3roles.sql` **видаляє** політики 0005/0007 — якщо після цього файл
  виконається не повністю (збій у середині), база лишиться з частковим доступом
  (до RLS). Тому: `BEGIN; … COMMIT;` або повторний запуск файлу до успіху.
- Зміна/видалення ролей у таблиці `roles` без оновлення політик → користувачі
  втрачають доступ (не втрата рядків, але втрата доступу).

### Правило
Все, що стосується **порожнього** проєкту, — безпечно одноразовим проходом зверху
вниз. По відношенню до **непорожньої** бази — тільки `rls_policies_3roles.sql`
(повторно) і `seed.sql` (повторно), міграції вручну не перезапускати.

---

## 6. Підсумок порядку

1. Міграції `0001 … 0012` (CLI: один `supabase db push`; SQL Editor: 12 файлів по черзі).
2. `rls_policies_3roles.sql` — фінальний RLS для ролей administrator/accountant/viewer. **Обов'язково**.
3. `seed.sql` — лише dev/test, опційно.
4. Перевірка за розділом 4 (таблиці/views/функції/ролі/policies/seed).