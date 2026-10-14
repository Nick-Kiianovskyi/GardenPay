export type ReportKind =
  | 'debtors'
  | 'charges'
  | 'payments'
  | 'water'
  | 'electricity'
  | 'summary'

export type ReportDebtorRow = {
  member_id: string
  member_no: string
  member_name: string
  status: string
  charges_minor: number
  payments_minor: number
  debt_minor: number
}

export type ReportChargeRow = {
  charge_no: string
  member: string | null
  plot_no: string | null
  service: string | null
  issued_on: string
  due_on: string | null
  amount_minor: number
  paid_minor: number
  status: string
}

export type ReportPaymentRow = {
  paid_on: string
  reference: string | null
  member: string | null
  charge_no: string | null
  method: string
  amount_minor: number
  status: string
}

export type ConsumptionRow = {
  read_on: string
  meter_no: string
  plot_no: string
  reading: number
  previous: number
  consumption: number
  note: string | null
}

export type FinancialSummary = {
  charges_total_minor: number
  charges_count: number
  charges_open_minor: number
  charges_partial_minor: number
  charges_paid_minor: number
  payments_received_minor: number
  refunds_minor: number
  payments_total_minor: number
  debt_minor: number
  credit_minor: number
  debtors_count: number
}

export type ChargesByStatusRow = {
  status: string
  count: number
  amount_minor: number
}

export type PaymentsByMethodRow = {
  method: string
  kind: string
  count: number
  amount_minor: number
}

export type MonthlyFinanceRow = {
  month: string
  charges_minor: number
  payments_minor: number
  balance_minor: number
}