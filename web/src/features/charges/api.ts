import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Charge, ChargeRow, ChargeWriteInput } from '@/features/charges/types'
import type { Tariff } from '@/features/tariffs/types'
import {
  computeMassAccruals,
  type MassAccrualPlot,
  type MassAccrualReading,
  type MassAccrualResult,
  type MassAccrualService,
} from '@/features/charges/mass-accrual'

const KEY = ['charges'] as const

export type ChargesQuery = {
  search: string
  page: number
  pageSize: number
}

export type ChargesResult = {
  data: ChargeRow[]
  count: number
}

type RawRow = Charge & {
  members: { member_no: string; first_name: string; last_name: string } | null
  plots: { plot_no: string } | null
  contribution_types: { name: string } | null
  tariffs: { name: string; unit: string; valid_from: string; valid_to: string | null; amount_minor: number } | null
}

export async function fetchCharges({
  search,
  page,
  pageSize,
}: ChargesQuery): Promise<ChargesResult> {
  if (!supabase) throw new Error('Supabase is not configured')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const query = supabase
    .from('charges')
    .select(
      `id, charge_no, member_id, plot_id, contribution_type_id, tariff_id,
       water_meter_reading_id, electricity_meter_reading_id, period_from, period_to,
       quantity, unit, unit_price_minor, amount_minor, currency, status, issued_on, due_on,
       paid_minor, note, created_at, updated_at,
       members(member_no, first_name, last_name),
       plots(plot_no),
       contribution_types(name),
       tariffs(name, unit, valid_from, valid_to, amount_minor)`,
      { count: 'exact' }
    )

  const term = search.trim().toLowerCase()
  if (term) {
    query.or(`charge_no.ilike.%${term}%,note.ilike.%${term}%`)
  }

  query.order('issued_on', { ascending: false }).range(from, to)

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data as unknown as RawRow[]) ?? [], count: count ?? 0 }
}

export function useCharges(query: ChargesQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => fetchCharges(query),
    placeholderData: keepPreviousData,
  })
}

export type ChargeServiceOption = {
  id: string
  name: string
  kind: 'membership_fee' | 'plot_rent' | 'water' | 'electricity' | 'penalty' | 'one_time' | 'other'
  is_active: boolean
}

export function useChargeServiceOptions() {
  return useQuery({
    queryKey: ['charge-services'],
    queryFn: async (): Promise<ChargeServiceOption[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('contribution_types')
        .select('id, name, kind, is_active')
        .order('name', { ascending: true })
      if (error) throw error
      return (data as ChargeServiceOption[]) ?? []
    },
    staleTime: 60_000,
  })
}

export type ChargePlotOption = {
  id: string
  plot_no: string
  area_m2: number
  owner_id: string | null
  members: { id: string; member_no: string; first_name: string; last_name: string } | null
}

export function useChargePlotOptions() {
  return useQuery({
    queryKey: ['charge-plots'],
    queryFn: async (): Promise<ChargePlotOption[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('plots')
        .select(
          'id, plot_no, area_m2, owner_id, members(id, member_no, first_name, last_name)'
        )
        .order('plot_no', { ascending: true })
      if (error) throw error
      return (data as unknown as ChargePlotOption[]) ?? []
    },
    staleTime: 60_000,
  })
}

export type MemberOption = {
  id: string
  member_no: string
  first_name: string
  last_name: string
}

export function useMemberOptions() {
  return useQuery({
    queryKey: ['charge-members'],
    queryFn: async (): Promise<MemberOption[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('members')
        .select('id, member_no, first_name, last_name')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
      if (error) throw error
      return (data as MemberOption[]) ?? []
    },
    staleTime: 60_000,
  })
}

export type WaterReadingOption = {
  id: string
  read_on: string
  reading_m3: number
  consumption_m3: number
  meter_no: string
}

export function usePlotWaterReadings(plotId: string) {
  return useQuery({
    queryKey: ['charge-water-readings', plotId],
    queryFn: async (): Promise<WaterReadingOption[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('v_water_meter_readings')
        .select('id, read_on, reading_m3, consumption_m3, meter_no')
        .eq('plot_id', plotId)
        .order('read_on', { ascending: false })
      if (error) throw error
      return (data as WaterReadingOption[]) ?? []
    },
    enabled: Boolean(plotId),
  })
}

export type ElectricityReadingOption = {
  id: string
  read_on: string
  reading_kwh: number
  consumption_kwh: number
  meter_no: string
}

export function usePlotElectricityReadings(plotId: string) {
  return useQuery({
    queryKey: ['charge-electricity-readings', plotId],
    queryFn: async (): Promise<ElectricityReadingOption[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('v_electricity_meter_readings')
        .select('id, read_on, reading_kwh, consumption_kwh, meter_no')
        .eq('plot_id', plotId)
        .order('read_on', { ascending: false })
      if (error) throw error
      return (data as ElectricityReadingOption[]) ?? []
    },
    enabled: Boolean(plotId),
  })
}

export function useTariffsForType(contributionTypeId: string) {
  return useQuery({
    queryKey: ['charge-tariffs', contributionTypeId],
    queryFn: async (): Promise<Tariff[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('tariffs')
        .select('*')
        .eq('contribution_type_id', contributionTypeId)
        .order('valid_from', { ascending: false })
      if (error) throw error
      return (data as Tariff[]) ?? []
    },
    enabled: Boolean(contributionTypeId),
  })
}

export function useActiveAccrualPlots() {
  return useQuery({
    queryKey: ['mass-accrual-plots'],
    queryFn: async (): Promise<MassAccrualPlot[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('plots')
        .select(
          'id, plot_no, area_m2, owner_id, members(id, member_no, first_name, last_name)'
        )
        .eq('status', 'allocated')
        .order('plot_no', { ascending: true })
      if (error) throw error
      return (data as unknown as MassAccrualPlot[]) ?? []
    },
    staleTime: 60_000,
  })
}

export function useMassAccrualServiceOptions() {
  return useQuery({
    queryKey: ['mass-accrual-services'],
    queryFn: async (): Promise<MassAccrualService[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('contribution_types')
        .select('id, name, kind, billing_mode, meter_kind, is_active')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return (data as MassAccrualService[]) ?? []
    },
    staleTime: 60_000,
  })
}

export type MassAccrualPreviewInput = {
  service: MassAccrualService
  periodFrom: string
  periodTo: string
  manualAmountMinor: number
}

/**
 * Reads plots/tariffs/readings and computes the accrual preview in memory.
 * No rows are inserted — safe to run repeatedly before saving.
 */
export function usePreviewMassAccrual() {
  return useMutation({
    mutationFn: async (input: MassAccrualPreviewInput): Promise<MassAccrualResult> => {
      if (!supabase) throw new Error('Supabase is not configured')

      const plotsQuery = supabase
        .from('plots')
        .select(
          'id, plot_no, area_m2, owner_id, members(id, member_no, first_name, last_name)'
        )
        .eq('status', 'allocated')
        .order('plot_no', { ascending: true })

      const tariffsQuery = supabase
        .from('tariffs')
        .select('*')
        .eq('contribution_type_id', input.service.id)

      const [plotsRes, tariffsRes] = await Promise.all([plotsQuery, tariffsQuery])
      if (plotsRes.error) throw plotsRes.error
      if (tariffsRes.error) throw tariffsRes.error

      let readings: MassAccrualReading[] = []
      if (input.service.billing_mode === 'metered') {
        const view =
          input.service.meter_kind === 'electricity'
            ? 'v_electricity_meter_readings'
            : 'v_water_meter_readings'
        const consumptionField =
          input.service.meter_kind === 'electricity' ? 'consumption_kwh' : 'consumption_m3'

        const { data, error } = await supabase
          .from(view)
          .select(`id, plot_id, read_on, ${consumptionField}`)
          .gte('read_on', input.periodFrom)
          .lte('read_on', input.periodTo)
          .order('read_on', { ascending: true })
        if (error) throw error

        readings = (data as unknown as Record<string, unknown>[]).map((row) => ({
          id: row.id as string,
          plot_id: row.plot_id as string,
          read_on: row.read_on as string,
          consumption: Number(row[consumptionField]),
        }))
      }

      return computeMassAccruals({
        service: input.service,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        manualAmountMinor: input.manualAmountMinor,
        plots: (plotsRes.data as unknown as MassAccrualPlot[]) ?? [],
        tariffs: (tariffsRes.data as Tariff[]) ?? [],
        readings,
      })
    },
  })
}

export function useSaveMassAccrual() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rows: ChargeWriteInput[]) => {
      if (!supabase) throw new Error('Supabase is not configured')
      if (rows.length === 0) return 0
      const { data, error } = await supabase.from('charges').insert(rows).select('id')
      if (error) throw error
      return data?.length ?? 0
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useCreateCharge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ChargeWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase.from('charges').insert(input).select().single()
      if (error) throw error
      return data as Charge
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteCharge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase.from('charges').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}