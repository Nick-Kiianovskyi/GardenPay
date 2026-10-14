import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDebtorCharges, useDebtorPayments } from '@/features/debtors/api'
import type { DebtScope } from '@/features/debtors/types'
import { minorToMajor } from '@/features/charges/business'
import { PaymentFormDialog } from '@/features/payments/components/payment-form-dialog'
import { chargeStatusLabels } from '@/validation/charges'
import { paymentStatusLabels } from '@/validation/payments'

export type DebtEntity = {
  scope: DebtScope
  id: string
  title: string
  subtitle: string
  memberId?: string
}

type Props = {
  entity: DebtEntity
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'paid':
      return 'default'
    case 'partially_paid':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function DebtDetailDialog({ entity, open, onOpenChange }: Props) {
  const filter =
    entity.scope === 'member'
      ? { memberId: entity.id }
      : entity.scope === 'plot'
        ? { plotId: entity.id }
        : { serviceId: entity.id }

  const charges = useDebtorCharges(open ? filter : null)
  const payments = useDebtorPayments(open ? filter : null)

  const [paymentOpen, setPaymentOpen] = useState(false)

  const canCreate = entity.scope === 'member'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{entity.title}</DialogTitle>
          <DialogDescription>{entity.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Рахунки</h3>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>№</TableHead>
                    <TableHead className="hidden sm:table-cell">Послуга</TableHead>
                    <TableHead className="text-right">Сума, ₴</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Сплачено, ₴</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.isPending ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : (charges.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        Рахунків немає.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (charges.data ?? []).map((charge) => (
                      <TableRow key={charge.id}>
                        <TableCell className="font-mono text-sm">{charge.charge_no}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {charge.contribution_types?.name ?? '—'}
                          {charge.plots ? (
                            <div className="text-xs text-muted-foreground">
                              ділянка {charge.plots.plot_no}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {minorToMajor(charge.amount_minor)}
                        </TableCell>
                        <TableCell className="text-right hidden font-mono sm:table-cell">
                          {minorToMajor(charge.paid_minor)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(charge.status)}>
                            {chargeStatusLabels[charge.status] ?? charge.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Платежі</h3>
              {canCreate && (
                <Button size="sm" onClick={() => setPaymentOpen(true)}>
                  <Plus className="size-4" />
                  Новий платіж
                </Button>
              )}
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Рахунок</TableHead>
                    <TableHead className="text-right">Сума, ₴</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.isPending ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : (payments.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        Платежів немає.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (payments.data ?? []).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {new Date(`${payment.paid_on}T00:00:00`).toLocaleDateString('uk-UA')}
                        </TableCell>
                        <TableCell>
                          {payment.charges?.charge_no ?? (
                            <span className="text-muted-foreground">Аванс</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {minorToMajor(payment.amount_minor)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {paymentStatusLabels[payment.status] ?? payment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            Рахунки створюються та редагуються в модулі «Рахунки», платежі — у модулі
            «Платежі». Перерахунок боргу відбувається автоматично.
          </p>
        </div>
      </DialogContent>

      <PaymentFormDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSaved={() => {}}
        initialMemberId={entity.scope === 'member' ? entity.id : undefined}
      />
    </Dialog>
  )
}