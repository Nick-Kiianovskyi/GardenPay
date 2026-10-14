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
import { useMembers } from '@/features/members/api'
import { MEMBER_KIND_LABELS, MEMBER_STATUS_LABELS } from '@/validation/members'
import { DeleteMemberDialog } from '@/features/members/components/delete-member-dialog'
import { MemberFormDialog } from '@/features/members/components/member-form-dialog'
import type { Member, MemberStatus } from '@/features/members/types'

const PAGE_SIZES = [10, 20, 50]

const statusVariant = (status: MemberStatus) => {
  switch (status) {
    case 'pending':
      return 'secondary'
    case 'active':
      return 'default'
    case 'suspended':
      return 'destructive'
    case 'lapsed':
      return 'outline'
  }
}

const formatDate = (iso: string | null): string =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('uk-UA') : '—'

export default function MembersPage() {
  const { roles } = useAuth()
  const canManage = ADMIN_ROLES.some((role) => roles.includes(role))

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Member | undefined>(undefined)
  const [deleting, setDeleting] = useState<Member | undefined>(undefined)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isPending, isError, error } = useMembers({ search, page, pageSize })

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const openEdit = (member: Member) => {
    setEditing(member)
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Члени"
        description="Реєстр членів товариства — доступ для читання: Адміністратор, Бухгалтер, Спостерігач."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Пошук за ім’ям, номером, email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Can allow={ADMIN_ROLES}>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Додати члена
              </Button>
            </Can>
          </div>

          {isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : 'Не вдалося завантажити членів'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Член</TableHead>
                    <TableHead className="hidden md:table-cell">№ члена</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Телефон</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="hidden sm:table-cell">Вступив</TableHead>
                    {canManage && <TableHead className="w-20 text-right">Дії</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPending ? (
                    Array.from({ length: pageSize }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={canManage ? 8 : 7}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (data?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 8 : 7}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {search ? 'Нікого не знайдено за запитом.' : 'Членів поки немає.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.data ?? []).map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="font-medium">
                            {member.last_name} {member.first_name}
                          </div>
                          <div className="text-xs text-muted-foreground md:hidden">
                            {member.email ?? member.member_no}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="font-mono text-xs">{member.member_no}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {member.email ?? '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{member.phone ?? '—'}</TableCell>
                        <TableCell>{MEMBER_KIND_LABELS[member.kind]}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(member.status)}>
                            {MEMBER_STATUS_LABELS[member.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {formatDate(member.joined_on)}
                        </TableCell>
                        {canManage && (
                          <TableCell className="w-20">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => openEdit(member)}>
                                <Pencil className="size-4" />
                                <span className="sr-only">Редагувати</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => setDeleting(member)}
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

      <MemberFormDialog
        member={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={() => setEditing(undefined)}
      />
      <DeleteMemberDialog
        member={deleting}
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        onDeleted={() => setDeleting(undefined)}
      />
    </div>
  )
}