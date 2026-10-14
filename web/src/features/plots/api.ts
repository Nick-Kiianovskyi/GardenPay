import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { OwnerSummary, Plot, PlotRow, PlotWriteInput } from '@/features/plots/types'

const PLOTS_KEY = ['plots'] as const
const OWNER_OPTIONS_KEY = ['plot-owner-options'] as const

type Row = PlotRow & { members: OwnerSummary | null }

export type PlotsQuery = {
  search: string
  page: number
  pageSize: number
}

export type PlotsResult = {
  data: PlotRow[]
  count: number
}

export async function fetchPlots({ search, page, pageSize }: PlotsQuery): Promise<PlotsResult> {
  if (!supabase) throw new Error('Supabase is not configured')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const query = supabase
    .from('plots')
    .select(
      `id, plot_no, area_m2, zone, soil_type, owner_id, notes, status, created_at, updated_at,
       members(id, member_no, first_name, last_name)`,
      { count: 'exact' }
    )

  const term = search.trim().toLowerCase()
  if (term) {
    query.or(`plot_no.ilike.%${term}%,zone.ilike.%${term}%,soil_type.ilike.%${term}%`)
  }

  query.order('plot_no', { ascending: true }).range(from, to)

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data as unknown as Row[]) ?? [], count: count ?? 0 }
}

export function usePlots(query: PlotsQuery) {
  return useQuery({
    queryKey: [...PLOTS_KEY, query],
    queryFn: () => fetchPlots(query),
    placeholderData: keepPreviousData,
  })
}

export type OwnerOption = {
  id: string
  member_no: string
  first_name: string
  last_name: string
}

export async function fetchOwnerOptions(): Promise<OwnerOption[]> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('members')
    .select('id, member_no, first_name, last_name')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as OwnerOption[]
}

export function useOwnerOptions() {
  return useQuery({
    queryKey: OWNER_OPTIONS_KEY,
    queryFn: fetchOwnerOptions,
    staleTime: 60_000,
  })
}

export function useCreatePlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PlotWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase.from('plots').insert(input).select().single()
      if (error) throw error
      return data as Plot
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PLOTS_KEY }),
  })
}

export function useUpdatePlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & PlotWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('plots')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Plot
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PLOTS_KEY }),
  })
}

export function useDeletePlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase is not configured')
      // assignment history has on-delete-restrict FK on plot_id, and the
      // plots_owner_sync trigger opens an open assignment; clean up first.
      const { error: assignmentsError } = await supabase
        .from('plot_assignments')
        .delete()
        .eq('plot_id', id)
      if (assignmentsError) throw assignmentsError
      const { error } = await supabase.from('plots').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PLOTS_KEY }),
  })
}