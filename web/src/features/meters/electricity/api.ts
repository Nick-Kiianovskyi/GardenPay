import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  ElectricityMeterReadingRow,
  ElectricityMeterReadingWriteInput,
  ElectricityReadingCreateInput,
  PlotOption,
} from '@/features/meters/electricity/types'

const KEY = ['electricity-readings'] as const
const PLOTS_KEY = ['electricity-plot-options'] as const

export type ElectricityReadingsQuery = {
  search: string
  page: number
  pageSize: number
}

export type ElectricityReadingsResult = {
  data: ElectricityMeterReadingRow[]
  count: number
}

export async function fetchElectricityReadings({
  search,
  page,
  pageSize,
}: ElectricityReadingsQuery): Promise<ElectricityReadingsResult> {
  if (!supabase) throw new Error('Supabase is not configured')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const query = supabase
    .from('v_electricity_meter_readings')
    .select('*', { count: 'exact' })

  const term = search.trim().toLowerCase()
  if (term) {
    query.or(`plot_no.ilike.%${term}%,meter_no.ilike.%${term}%`)
  }

  query.order('read_on', { ascending: false }).range(from, to)

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data as ElectricityMeterReadingRow[]) ?? [], count: count ?? 0 }
}

export function useElectricityReadings(query: ElectricityReadingsQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => fetchElectricityReadings(query),
    placeholderData: keepPreviousData,
  })
}

type RawPlotOption = {
  id: string
  plot_no: string
  electricity_meters: { id: string; meter_no: string; status: string }[]
}

/** All plots, each with its current active electricity meter (if any). */
export async function fetchPlotOptions(): Promise<PlotOption[]> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('plots')
    .select('id, plot_no, electricity_meters(id, meter_no, status)')
    .order('plot_no', { ascending: true })
  if (error) throw error
  const rows = (data as unknown as RawPlotOption[]) ?? []
  return rows.map((row) => {
    const active = row.electricity_meters.find((meter) => meter.status === 'active') ?? null
    return {
      plot_id: row.id,
      plot_no: row.plot_no,
      electricity_meter_id: active?.id ?? null,
    }
  })
}

export function usePlotOptions() {
  return useQuery({
    queryKey: PLOTS_KEY,
    queryFn: fetchPlotOptions,
    staleTime: 30_000,
  })
}

/**
 * Returns the active electricity meter for a plot, creating a hidden one if missing.
 * The user never manages meters — one active meter per plot is provisioned on demand.
 */
async function ensureElectricityMeter(plotId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data: existing, error: findError } = await supabase
    .from('electricity_meters')
    .select('id')
    .eq('plot_id', plotId)
    .eq('status', 'active')
    .maybeSingle()
  if (findError) throw findError
  if (existing) return (existing as unknown as { id: string }).id

  const { data: plot, error: plotError } = await supabase
    .from('plots')
    .select('plot_no')
    .eq('id', plotId)
    .single()
  if (plotError) throw plotError
  const plotNo = (plot as unknown as { plot_no: string }).plot_no

  const base = `E-${plotNo}`
  for (let attempt = 1; attempt <= 10; attempt++) {
    const meterNo = attempt === 1 ? base : `${base}-${attempt}`
    const { data, error } = await supabase
      .from('electricity_meters')
      .insert({ plot_id: plotId, meter_no: meterNo, status: 'active', initial_reading: 0 })
      .select('id')
      .single()
    if (!error && data) return (data as unknown as { id: string }).id
    if (error && error.code !== '23505') throw error
  }
  throw new Error('Не вдалося створити лічильник для ділянки')
}

export async function fetchPreviousReading(
  electricityMeterId: string,
  readOn: string
): Promise<number | null> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('electricity_meter_readings')
    .select('reading')
    .eq('electricity_meter_id', electricityMeterId)
    .lt('read_on', readOn)
    .order('read_on', { ascending: false })
    .limit(1)
  if (error) throw error
  if (data && data.length > 0) return data[0].reading as number

  const { data: meter } = await supabase
    .from('electricity_meters')
    .select('initial_reading')
    .eq('id', electricityMeterId)
    .single()
  return (meter?.initial_reading as number | undefined) ?? 0
}

export function usePreviousReading(electricityMeterId: string | null, readOn: string) {
  return useQuery({
    queryKey: ['electricity-previous-reading', electricityMeterId, readOn],
    queryFn: () => fetchPreviousReading(electricityMeterId!, readOn),
    enabled: Boolean(electricityMeterId && readOn),
    staleTime: 0,
  })
}

export function useCreateElectricityReading() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ElectricityReadingCreateInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const electricityMeterId = await ensureElectricityMeter(input.plot_id)
      const { error } = await supabase.from('electricity_meter_readings').insert({
        electricity_meter_id: electricityMeterId,
        read_on: input.read_on,
        reading: input.reading,
        note: input.note,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY })
      void queryClient.invalidateQueries({ queryKey: PLOTS_KEY })
    },
  })
}

export function useUpdateElectricityReading() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: { id: string } & ElectricityMeterReadingWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase
        .from('electricity_meter_readings')
        .update(input)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteElectricityReading() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase
        .from('electricity_meter_readings')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}