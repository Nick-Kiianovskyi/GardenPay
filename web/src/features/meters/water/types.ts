export type WaterMeterReadingRow = {
  id: string
  water_meter_id: string
  read_on: string
  reading_m3: number
  note: string | null
  created_at: string
  meter_no: string
  plot_id: string
  plot_no: string
  previous_m3: number
  consumption_m3: number
}

export type WaterMeterReadingWriteInput = {
  water_meter_id: string
  read_on: string
  reading: number
  note: string | null
}

export type WaterReadingCreateInput = {
  plot_id: string
  read_on: string
  reading: number
  note: string | null
}

export type PlotOption = {
  plot_id: string
  plot_no: string
  water_meter_id: string | null
}