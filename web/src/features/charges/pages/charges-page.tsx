import { useEffect, useState } from 'react'
import { Search, Plus, Trash2, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { FINANCE_ROLES } from '@/config/navigation'
import { Can } from '@/features/auth/guards'
import { useAuth } from '@/features/auth/auth-context'
import { useCharges } from '@/features/charges/api'
import { minorToMajor } from '@/features/charges/business'
import { ChargeDetailsDialog } from '@/features/charges/components/charge-details-dialog'
import { ChargeFormDialog } from '@/features/charges/components/charge-form-dialog'
import { DeleteChargeDialog } from '@/features/charges/components/delete-charge-dialog'
import type { ChargeRow } from '@/features/charges/types'
import { chargeStatusLabels } from '@/validation/charges'
import { unitLabels } from '@/validation/tariffs'

const PAGE_SIZES = [10, 20, 50]

const statusVariant = (status: string) => {
  switch (status) {
    case 'paid':
      return 'default'
    case 'partially_paid':
      return 'secondary'
    case 'open':
      return 'secondary'
    case 'draft':
      return 'outline'
    default:
      return 'outline'
  }
}

const formatDate = (value: string): string => new Date(`${value}T00:00:00`).toLocaleDateString('uk-UA')

export default function ChargesPage() {
  const { roles } = useAuth()
  const canManage = FINANCE_ROLES.some((role) => roles.includes(role))

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [viewing, setViewing] = useState<ChargeRow | undefined>(undefined)
  const [deleting, setDeleting] = useState<ChargeRow | undefined>(undefined)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isPending, isError, error } = useCharges({ search, page, pageSize })

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div>
      <PageHeader
        title="Нарахування"
        description="Рахунки за послугами: членський внесок (площа × тариф), вода/електроенергія (споживання × тариф), цільові внески (ручна сума)."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Пошук за номером документа…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Can allow={FINANCE_ROLES}>
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="size-4" />
                Новий документ
              </Button>
            </Can>
          </div>

          {isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : 'Не вдалося завантажити нарахування'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Документ</TableHead>
                    <TableHead>Член</TableHead>
                    <TableHead>Послуга</TableHead>
                    <TableHead className="hidden sm:table-cell">Обсяг</TableHead>
                    <TableHead className="text-right">Сума, ₴</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-24 text-right">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPending ? (
                    Array.from({ length: pageSize }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (data?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        {search ? 'Нічого не знайдено за запитом.' : 'Нарахувань поки немає.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.data ?? []).map((charge) => (
                      <TableRow key={charge.id}>
                        <TableCell>
                          <span className="font-mono text-sm">{charge.charge_no ?? '—'}</span>
                          <div className="text-xs text-muted-foreground sm:hidden">
                            {charge.contribution_types?.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {charge.members
                            ? `${charge.members.last_name}, ${charge.members.first_name}`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {charge.contribution_types?.name ?? '—'}
                          {charge.plots ? (
                            <div className="text-xs text-muted-foreground">
                              ділянка {charge.plots.plot_no}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {charge.quantity.toLocaleString('uk-UA', { maximumFractionDigits: 3 })}{' '}
                          {unitLabels[charge.unit] ?? charge.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {minorToMajor(charge.amount_minor)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(charge.status)}>
                            {chargeStatusLabels[charge.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="w-24">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setViewing(charge)}
                            >
                              <Eye className="size-4" />
                              <span className="sr-only">Деталі</span>
                            </Button>
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => setDeleting(charge)}
                              >
                                <Trash2 className="size-4" />
                                <span className="sr-only">Видалити</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Показано {from}–{to} з {total} · дати станом на {formatDate(new Date().toISOString().slice(0, 10))}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-24" aria-label="Рядків на сторінці">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                Сторінка {page} з {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Далі
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ChargeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={() => setSearch('')}
      />
      {viewing && (
        <ChargeDetailsDialog
          charge={viewing}
          open
          onOpenChange={(open) => {
            if (!open) setViewing(undefined)
          }}
        />
      )}
      {deleting && (
        <DeleteChargeDialog
          charge={deleting}
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(undefined)
          }}
          onDeleted={() => setDeleting(undefined)}
        />
      )}
    </div>
  )
}