import { CheckCircle2, Server, TableProperties, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { useIntegrationStats } from '@/features/integration/api'

const STAT_LABELS: Record<string, { label: string; hint: string }> = {
  members: { label: 'Дачники (members)', hint: 'Реєстр членів асоціації' },
  plots: { label: 'Ділянки (plots)', hint: 'Земельні ділянки' },
  tariffs: { label: 'Тарифи (tariffs)', hint: 'Тарифи за період' },
}

export default function IntegrationTestPage() {
  const { data, isPending, isError, error } = useIntegrationStats()
  const hasError = isError || (data?.errors.length ?? 0) > 0

  return (
    <div>
      <PageHeader
        title="Перевірка інтеграції з Supabase"
        description="Діагностика підключення та доступу до таблиць members, plots, tariffs."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="size-4" />
              Статус підключення до Supabase
            </CardTitle>
            <CardDescription>
              {data?.urlHost ?? 'URL не вказано (VITE_SUPABASE_URL)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-5 w-72" />
            ) : data?.isConfigured ? (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="size-4" />
                Клієнт ініціалізовано, env-змінні валідні
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <TriangleAlert className="size-4" />
                Клієнт не ініціалізовано — перевірте VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TableProperties className="size-4" />
              Кількість записів у таблицях
            </CardTitle>
            <CardDescription>
              Результати запитів у межах RLS поточного користувача. Помилка &ldquo;permission
              denied&rdquo; означає, що ролі бракує GRANT на таблицю.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {data?.results.map((s) => {
                  const meta = STAT_LABELS[s.table]
                  return (
                    <div key={s.table} className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.hint}</p>
                      {s.error ? (
                        <p className="mt-2 break-words text-xs text-destructive">{s.error}</p>
                      ) : (
                        <p className="mt-2 text-2xl font-semibold">{s.count ?? 0}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {!isPending && hasError && (
              <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <TriangleAlert className="size-4" />
                  Знайдені помилки інтеграції
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-destructive">
                  {isError && (
                    <li>{error instanceof Error ? error.message : 'Не вдалося виконати запит'}</li>
                  )}
                  {(data?.errors ?? []).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}