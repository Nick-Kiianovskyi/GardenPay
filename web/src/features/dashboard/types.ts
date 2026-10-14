export type DashboardData = {
  membersCount: number
  plotsCount: number
  paymentsCount: number
  finance: {
    chargesTotalMinor: number
    chargesCount: number
    paymentsTotalMinor: number
    debtMinor: number
    creditMinor: number
    debtorsCount: number
  }
  monthly: { month: string; chargesMinor: number; paymentsMinor: number }[]
  topDebtors: { memberName: string; debtMinor: number }[]
  debtByService: { service: string; debtMinor: number }[]
}