# Etap f_etap4 — Dashboard: перевірка та приведення до вимог

## Завдання

Перевірити наявність Dashboard та відповідність карткам:

- Загальна сума нарахувань
- Загальна сума оплат
- Поточний борг
- Кількість дачників
- Кількість боржників

Дозволено лише доопрацювати існуючу сторінку (без дублікатів, без mock-даних,
через наявні сервіси + React Query + Supabase, у поточному стилі Tailwind/shadcn).

---

## Висновок: Dashboard існує

- Сторінка: `web/src/features/dashboard/pages/dashboard-page.tsx`
- Дані: `web/src/features/dashboard/api.ts` — хук `useDashboard` (React Query, Supabase)
- Джерела: `members`/`plots`/`payments` (head count) + вʼю `v_financial_summary`,
  `v_monthly_finance`, `v_debt_by_member`, `v_debt_by_service`
- Нова сторінка не створювалась, дублікати не додавались, mock-дані не вводились.

Усі необхідні величини вже були в `useDashboard`:
`chargesTotalMinor`, `paymentsTotalMinor`, `debtMinor`, `membersCount`, `debtorsCount`.

## Що було змінено

Існуючі картки («Членів / Ділянок / Рахунки / Платежі / Загальний борг») приведено
до 5 потрібних:

| Вимога | Реалізація |
|---|---|
| Кількість дачників | `data.membersCount` (суб-рядок: кількість ділянок) |
| Загальна сума нарахувань | `eur(chargesTotalMinor)` (суб-рядок: кількість рахунків) |
| Загальна сума оплат | `eur(paymentsTotalMinor)` (суб-рядок: кількість оплат) |
| Поточний борг | `eur(max(0, debtMinor))`, червоний при боргу > 0 |
| Кількість боржників | `data.finance.debtorsCount` |

Технічні правки:
- `StatCard.value` розширено типом `number | string` (грошові суми у форматі «1 234,00 €»).
- Імпорт `Map` прибрано, додано `UserMinus`.

Чотири графіки (Рахунки/Платежі за місяцями, Топ боржників, Борг за послугами) не чіпались.

---

## Файли

### Змінені

- `web/src/features/dashboard/pages/dashboard-page.tsx`

### Не змінені (перевірені)

- `web/src/features/dashboard/api.ts` — дані вже покривають усі картки
- `web/src/features/dashboard/types.ts`

## Перевірка

- `npm run build` — ✓ (tsc + vite)
- `npm run lint` — ✓ (лише наявні warnings)
- `GET /dashboard` — 200

---

## Повний код зміненого файлу

`web/src/features/dashboard/pages/dashboard-page.tsx`:

```tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Users, ReceiptText, CreditCard, TriangleAlert, UserMinus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { useDashboard } from '@/features/dashboard/api'
import { minorToMajor } from '@/features/charges/business'

const eur = (minor: number) => `${minorToMajor(minor)} €`
const eurAxis = (minor: number) => (minor >= 100000 ? `${(minor / 100000).toFixed(1)}т` : minor >= 100 ? `${Math.round(minor / 100)}€` : `${minorToMajor(minor)}€`)
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${m}.${y.slice(2)}`
}

const MONTH_COLORS = { charges: '#1F6FEB', payments: '#22C55E' }
const DEBT_COLOR = '#EF4444'

function ChartCard({
  title,
  description,
  loading,
  children,
}: {
  title: string
  description: string
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-64 w-full" /> : (
          <div className="h-64 w-full">{children}</div>
        )}
      </CardContent>
    </Card>
  )
}

const emptyData = (type: string) => (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
    Даних за {type} недостатньо.
  </div>
)

export default function DashboardPage() {
  const { data, isPending, isError, error } = useDashboard()

  return (
    <div>
      <PageHeader
        title="Панель керування"
        description="Зведення по асоціації: члени, ділянки, рахунки, платежі та борги."
      />

      {isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : 'Не вдалося завантажити дані'}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              icon={Users}
              label="Кількість дачників"
              value={data?.membersCount}
              sub={isPending ? null : `${data?.plotsCount ?? 0} ділянок`}
              isPending={isPending}
            />
            <StatCard
              icon={ReceiptText}
              label="Загальна сума нарахувань"
              value={isPending ? undefined : eur(data?.finance.chargesTotalMinor ?? 0)}
              sub={isPending ? null : `рахунків: ${data?.finance.chargesCount ?? 0}`}
              isPending={isPending}
            />
            <StatCard
              icon={CreditCard}
              label="Загальна сума оплат"
              value={isPending ? undefined : eur(data?.finance.paymentsTotalMinor ?? 0)}
              sub={isPending ? null : `оплат: ${data?.paymentsCount ?? 0}`}
              isPending={isPending}
            />
            <StatCard
              icon={TriangleAlert}
              label="Поточний борг"
              value={isPending ? undefined : eur(Math.max(0, data?.finance.debtMinor ?? 0))}
              isPending={isPending}
              alert={Number(data?.finance.debtMinor) > 0}
            />
            <StatCard
              icon={UserMinus}
              label="Кількість боржників"
              value={data?.finance.debtorsCount}
              isPending={isPending}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Рахунки за місяцями" description="Останні 12 місяців" loading={isPending}>
              {!data || data.monthly.length === 0 ? (
                emptyData('графіком')
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={eurAxis} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip
                      formatter={(value) => [eur(Number(value)), 'Нараховано']}
                      labelFormatter={(label) => `Місяць: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="chargesMinor" name="Нараховано" fill={MONTH_COLORS.charges} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Платежі за місяцями" description="Останні 12 місяців" loading={isPending}>
              {!data || data.monthly.length === 0 ? (
                emptyData('графіком')
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={eurAxis} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip
                      formatter={(value) => [eur(Number(value)), 'Сплачено']}
                      labelFormatter={(label) => `Місяць: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="paymentsMinor" name="Сплачено" fill={MONTH_COLORS.payments} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Найбільші боржники" description="Топ-5 членів за сумою боргу" loading={isPending}>
              {!data || data.topDebtors.length === 0 ? (
                emptyData('боргами')
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.topDebtors}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={eurAxis} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="memberName"
                      width={130}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name)}
                    />
                    <Tooltip
                      formatter={(value) => [eur(Number(value)), 'Борг']}
                      labelFormatter={(_label, payload) => (payload?.[0]?.payload.memberName as string) ?? ''}
                    />
                    <Bar dataKey="debtMinor" name="Борг" radius={[0, 4, 4, 0]}>
                      {data.topDebtors.map((_, i) => (
                        <Cell key={i} fill={DEBT_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Борг за послугами" description="За видами внесків і послуг" loading={isPending}>
              {!data || data.debtByService.length === 0 ? (
                emptyData('послугами')
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.debtByService} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="service"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(name: string) => (name.length > 12 ? `${name.slice(0, 11)}…` : name)}
                      interval={0}
                    />
                    <YAxis tickFormatter={eurAxis} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip
                      formatter={(value) => [eur(Number(value)), 'Борг']}
                      labelFormatter={(label) => `Послуга: ${label}`}
                    />
                    <Bar dataKey="debtMinor" name="Борг" fill={DEBT_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  isPending,
  alert,
}: {
  icon: typeof Users
  label: string
  value?: number | string
  sub?: string | null
  isPending: boolean
  alert?: boolean
}) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className={`size-4 ${alert ? 'text-destructive' : ''}`} />
          <p className="text-sm">{label}</p>
        </div>
        {isPending ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <>
            <p className={`text-2xl font-semibold ${alert ? 'text-destructive' : ''}`}>
              {value ?? 0}
            </p>
            {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
```