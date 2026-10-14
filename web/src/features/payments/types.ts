export type Payment = {
  id: string
  member_id: string
  charge_id: string | null
  amount_minor: number
  kind: string
  method: string
  status: string
  paid_on: string
  reference: string | null
  received_by: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export type PaymentRow = Payment & {
  members: { member_no: string; first_name: string; last_name: string } | null
  charges: {
    charge_no: string | null
    plots: { plot_no: string } | null
    contribution_types: { name: string } | null
  } | null
}

export type PaymentWriteInput = {
  member_id: string
  charge_id: string | null
  amount_minor: number
  kind: 'payment' | 'refund'
  method: string
  status: string
  paid_on: string
  reference: string | null
  note: string | null
}

export type OpenChargeOption = {
  id: string
  charge_no: string | null
  amount_minor: number
  paid_minor: number
  contribution_types: { name: string } | null
  plots: { plot_no: string } | null
}

export const remainingMinor = (charge: { amount_minor: number; paid_minor: number }): number =>
  Math.max(0, charge.amount_minor - charge.paid_minor)