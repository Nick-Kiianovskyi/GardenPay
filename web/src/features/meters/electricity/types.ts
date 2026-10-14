export type ElectricityMeterReadingRow = {
  id: string
  electricity_meter_id: string
  read_on: string
  reading_kwh: number
  note: string | null
  created_at: string
  meter_no: string
  plot_id: string
  plot_no: string
  previous_kwh: number
  consumption_kwh: number
}

export type ElectricityMeterReadingWriteInput = {
  electricity_meter_id: string
  read_on: string
  reading: number
  note: string | null
}

export type ElectricityReadingCreateInput = {
  plot_id: string
  read_on: string
  reading: number
  note: string | null
}

export type PlotOption = {
  plot_id: string
  plot_no: string
  electricity_meter_id: string | null
}