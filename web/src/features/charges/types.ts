import type { TariffUnit } from '@/features/tariffs/types'

export type ChargeRole = 'membership' | 'meter' | 'manual'

export type Charge = {
  id: string
  charge_no: string | null
  member_id: string
  plot_id: string | null
  contribution_type_id: string
  tariff_id: string | null
  water_meter_reading_id: string | null
  electricity_meter_reading_id: string | null
  period_from: string | null
  period_to: string | null
  quantity: number
  unit: TariffUnit
  unit_price_minor: number
  amount_minor: number
  currency: string
  status: string
  issued_on: string
  due_on: string
  paid_minor: number
  note: string | null
  created_at: string
  updated_at: string
}

export type ChargeRow = Charge & {
  members: { member_no: string; first_name: string; last_name: string } | null
  plots: { plot_no: string } | null
  contribution_types: { name: string } | null
  tariffs: {
    name: string
    unit: string
    valid_from: string
    valid_to: string | null
    amount_minor: number
  } | null
}

export type ChargeWriteInput = {
  member_id: string
  plot_id: string | null
  contribution_type_id: string
  tariff_id: string | null
  water_meter_reading_id?: string | null
  electricity_meter_reading_id?: string | null
  period_from?: string | null
  period_to?: string | null
  quantity: number
  unit: TariffUnit
  unit_price_minor: number
  due_on: string
  note: string | null
}