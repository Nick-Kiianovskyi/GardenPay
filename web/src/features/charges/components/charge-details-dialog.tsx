import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ChargeRow } from '@/features/charges/types'
import { minorToMajor } from '@/features/charges/business'
import { chargeStatusLabels } from '@/validation/charges'
import { unitLabels } from '@/validation/tariffs'

type Props = {
  charge: ChargeRow
  open: boolean
  onOpenChange: (open: boolean) => void
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-3 gap-2 border-b py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="col-span-2">{children}</dd>
  </div>
)

const formatDate = (value: string | null): string =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString('uk-UA') : '—'

export function ChargeDetailsDialog({ charge, open, onOpenChange }: Props) {
  const member = charge.members
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Нарахування {charge.charge_no ?? charge.id.slice(0, 8)}</DialogTitle>
          <DialogDescription>
            Документ створено {formatDate(charge.issued_on)} · статус: {chargeStatusLabels[charge.status]}
          </DialogDescription>
        </DialogHeader>
        <dl>
          <Row label="Член">
            {member
              ? `${member.last_name}, ${member.first_name} (${member.member_no})`
              : '—'}
          </Row>
          <Row label="Ділянка">{charge.plots?.plot_no ?? '—'}</Row>
          <Row label="Послуга">{charge.contribution_types?.name ?? '—'}</Row>
          <Row label="Період">
            {formatDate(charge.period_from)} — {formatDate(charge.period_to)}
          </Row>
          <Row label="Тариф (знімок)">
            {charge.tariffs ? charge.tariffs.name : '—'}
          </Row>
          <Row label="Обсяг">
            {charge.quantity.toLocaleString('uk-UA', { maximumFractionDigits: 3 })}{' '}
            {unitLabels[charge.unit] ?? charge.unit}
          </Row>
          <Row label="Ставка">
            {minorToMajor(charge.unit_price_minor)} {charge.currency}
          </Row>
          <Row label="Сума">{minorToMajor(charge.amount_minor)} {charge.currency}</Row>
          <Row label="Сплачено">{minorToMajor(charge.paid_minor)} {charge.currency}</Row>
          <Row label="Залишок">
            {minorToMajor(Math.max(0, charge.amount_minor - charge.paid_minor))} {charge.currency}
          </Row>
          <Row label="Термін оплати">{formatDate(charge.due_on)}</Row>
          <Row label="Примітка">{charge.note ?? '—'}</Row>
        </dl>
      </DialogContent>
    </Dialog>
  )
}