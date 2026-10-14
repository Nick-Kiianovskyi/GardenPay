import { TARIFF_UNITS } from '@/validation/tariffs'

export type TariffUnit = (typeof TARIFF_UNITS)[number]

export type Tariff = {
  id: string
  contribution_type_id: string
  name: string
  unit: TariffUnit
  amount_minor: number
  currency: string
  valid_from: string
  valid_to: string | null
  created_at: string
  updated_at: string
}

export type TariffRow = Tariff & {
  contribution_types: { name: string } | null
}

export type TariffWriteInput = {
  contribution_type_id: string
  name: string
  unit: TariffUnit
  amount_minor: number
  valid_from: string
  valid_to: string | null
}

export type TariffStatus = 'current' | 'future' | 'ended'