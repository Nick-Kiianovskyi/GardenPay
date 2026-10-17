# GardenPay

**GardenPay** — веб-система обліку садівничого товариства: реєстр ділянок і членів, тарифи, лічильники, нарахування, внески, платежі, боржники та звіти в одному місці.

> 🟢 **Продакшн (Live):** https://garden-pay-seven.vercel.app/

---

## Про проєкт

GardenPay автоматизує рутину садівничого товариства (ОСГ/СТ) — від ведення реєстру до фінансового обліку та звітності. Система працює на **Supabase (PostgreSQL + Auth + RLS)** з **React SPA** (Vite) на фронтенді. Увесь доступ до даних захищено Row Level Security і рольовою моделлю.

Ключові принципи:
- Гроші зберігаються в мінорних одиницях (`bigint *_minor`) — без плаваючої коми.
- Показання лічильників — точні `numeric(12,3)`.
- Фінансові документи (нарахування/платежі) незмінні — виправлення компенсаційними записами.
- Бізнес-правила продубльовано на рівні БД (тригери, обмеження, унікальні індекси).
- Усі повідомлення валідації та інтерфейс — українською.

---

## Основний функціонал

**Автентифікація та доступ**
- Вхід через Supabase Auth (email/пароль), відновлення й скидання пароля.
- Захищені маршрути за ролями (`RequireAuth`, `RequireRole`, `Can`).
- Обліковий запис учасника (`Профіль`, `Мої рахунки`).

**Реєстри**
- **Дачники (Members)** — ПІБ, контакти, тип, статус, дати членства.
- **Ділянки (Plots)** — номер, площа, зона, тип ґрунту, статус, власник; історія закріплення (`plot_assignments`).
- **Види внесків (Contribution types)** — режим нарахування (`periodic` / `metered` / `manual`), тип лічильника.
- **Тарифи (Tariffs)** — повна історія з вікнами дійсності, без перетинів, автовизначення чинного тарифу.

**Лічильники**
- Водяні та електричні лічильники, показники з монотонною послідовністю.
- Подання показань, розрахунок споживання (поточне − попереднє) через SQL-в'юхи.

**Фінанси**
- **Нарахування (Charges)** — одиничні документи зі знімком тарифу (кількість × ціна), авто-номер `YYYY-NNNNNN`, життєвий цикл статусів.
- **Масове нарахування** — пакетне створення нарахувань для всіх активних ділянок із попереднім переглядом (див. нижче).
- **Оплати (Payments)** — банк/готівка/картка/SEPA, ручне й автоматичне закриття нарахувань, переплата → переплата учасника.
- **Боржники (Debtors)** — агрегація заборгованості за членом/ділянкою/послугою + деталізація.
- **Звіти (Reports)** — фінансові підсумки, динаміка по місяцях, розподіл за статусами/методами + **експорт у Excel (`exceljs`) та PDF (`jspdf` + `jspdf-autotable`)**.

**Адміністрування**
- Керування користувачами та ролями, налаштування.
- Сторінка перевірки інтеграції з Supabase.

---

## Масове нарахування

Окрема сторінка (маршрут `/accruals/mass`, розділ «Фінанси»), доступна адміністратору та бухгалтеру.

1. Користувач обирає **вид внеску** та **період** (з/по).
2. Натискає **«Розрахувати»** → система формує попередній список для всіх **активних (розподілених) ділянок** і показує таблицю: *Ділянка · Власник · Вид внеску · Період · Сума*.
3. Натискає **«Зберегти нарахування»** → записи створюються в таблиці `charges`.

Розрахунок залежить від режиму виду внеску:
- `periodic` (членський внесок, оренда) — **площа ділянки в сотках (`area_m2 / 100`) × тариф, чинний на початок періоду**;
- `metered` (вода/електро) — **споживання за показаннями в межах періоду × тариф на дату показання**;
- `manual` (штраф/цільовий) — задана фіксована сума на кожну ділянку.

**Попередній перегляд нічого не записує в БД** (лише читання). Ділянки без власника, тарифу чи показань потрапляють у блок «Пропущено» з причиною.

---

## Технологічний стек

**Frontend**
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 8](https://vite.dev/) — збірка та dev-сервер
- [React Router 7](https://reactrouter.com/) — маршрутизація (lazy-завантаження сторінок)
- [TanStack Query 5](https://tanstack.com/query) — серверний стан і кеш
- [React Hook Form](https://react-hook-form.com/) + [Zod 4](https://zod.dev/) — форми та валідація
- [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) на [Radix UI](https://www.radix-ui.com/) — UI-компоненти
- [lucide-react](https://lucide.dev/) — іконки, [Recharts](https://recharts.org/) — графіки, [sonner](https://sonner.emilkowal.ski/) — тости
- [exceljs](https://github.com/exceljs/exceljs), [jspdf](https://github.com/parallax/jsPDF) — експорт звітів
- [@fontsource-variable/geist](https://fontsource.org/) — шрифт

**Backend / дані**
- [Supabase](https://supabase.com/) — PostgreSQL 15+, Auth, Row Level Security
- SQL-міграції (`supabase/migrations`) — схема, тригери, в'юхи, політики

**Інструменти та деплой**
- [oxlint](https://oxc.rs/) — лінтер
- Vercel — хостинг фронтенду
- npm — менеджер пакетів

---

## Структура репозиторію

```
GardenPay/
├── docs/                 # технічна документація по етапах (архітектура, auth, RLS, модулі)
├── supabase/
│   ├── migrations/       # SQL-міграції 0001–0012 (схема, views, RLS, seed)
│   ├── rls_policies_3roles.sql
│   └── seed.sql          # демо-дані (24 ділянки, члени, тарифи, показання)
├── web/                  # React SPA
│   ├── src/
│   │   ├── app/          # роутер, провайдери
│   │   ├── components/   # layout · shared · ui (shadcn)
│   │   ├── config/       # навігація та рольові константи
│   │   ├── features/     # модулі за фічами (див. нижче)
│   │   ├── lib/          # supabase-клієнт, утиліти
│   │   ├── types/        # типи (ролі, database)
│   │   └── validation/   # zod-схеми
│   ├── .env.example
│   └── package.json
├── Structure.md          # детальний опис схеми БД та бізнес-правил
├── README.md             # двомовний індекс
├── README_UK.md          # українська (цей файл)
└── README_EN.md          # англійська
```

**Модулі `web/src/features/`:** `auth`, `landing`, `dashboard`, `profile`, `billing` (мої рахунки), `members`, `plots`, `contribution-types`, `tariffs`, `meters` (water/electricity), `charges` (+ `mass-accrual`), `payments`, `debtors`, `reports`, `admin` (users/roles/settings), `integration`, `misc`.

---

## База даних

**Основні таблиці:** `users`, `roles`, `user_roles`, `members`, `plots`, `plot_assignments`, `contribution_types`, `tariffs`, `water_meters`, `electricity_meters`, `water_meter_readings`, `electricity_meter_readings`, `charges`, `payments`.

**Аналітичні в'юхи (RLS-aware, `security_invoker`):** `v_member_balance`, `v_charge_aging`, `v_water_meter_readings`, `v_electricity_meter_readings`, `v_debt_by_member`, `v_debt_by_plot`, `v_debt_by_service`, `v_debt_overall`, `v_financial_summary`, `v_charges_by_status`, `v_payments_by_method`, `v_monthly_finance`.

**Бізнес-правила на рівні БД (вибірково):**
- Одна активна ділянка-призначення та один активний лічильник на ділянку (часткові унікальні індекси).
- Показання лічильників ніколи не зменшуються (тригер).
- Вікна тарифів не перетинаються (GiST exclusion, `btree_gist`).
- Сума нарахування = `quantity × unit_price_minor` (generated column).
- Статус нарахування автоматично відслідковує оплати (тригер).
- Один документ на показання (XOR + unique), авто-номер `YYYY-NNNNNN`.

Деталі — у [`Structure.md`](./Structure.md) та [`docs/`](./docs).

---

## Ролі та доступ

| Роль | Призначення |
|---|---|
| **Administrator** | Повний доступ: користувачі, ролі, реєстри, налаштування |
| **Accountant** | Нарахування, платежі, звіти та експорти (запис у фінанси потребує MFA / `aal2`) |
| **Viewer** | Лише перегляд даних товариства |
| **Member** | Самообслуговування: власний профіль і власні рахунки |

Доступ реалізовано через RLS-політики Supabase та хелпери `is_admin()`, `is_accountant()`, `has_role()`, `current_member_id()`. Навігація фільтрується за ролями.

---

## Швидкий старт (локально)

**Вимоги:** Node.js 20+ (рекомендовано LTS 22) та проєкт Supabase.

```bash
# 1. Клонувати репозиторій
git clone git@github.com:Nick-Kiianovskyi/GardenPay.git
cd GardenPay/web

# 2. Встановити залежності
npm install

# 3. Налаштувати змінні середовища
cp .env.example .env
# заповнити VITE_SUPABASE_URL та VITE_SUPABASE_ANON_KEY

# 4. Запустити dev-сервер
npm run dev
```

`web/.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Налаштування Supabase

1. Створіть проєкт на [supabase.com](https://supabase.com/).
2. Застосуйте SQL-міграції з `supabase/migrations/` **у порядку номерів** (0001 → 0012) через SQL Editor або [Supabase CLI](https://supabase.com/docs/guides/cli).
3. (Опційно) Завантажте демо-дані з `supabase/seed.sql`.
4. За потреби згенеруйте типи: `supabase gen types typescript ... > web/src/types/database.ts`.

> Увімкнено Row Level Security для всіх таблиць — доступ визначається ролями користувача.

---

## Скрипти (`web/`)

| Команда | Дія |
|---|---|
| `npm run dev` | Локальний dev-сервер (Vite) |
| `npm run build` | Типізація (`tsc -b`) + продакшн-збірка |
| `npm run preview` | Перегляд продакшн-збірки |
| `npm run lint` | Перевірка коду oxlint |

---

## Деплой

Фронтенд розгорнуто на **Vercel**:
- Root Directory: `web`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Live:** https://garden-pay-seven.vercel.app/

---

## Документація

Папка [`docs/`](./docs) містить технічну документацію за етапами: архітектура, автентифікація, ER-модель, RLS, SQL-міграції, а також лог-записи (runbook) по модулях (ділянки, види внесків, тарифи, лічильники, нарахування, платежі, борги, звіти).
