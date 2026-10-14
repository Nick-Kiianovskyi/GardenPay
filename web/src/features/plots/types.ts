export const PLOT_STATUSES = ['free', 'allocated', 'reserved', 'out_of_service'] as const

export type PlotStatus = (typeof PLOT_STATUSES)[number]

export type OwnerSummary = {
  id: string
  member_no: string
  first_name: string
  last_name: string
}

export type Plot = {
  id: string
  plot_no: string
  area_m2: number
  zone: string | null
  soil_type: string | null
  owner_id: string | null
  notes: string | null
  status: PlotStatus
  created_at: string
  updated_at: string
}

export type PlotRow = Plot & {
  members: OwnerSummary | null
}

export type PlotWriteInput = {
  plot_no: string
  area_m2: number
  zone: string | null
  soil_type: string | null
  owner_id: string | null
  notes: string | null
  status: PlotStatus
}