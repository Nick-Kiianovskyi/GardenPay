export const CONTRIBUTION_KINDS = [
  'membership_fee',
  'plot_rent',
  'water',
  'electricity',
  'penalty',
  'one_time',
  'other',
] as const

export const BILLING_MODES = ['periodic', 'metered', 'manual'] as const

export const METER_KINDS = ['water', 'electricity'] as const

export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number]
export type BillingMode = (typeof BILLING_MODES)[number]
export type MeterKind = (typeof METER_KINDS)[number]

export type ContributionType = {
  id: string
  code: string
  name: string
  description: string | null
  kind: ContributionKind
  billing_mode: BillingMode
  meter_kind: MeterKind | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type ContributionTypeWriteInput = {
  name: string
  description: string | null
  kind: ContributionKind
  billing_mode: BillingMode
  meter_kind: MeterKind | null
  is_active: boolean
  sort_order: number
}