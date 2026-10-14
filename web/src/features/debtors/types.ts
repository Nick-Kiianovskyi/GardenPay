export type DebtByMemberRow = {
  member_id: string
  member_no: string
  member_name: string
  status: string
  charges_minor: number
  payments_minor: number
  debt_minor: number
}

export type DebtByPlotRow = {
  plot_id: string
  plot_no: string
  member_no: string | null
  owner_name: string | null
  charges_minor: number
  payments_minor: number
  debt_minor: number
}

export type DebtByServiceRow = {
  contribution_type_id: string
  code: string
  name: string
  kind: string
  charges_minor: number
  payments_minor: number
  debt_minor: number
}

export type DebtOverallRow = {
  charges_minor: number
  payments_minor: number
  debt_minor: number
  debtors_count: number
}

export type DebtScope = 'member' | 'plot' | 'service'