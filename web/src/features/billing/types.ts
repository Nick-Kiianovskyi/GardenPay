import type { ChargeRow } from '@/features/charges/types'
import type { Member } from '@/features/members/types'
import type { PaymentRow } from '@/features/payments/types'

export type MyPlotAssignment = {
  id: string
  relation: 'owner' | 'tenant'
  start_on: string
  end_on: string | null
  plots: { plot_no: string; area_m2: number; zone: string | null; status: string } | null
}

export type { ChargeRow, Member, PaymentRow }