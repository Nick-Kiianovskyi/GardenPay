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
import { usePlots } from '@/features/plots/api'
import { DeletePlotDialog } from '@/features/plots/components/delete-plot-dialog'
import { PlotFormDialog } from '@/features/plots/components/plot-form-dialog'
import type { Plot, PlotStatus } from '@/features/plots/types'

const PAGE_SIZES = [10, 20, 50]

const statusVariant = (status: PlotStatus) => {
  switch (status) {
    case 'free':
      return 'default'
    case 'allocated':
      return 'secondary'
    case 'reserved':
      return 'outline'
    case 'out_of_service':
      return 'destructive'
  }
}

const statusLabel = (status: PlotStatus): string => {
  switch (status) {
    case 'free':
      return 'вільна'
    case 'allocated':
      return 'закріплена'
    case 'reserved':
      return 'зарезервована'
    case 'out_of_service':
      return 'не обслуговується'
  }
}

const formatArea = (value: number): string => value.toLocaleString('uk-UA', { maximumFractionDigits: 2 })

export default function PlotsPage() {
  const { roles } = useAuth()
  const canManage = ADMIN_ROLES.some((role) => roles.includes(role))

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Plot | undefined>(undefined)
  const [deleting, setDeleting] = useState<Plot | undefined>(undefined)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isPending, isError, error } = usePlots({ search, page, pageSize })

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const openEdit = (plot: Plot) => {
    setEditing(plot)
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Ділянки"
        description="Реєстр ділянок — перегляд для адміністратора / бухгалтера / спостерігача."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Пошук за номером, зоною, ґрунтом…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Can allow={ADMIN_ROLES}>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Додати ділянку
              </Button>
            </Can>
          </div>

          {isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : 'Не вдалося завантажити ділянки'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ділянка</TableHead>
                    <TableHead>Площа, м²</TableHead>
                    <TableHead>Власник</TableHead>
                    <TableHead className="hidden sm:table-cell">Зона</TableHead>
                    <TableHead className="hidden md:table-cell">Статус</TableHead>
                    <TableHead className="hidden lg:table-cell">Нотатки</TableHead>
                    {canManage && <TableHead className="w-20 text-right">Дії</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPending ? (
                    Array.from({ length: pageSize }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={canManage ? 6 : 5}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (data?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 6 : 5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {search ? 'Нічого не знайдено за запитом.' : 'Ділянок поки немає.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.data ?? []).map((plot) => (
                      <TableRow key={plot.id}>
                        <TableCell>
                          <div className="font-medium">
                            <span className="font-mono text-sm">{plot.plot_no}</span>
                          </div>
                          <div className="text-xs text-muted-foreground sm:hidden">
                            {plot.zone ? `Зона ${plot.zone}` : 'Без зони'}
                          </div>
                        </TableCell>
                        <TableCell>{formatArea(plot.area_m2)}</TableCell>
                        <TableCell>
                          {plot.members ? (
                            <span className="text-sm">
                              {plot.members.last_name}, {plot.members.first_name}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{plot.zone ?? '—'}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={statusVariant(plot.status)}>{statusLabel(plot.status)}</Badge>
                        </TableCell>
                        <TableCell className="hidden max-w-48 truncate lg:table-cell">
                          {plot.notes ?? '—'}
                        </TableCell>
                        {canManage && (
                          <TableCell className="w-20">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => openEdit(plot)}>
                                <Pencil className="size-4" />
                                <span className="sr-only">Редагувати</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => setDeleting(plot)}
                              >
                                <Trash2 className="size-4" />
                                <span className="sr-only">Видалити</span>
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
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

      <PlotFormDialog
        plot={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={() => setEditing(undefined)}
      />
      <DeletePlotDialog
        plot={deleting}
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        onDeleted={() => setDeleting(undefined)}
      />
    </div>
  )
}