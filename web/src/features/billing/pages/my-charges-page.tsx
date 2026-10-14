import { CreditCard, ReceiptText, TriangleAlert, Wallet } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { useAuth } from '@/features/auth/auth-context'
import { useMyCharges, useMyMember, useMyPayments } from '@/features/billing/api'
import { billingSummary } from '@/features/billing/business'
import { minorToMajor } from '@/features/charges/business'
import { chargeStatusLabels } from '@/validation/charges'
import { paymentMethodLabels, paymentStatusLabels } from '@/validation/payments'

const uah = (minor: number) => `${minorToMajor(minor)} ₴`

const formatDate = (value: string): string => new Date(`${value}T00:00:00`).toLocaleDateString('uk-UA')

const chargeStatusVariant = (status: string) => {
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

const paymentStatusVariant = (status: string) => {
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

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  isPending,
  alert,
}: {
  icon: typeof Wallet
  label: string
  value?: string
  sub?: string | null
  isPending: boolean
  alert?: boolean
}) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className={`size-4 ${alert ? 'text-destructive' : ''}`} />
          <p className="text-sm">{label}</p>
        </div>
        {isPending ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <>
            <p className={`text-2xl font-semibold ${alert ? 'text-destructive' : ''}`}>
              {value ?? '—'}
            </p>
            {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function MyChargesPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: member, isPending: memberPending, isError: memberError, error: memberErrorMessage } =
    useMyMember(userId)
  const memberId = member?.id ?? ''

  const { data: charges, isPending: chargesPending, isError, error } = useMyCharges(memberId)
  const { data: payments, isPending: paymentsPending } = useMyPayments(memberId)

  const summary = billingSummary(charges ?? [])

  if (memberError)
    return (
      <div>
        <PageHeader title="Мої рахунки" description="Ваші нарахування та історія платежів." />
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
          {memberErrorMessage instanceof Error ? memberErrorMessage.message : 'Не вдалося завантажити дані'}
        </div>
      </div>
    )

  if (!memberPending && !member)
    return (
      <div className="space-y-4">
        <PageHeader title="Мої рахунки" description="Ваші нарахування та історія платежів." />
        <Alert className="max-w-lg">
          <AlertTitle>Обліковий запис не прив’язаний до члена</AlertTitle>
          <AlertDescription>
            Ваш користувацький запис не пов’язано з жодним членом товариства. Зверніться до правління,
            щоб вас прив’язали до запису члена.
          </AlertDescription>
        </Alert>
      </div>
    )

  const loading = !member || chargesPending

  return (
    <div className="space-y-4">
      <PageHeader
        title="Мої рахунки"
        description="Ваші нарахування та історія платежів за поточний рік."
      />

      {isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : 'Не вдалося завантажити рахунки'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={TriangleAlert}
            label="Загальний борг"
            value={loading ? '—' : uah(summary.outstandingMinor)}
            isPending={loading}
            alert={summary.outstandingMinor > 0}
          />
          <StatCard
            icon={CreditCard}
            label="Сплачено"
            value={loading ? '—' : uah(summary.paidMinor)}
            sub={loading ? null : `${summary.totalMinor === 0 ? 0 : Math.round((summary.paidMinor / summary.totalMinor) * 100)}% від нарахованого`}
            isPending={loading}
          />
          <StatCard
            icon={ReceiptText}
            label="Відкритих рахунків"
            value={loading ? '—' : String(summary.openCount)}
            isPending={loading}
          />
          <StatCard
            icon={Wallet}
            label="Загальна сума рахунків"
            value={loading ? '—' : uah(summary.totalMinor)}
            isPending={loading}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Рахунки</CardTitle>
          <CardDescription>Нараховані внески та оплати за послуги.</CardDescription>
        </CardHeader>
        <CardContent>
          {chargesPending ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (charges ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Рахунків поки немає.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Послуга</TableHead>
                    <TableHead className="text-right">Сума</TableHead>
                    <TableHead className="text-right">Сплачено</TableHead>
                    <TableHead className="text-right">Борг</TableHead>
                    <TableHead className="hidden sm:table-cell">Термін</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(charges ?? []).map((charge) => {
                    const remaining = Math.max(0, charge.amount_minor - charge.paid_minor)
                    return (
                      <TableRow key={charge.id}>
                        <TableCell>{formatDate(charge.issued_on)}</TableCell>
                        <TableCell>
                          {charge.contribution_types?.name ?? '—'}
                          {charge.plots ? (
                            <div className="text-xs text-muted-foreground">
                              ділянка {charge.plots.plot_no}
                            </div>
                          ) : null}
                          {charge.period_from && charge.period_to ? (
                            <div className="text-xs text-muted-foreground">
                              період {formatDate(charge.period_from)} — {formatDate(charge.period_to)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {minorToMajor(charge.amount_minor)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {minorToMajor(charge.paid_minor)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {remaining > 0 ? (
                            <span className="text-destructive">{minorToMajor(remaining)}</span>
                          ) : (
                            minorToMajor(remaining)
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {formatDate(charge.due_on)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={chargeStatusVariant(charge.status)}>
                            {chargeStatusLabels[charge.status] ?? charge.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Платіжі</CardTitle>
          <CardDescription>Історія ваших платежів товариству.</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsPending ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (payments ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Платіжів поки немає.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Рахунок</TableHead>
                    <TableHead className="hidden sm:table-cell">Метод</TableHead>
                    <TableHead className="text-right">Сума</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments ?? []).map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.paid_on)}</TableCell>
                      <TableCell>
                        {payment.charges ? (
                          <>
                            <span className="font-mono text-sm">
                              {payment.charges.charge_no ?? '—'}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {payment.charges.contribution_types?.name}
                            </div>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Аванс</span>
                        )}
                        {payment.reference ? (
                          <div className="text-xs text-muted-foreground">реф. {payment.reference}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {paymentMethodLabels[payment.method] ?? payment.method}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {minorToMajor(payment.amount_minor)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={paymentStatusVariant(payment.status)}>
                          {paymentStatusLabels[payment.status] ?? payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}