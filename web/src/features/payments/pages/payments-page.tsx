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
import { FINANCE_ROLES } from '@/config/navigation'
import { Can } from '@/features/auth/guards'
import { useAuth } from '@/features/auth/auth-context'
import { usePayments } from '@/features/payments/api'
import { DeletePaymentDialog } from '@/features/payments/components/delete-payment-dialog'
import { PaymentFormDialog } from '@/features/payments/components/payment-form-dialog'
import type { PaymentRow } from '@/features/payments/types'
import { minorToMajor } from '@/features/charges/business'
import { paymentMethodLabels, paymentStatusLabels } from '@/validation/payments'

const PAGE_SIZES = [10, 20, 50]

const statusVariant = (status: string) => {
  switch (status) {
    case 'cleared':
      return 'default'
    case 'matched':
      return 'secondary'
    case 'pending':
      return 'secondary'
    default:
      return 'outline'
  }
}

const formatDate = (value: string): string => new Date(`${value}T00:00:00`).toLocaleDateString('uk-UA')

export default function PaymentsPage() {
  const { roles } = useAuth()
  const canManage = FINANCE_ROLES.some((role) => roles.includes(role))

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentRow | undefined>(undefined)
  const [deleting, setDeleting] = useState<PaymentRow | undefined>(undefined)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isPending, isError, error } = usePayments({ search, page, pageSize })

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div>
      <PageHeader
        title="Платежі"
        description="Історія платежів членів — часткові оплати, аванси та списання за рахунками."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Пошук за референсом або номером рахунку…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Can allow={FINANCE_ROLES}>
              <Button
                onClick={() => {
                  setEditing(undefined)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4" />
                Новий платіж
              </Button>
            </Can>
          </div>

          {isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : 'Не вдалося завантажити платежі'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Член</TableHead>
                    <TableHead>Рахунок</TableHead>
                    <TableHead className="hidden sm:table-cell">Метод</TableHead>
                    <TableHead className="text-right">Сума, ₴</TableHead>
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
                        {search ? 'Нічого не знайдено за запитом.' : 'Платежів поки немає.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.data ?? []).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDate(payment.paid_on)}</TableCell>
                        <TableCell>
                          {payment.members
                            ? `${payment.members.last_name}, ${payment.members.first_name}`
                            : '—'}
                          {payment.reference ? (
                            <div className="text-xs text-muted-foreground">
                              реф. {payment.reference}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {payment.charges ? (
                            <>
                              <span className="font-mono text-sm">
                                {payment.charges.charge_no ?? '—'}
                              </span>
                              <div className="text-xs text-muted-foreground">
                                {payment.charges.contribution_types?.name}
                                {payment.charges.plots
                                  ? ` · ділянка ${payment.charges.plots.plot_no}`
                                  : ''}
                              </div>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">Аванс</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {paymentMethodLabels[payment.method] ?? payment.method}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {minorToMajor(payment.amount_minor)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(payment.status)}>
                            {paymentStatusLabels[payment.status] ?? payment.status}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="w-20">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setEditing(payment)
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
                                onClick={() => setDeleting(payment)}
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

      <PaymentFormDialog
        payment={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={() => setEditing(undefined)}
      />
      {deleting && (
        <DeletePaymentDialog
          payment={deleting}
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