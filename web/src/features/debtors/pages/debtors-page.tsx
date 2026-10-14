import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { useDebtOverall, useDebtRows } from '@/features/debtors/api'
import { DebtDetailDialog, type DebtEntity } from '@/features/debtors/components/debt-detail-dialog'
import type { DebtByMemberRow, DebtByPlotRow, DebtByServiceRow, DebtScope } from '@/features/debtors/types'
import { minorToMajor } from '@/features/charges/business'

const money = (minor: number) => `${minorToMajor(minor)}`

const debtBadge = (debtMinor: number) => {
  if (debtMinor > 0) {
    return (
      <Badge variant="destructive">Борг: {money(debtMinor)}</Badge>
    )
  }
  if (debtMinor < 0) {
    return <Badge variant="secondary">Переплата: {money(-debtMinor)}</Badge>
  }
  return <Badge variant="default">Сплачено</Badge>
}

const dueVariant = (status: string) => {
  if (status === 'debtor') return 'destructive'
  if (status === 'paid') return 'default'
  return 'secondary'
}

export default function DebtorsPage() {
  const [scope, setScope] = useState<DebtScope>('member')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<DebtEntity | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isPending, isError, error } = useDebtRows({ scope, search })
  const overall = useDebtOverall()

  const placeholder =
    scope === 'member'
      ? 'Пошук за ім’ям або номером члена…'
      : scope === 'plot'
        ? 'Пошук за номером ділянки…'
        : 'Пошук за послугою…'

  return (
    <div>
      <PageHeader
        title="Борги"
        description="Розрахунок боргу: нараховано мінус сплачено — за членами, ділянками та послугами."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">Нараховано</p>
            <p className="text-2xl font-semibold">{money(overall.data?.charges_minor ?? 0)} ₴</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">Сплачено</p>
            <p className="text-2xl font-semibold">{money(overall.data?.payments_minor ?? 0)} ₴</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">Загальний борг</p>
            <p className="text-2xl font-semibold text-destructive">
              {money(Math.max(0, overall.data?.debt_minor ?? 0))} ₴
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">Боржників</p>
            <div className="flex items-center gap-2">
              {overall.isPending ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-2xl font-semibold">{overall.data?.debtors_count ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Tabs value={scope} onValueChange={(v) => setScope(v as DebtScope)}>
            <TabsList>
              <TabsTrigger value="member">За членами</TabsTrigger>
              <TabsTrigger value="plot">За ділянками</TabsTrigger>
              <TabsTrigger value="service">За послугами</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={placeholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          {isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : 'Не вдалося завантажити борги'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {scope === 'member' && (
                      <>
                        <TableHead>Член</TableHead>
                        <TableHead className="hidden sm:table-cell">Статус</TableHead>
                      </>
                    )}
                    {scope === 'plot' && (
                      <>
                        <TableHead>Ділянка</TableHead>
                        <TableHead>Власник</TableHead>
                      </>
                    )}
                    {scope === 'service' && (
                      <>
                        <TableHead>Послуга</TableHead>
                        <TableHead className="hidden sm:table-cell">Код</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Нараховано, ₴</TableHead>
                    <TableHead className="text-right">Сплачено, ₴</TableHead>
                    <TableHead>Стан</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPending ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (data?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Нічого не знайдено.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.data ?? []).map((value) => {
                      const row = value as typeof value &
                        DebtByMemberRow &
                        DebtByPlotRow &
                        DebtByServiceRow
                      const entityId =
                        scope === 'member'
                          ? row.member_id
                          : scope === 'plot'
                            ? row.plot_id
                            : row.contribution_type_id
                      const title =
                        scope === 'member'
                          ? `${row.member_name} (№ ${row.member_no})`
                          : scope === 'plot'
                            ? `Ділянка ${row.plot_no}`
                            : row.name
                      const subtitle =
                        scope === 'member'
                          ? `Членський номер ${row.member_no}`
                          : scope === 'plot'
                            ? row.owner_name
                              ? `Власник: ${row.owner_name}`
                              : 'Без власника'
                            : `Код ${row.code}`
                      return (
                        <TableRow
                          key={entityId}
                          className="cursor-pointer"
                          onClick={() =>
                            setDetail({
                              scope,
                              id: entityId,
                              title,
                              subtitle,
                              memberId: scope === 'member' ? row.member_id : undefined,
                            })
                          }
                        >
                          {scope === 'member' && (
                            <>
                              <TableCell>
                                {row.member_name}
                                <div className="text-xs text-muted-foreground">№ {row.member_no}</div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant={dueVariant(row.status)}>
                                  <span className="capitalize">{row.status}</span>
                                </Badge>
                              </TableCell>
                            </>
                          )}
                          {scope === 'plot' && (
                            <>
                              <TableCell className="font-medium">{row.plot_no}</TableCell>
                              <TableCell>{row.owner_name ?? '—'}</TableCell>
                            </>
                          )}
                          {scope === 'service' && (
                            <>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell className="hidden font-mono text-sm sm:table-cell">
                                {row.code}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-right font-mono">
                            {money(row.charges_minor)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {money(row.payments_minor)}
                          </TableCell>
                          <TableCell>{debtBadge(row.debt_minor)}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {detail && (
        <DebtDetailDialog
          entity={detail}
          open
          onOpenChange={(open) => {
            if (!open) setDetail(null)
          }}
        />
      )}
    </div>
  )
}