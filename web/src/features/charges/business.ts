import type { Tariff } from '@/features/tariffs/types'

export const majorToMinor = (value: string): number =>
  Math.round(Number(value.replace(',', '.')) * 100)

export const minorToMajor = (minor: number): string =>
  (minor / 100).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Number of sotka (100 m² units) for a plot area. */
export const sotkaQuantity = (areaM2: number): number =>
  Math.round((areaM2 / 100) * 1000) / 1000

/**
 * The tariff whose validity window contains `date`, optionally restricted to `unit`.
 * History rows do not overlap per (type, unit), so at most one may be current.
 */
export const tariffAtDate = (
  tariffs: Tariff[],
  date: string,
  unit?: string
): Tariff | undefined =>
  tariffs.find(
    (t) =>
      (unit === undefined || t.unit === unit) &&
      t.valid_from <= date &&
      (t.valid_to === null || t.valid_to > date)
  )

/** Charge amount in minor units: round(quantity × unit price). */
export const chargeAmountMinor = (quantity: number, unitPriceMinor: number): number =>
  Math.round(quantity * unitPriceMinor)