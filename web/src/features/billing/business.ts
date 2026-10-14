import type { ChargeRow } from '@/features/charges/types'

export type BillingSummary = {
  openCount: number
  outstandingMinor: number
  paidMinor: number
  totalMinor: number
}

export const billingSummary = (charges: ChargeRow[]): BillingSummary => {
  const open = charges.filter((c) => c.status === 'open' || c.status === 'partially_paid')
  return {
    openCount: open.length,
    outstandingMinor: open.reduce(
      (sum, c) => sum + Math.max(0, c.amount_minor - c.paid_minor),
      0
    ),
    paidMinor: charges.reduce((sum, c) => sum + c.paid_minor, 0),
    totalMinor: charges.reduce((sum, c) => sum + c.amount_minor, 0),
  }
}