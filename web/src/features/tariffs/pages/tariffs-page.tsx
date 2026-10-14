import { useEffect, useState } from 'react'
import { Search, Plus, Pencil, Trash2 } from 'lucide-react'
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
import { ADMIN_ROLES } from '@/config/navigation'
import { Can } from '@/features/auth/guards'
import { useAuth } from '@/features/auth/auth-context'
import { useTariffs } from '@/features/tariffs/api'
import { DeleteTariffDialog } from '@/features/tariffs/components/delete-tariff-dialog'
import { TariffFormDialog } from '@/features/tariffs/components/tariff-form-dialog'
import type { Tariff, TariffStatus } from '@/features/tariffs/types'
import { unitLabels } from '@/validation/tariffs'

const PAGE_SIZES = [10, 20, 50]

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const tariffStatus = (tariff: { valid_from: string; valid_to: string | null }): TariffStatus => {
  const today = todayIso()
  if (tariff.valid_to && tariff.valid_to < today) return 'ended'
  if (tariff.valid_from > today) return 'future'
  return 'current'
}

const statusVariant = (status: TariffStatus) => {
  switch (status) {
    case 'current':
      return 'default'
    case 'future':
      return 'secondary'
    case 'ended':
      return 'outline'
  }
}

const statusLabel = (status: TariffStatus): string => {
  switch (status) {
    case 'current':
      return 'дійсний зараз'
    case 'future':
      return 'майбутній'
    case 'ended':
      return 'завершений'
  }
}

const formatRate = (amountMinor: number): string =>
  (amountMinor / 100).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatDate = (value: string): string =>
  new Date(`${value}T00:00:00`).toLocaleDateString('uk-UA')

export default function TariffsPage() {
  const { roles } = useAuth()
  const canManage = ADMIN_ROLES.some((role) => roles.includes(role))

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tariff | undefined>(undefined)
  const [deleting, setDeleting] = useState<Tariff | undefined>(undefined)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isPending, isError, error } = useTariffs({ search, page, pageSize })

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const openEdit = (tariff: Tariff) => {
    setEditing(tariff)
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Тарифи"
        description="Історія цін за послугами; дійсний тариф визначається автоматично за датою."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Пошук за назвою послуги…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Can allow={ADMIN_ROLES}>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Додати тариф
              </Button>
            </Can>
          </div>

          {isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : 'Не вдалося завантажити тарифи'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Послуга</TableHead>
                    <TableHead>Тариф, ₴</TableHead>
                    <TableHead className="hidden sm:table-cell">Одиниця</TableHead>
                    <TableHead>Діє з</TableHead>
                    <TableHead className="hidden md:table-cell">Діє до</TableHead>
                    <TableHead>Статус</TableHead>
                    {canManage && <TableHead className="w-20 text-right">Дії</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPending ? (
                    Array.from({ length: pageSize }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={canManage ? 7 : 6}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (data?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 7 : 6}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {search ? 'Нічого не знайдено за запитом.' : 'Тарифів поки немає.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.data ?? []).map((tariff) => {
                      const status = tariffStatus(tariff)
                      return (
                        <TableRow key={tariff.id}>
                          <TableCell>
                            <div className="font-medium">
                              {tariff.contribution_types?.name ?? tariff.name}
                            </div>
                            <div className="text-xs text-muted-foreground sm:hidden">
                              {unitLabels[tariff.unit]}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatRate(tariff.amount_minor)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {unitLabels[tariff.unit]}
                          </TableCell>
                          <TableCell>{formatDate(tariff.valid_from)}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {tariff.valid_to ? formatDate(tariff.valid_to) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
                          </TableCell>
                          {canManage && (
                            <TableCell className="w-20">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openEdit(tariff)}
                                >
                                  <Pencil className="size-4" />
                                  <span className="sr-only">Редагувати</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive"
                                  onClick={() => setDeleting(tariff)}
                                >
                                  <Trash2 className="size-4" />
                                  <span className="sr-only">Видалити</span>
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Показано {from}–{to} з {total}
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

      <TariffFormDialog
        tariff={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={() => setEditing(undefined)}
      />
      {deleting && (
        <DeleteTariffDialog
          tariff={deleting}
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