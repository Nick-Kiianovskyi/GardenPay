import { useEffect, useState } from 'react'
import { Search, Plus, Pencil, Trash2 } from 'lucide-react'
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
import { useElectricityReadings } from '@/features/meters/electricity/api'
import { DeleteElectricityReadingDialog } from '@/features/meters/electricity/components/delete-electricity-reading-dialog'
import { ElectricityReadingFormDialog } from '@/features/meters/electricity/components/electricity-reading-form-dialog'
import type { ElectricityMeterReadingRow } from '@/features/meters/electricity/types'

const PAGE_SIZES = [10, 20, 50]

const formatKwh = (value: number): string =>
  value.toLocaleString('uk-UA', { maximumFractionDigits: 3 })

const formatDate = (value: string): string => new Date(`${value}T00:00:00`).toLocaleDateString('uk-UA')

export default function ElectricityMetersPage() {
  const { roles } = useAuth()
  const canManage = ADMIN_ROLES.some((role) => roles.includes(role))

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ElectricityMeterReadingRow | undefined>(undefined)
  const [deleting, setDeleting] = useState<ElectricityMeterReadingRow | undefined>(undefined)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isPending, isError, error } = useElectricityReadings({ search, page, pageSize })

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div>
      <PageHeader
        title="Лічильники електроенергії"
        description="Журнал показань лічильників електроенергії: попереднє, поточне та розраховане споживання."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Пошук за ділянкою…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Can allow={ADMIN_ROLES}>
              <Button
                onClick={() => {
                  setEditing(undefined)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4" />
                Додати показання
              </Button>
            </Can>
          </div>

          {isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : 'Не вдалося завантажити показання'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Ділянка</TableHead>
                    <TableHead className="text-right">Попереднє</TableHead>
                    <TableHead className="text-right">Поточне</TableHead>
                    <TableHead className="text-right">Споживання, кВт·год</TableHead>
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
                        {search ? 'Нічого не знайдено за запитом.' : 'Показань поки немає.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.data ?? []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.read_on)}</TableCell>
                        <TableCell className="font-mono text-sm">{row.plot_no}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatKwh(row.previous_kwh)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatKwh(row.reading_kwh)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatKwh(row.consumption_kwh)}
                        </TableCell>
                        {canManage && (
                          <TableCell className="w-20">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setEditing(row)
                                  setFormOpen(true)
                                }}
                              >
                                <Pencil className="size-4" />
                                <span className="sr-only">Редагувати</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => setDeleting(row)}
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

      <ElectricityReadingFormDialog
        reading={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={() => setEditing(undefined)}
      />
      {deleting && (
        <DeleteElectricityReadingDialog
          reading={deleting}
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