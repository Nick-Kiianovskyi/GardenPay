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
import { useContributionTypes } from '@/features/contribution-types/api'
import { DeleteContributionTypeDialog } from '@/features/contribution-types/components/delete-contribution-type-dialog'
import { ContributionTypeFormDialog } from '@/features/contribution-types/components/contribution-type-form-dialog'
import type { ContributionType } from '@/features/contribution-types/types'
import {
  billingModeLabels,
  contributionKindLabels,
  meterKindLabels,
} from '@/validation/contribution-types'

const PAGE_SIZES = [10, 20, 50]

export default function ContributionTypesPage() {
  const { roles } = useAuth()
  const canManage = ADMIN_ROLES.some((role) => roles.includes(role))

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ContributionType | undefined>(undefined)
  const [deleting, setDeleting] = useState<ContributionType | undefined>(undefined)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isPending, isError, error } = useContributionTypes({ search, page, pageSize })

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const openEdit = (contribution: ContributionType) => {
    setEditing(contribution)
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Види внесків"
        description="Довідник видів внесків — членський внесок, вода, електроенергія, цільові внески тощо."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Пошук за назвою…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Can allow={ADMIN_ROLES}>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Додати вид внеску
              </Button>
            </Can>
          </div>

          {isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : 'Не вдалося завантажити види внесків'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Назва</TableHead>
                    <TableHead className="hidden sm:table-cell">Вид</TableHead>
                    <TableHead className="hidden sm:table-cell">Нарахування</TableHead>
                    <TableHead className="hidden lg:table-cell">Лічильник</TableHead>
                    <TableHead>Статус</TableHead>
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
                        {search ? 'Нічого не знайдено за запитом.' : 'Видів внесків поки немає.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.data ?? []).map((contribution) => (
                      <TableRow key={contribution.id}>
                        <TableCell>
                          <div className="font-medium">{contribution.name}</div>
                          {contribution.description ? (
                            <div className="max-w-60 truncate text-xs text-muted-foreground">
                              {contribution.description}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {contributionKindLabels[contribution.kind]}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {billingModeLabels[contribution.billing_mode]}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {contribution.meter_kind ? meterKindLabels[contribution.meter_kind] : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={contribution.is_active ? 'default' : 'secondary'}>
                            {contribution.is_active ? 'активний' : 'неактивний'}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="w-20">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openEdit(contribution)}
                              >
                                <Pencil className="size-4" />
                                <span className="sr-only">Редагувати</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => setDeleting(contribution)}
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

      <ContributionTypeFormDialog
        contribution={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={() => setEditing(undefined)}
      />
      {deleting && (
        <DeleteContributionTypeDialog
          contribution={deleting}
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