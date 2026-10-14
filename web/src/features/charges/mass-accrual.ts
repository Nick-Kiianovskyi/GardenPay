import type {
  BillingMode,
  ContributionKind,
  MeterKind,
} from '@/features/contribution-types/types'
import type { Tariff, TariffUnit } from '@/features/tariffs/types'
import type { ChargeWriteInput } from '@/features/charges/types'
import { chargeAmountMinor, sotkaQuantity, tariffAtDate } from '@/features/charges/business'

export type MassAccrualService = {
  id: string
  name: string
  kind: ContributionKind
  billing_mode: BillingMode
  meter_kind: MeterKind | null
  is_active: boolean
}

export type MassAccrualOwner = {
  id: string
  member_no: string
  first_name: string
  last_name: string
}

export type MassAccrualPlot = {
  id: string
  plot_no: string
  area_m2: number
  owner_id: string | null
  members: MassAccrualOwner | null
}

export type MassAccrualReading = {
  id: string
  plot_id: string
  read_on: string
  consumption: number
}

export type MassAccrualRow = {
  plotId: string
  plotNo: string
  memberId: string
  ownerName: string
  periodFrom: string
  periodTo: string
  quantity: number
  unit: TariffUnit
  unitPriceMinor: number
  tariffId: string | null
  waterMeterReadingId: string | null
  electricityMeterReadingId: string | null
  amountMinor: number
}

export type MassAccrualSkip = {
  plotNo: string
  ownerName: string
  reason: string
}

export type MassAccrualResult = {
  rows: MassAccrualRow[]
  skipped: MassAccrualSkip[]
}

export type MassAccrualParams = {
  service: MassAccrualService
  periodFrom: string
  periodTo: string
  manualAmountMinor: number
  plots: MassAccrualPlot[]
  tariffs: Tariff[]
  readings?: MassAccrualReading[]
}

const ownerLabel = (owner: MassAccrualOwner | null): string =>
  owner ? `${owner.last_name} ${owner.first_name}` : '—'

/** Latest reading per plot (readings are already scoped to the period). */
const latestReadingsByPlot = (
  readings: MassAccrualReading[]
): Map<string, MassAccrualReading> => {
  const map = new Map<string, MassAccrualReading>()
  for (const reading of readings) {
    const previous = map.get(reading.plot_id)
    if (!previous || reading.read_on > previous.read_on) {
      map.set(reading.plot_id, reading)
    }
  }
  return map
}

/**
 * Pure preview builder: for every active plot produce one accrual line, or a
 * skip reason when the contribution type cannot be priced automatically.
 * Performs no I/O and never touches the database.
 */
export function computeMassAccruals(params: MassAccrualParams): MassAccrualResult {
  const { service, periodFrom, periodTo, manualAmountMinor, plots, tariffs } = params
  const readingsByPlot = latestReadingsByPlot(params.readings ?? [])

  const rows: MassAccrualRow[] = []
  const skipped: MassAccrualSkip[] = []

  for (const plot of plots) {
    const owner = plot.members
    const ownerName = ownerLabel(owner)

    if (!owner) {
      skipped.push({ plotNo: plot.plot_no, ownerName, reason: 'Ділянка без власника' })
      continue
    }

    const base = {
      plotId: plot.id,
      plotNo: plot.plot_no,
      memberId: owner.id,
      ownerName,
      periodFrom,
      periodTo,
      waterMeterReadingId: null as string | null,
      electricityMeterReadingId: null as string | null,
    }

    if (service.billing_mode === 'periodic') {
      const tariff = tariffAtDate(tariffs, periodFrom)
      if (!tariff) {
        skipped.push({
          plotNo: plot.plot_no,
          ownerName,
          reason: 'Немає тарифу на початок періоду',
        })
        continue
      }
      const quantity = sotkaQuantity(plot.area_m2)
      rows.push({
        ...base,
        quantity,
        unit: tariff.unit,
        unitPriceMinor: tariff.amount_minor,
        tariffId: tariff.id,
        amountMinor: chargeAmountMinor(quantity, tariff.amount_minor),
      })
      continue
    }

    if (service.billing_mode === 'metered') {
      const reading = readingsByPlot.get(plot.id)
      if (!reading) {
        skipped.push({
          plotNo: plot.plot_no,
          ownerName,
          reason: 'Немає показань за період',
        })
        continue
      }
      const unit: TariffUnit = service.meter_kind === 'electricity' ? 'kwh' : 'm3'
      const tariff = tariffAtDate(tariffs, reading.read_on, unit)
      if (!tariff) {
        skipped.push({
          plotNo: plot.plot_no,
          ownerName,
          reason: 'Немає тарифу на дату показання',
        })
        continue
      }
      rows.push({
        ...base,
        quantity: reading.consumption,
        unit: tariff.unit,
        unitPriceMinor: tariff.amount_minor,
        tariffId: tariff.id,
        waterMeterReadingId: service.meter_kind === 'water' ? reading.id : null,
        electricityMeterReadingId: service.meter_kind === 'electricity' ? reading.id : null,
        amountMinor: chargeAmountMinor(reading.consumption, tariff.amount_minor),
      })
      continue
    }

    // manual billing: a single amount applies to every active plot
    if (manualAmountMinor <= 0) {
      skipped.push({ plotNo: plot.plot_no, ownerName, reason: 'Не вказано суму внеску' })
      continue
    }
    rows.push({
      ...base,
      quantity: 1,
      unit: 'fixed',
      unitPriceMinor: manualAmountMinor,
      tariffId: null,
      amountMinor: manualAmountMinor,
    })
  }

  return { rows, skipped }
}

export function massRowToCharge(
  row: MassAccrualRow,
  service: MassAccrualService,
  dueOn: string,
  note: string | null
): ChargeWriteInput {
  return {
    member_id: row.memberId,
    plot_id: row.plotId,
    contribution_type_id: service.id,
    tariff_id: row.tariffId,
    water_meter_reading_id: row.waterMeterReadingId,
    electricity_meter_reading_id: row.electricityMeterReadingId,
    period_from: row.periodFrom,
    period_to: row.periodTo,
    quantity: row.quantity,
    unit: row.unit,
    unit_price_minor: row.unitPriceMinor,
    due_on: dueOn,
    note,
  }
}
