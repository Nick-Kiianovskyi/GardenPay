import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tariff, TariffRow, TariffWriteInput } from '@/features/tariffs/types'

const KEY = ['tariffs'] as const
const SERVICES_KEY = ['tariff-services'] as const

export type TariffsQuery = {
  search: string
  page: number
  pageSize: number
}

export type TariffsResult = {
  data: TariffRow[]
  count: number
}

export async function fetchTariffs({
  search,
  page,
  pageSize,
}: TariffsQuery): Promise<TariffsResult> {
  if (!supabase) throw new Error('Supabase is not configured')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const query = supabase
    .from('tariffs')
    .select(
      `id, contribution_type_id, name, unit, amount_minor, currency, valid_from, valid_to, created_at, updated_at,
       contribution_types(name)`,
      { count: 'exact' }
    )

  const term = search.trim().toLowerCase()
  if (term) {
    query.or(`name.ilike.%${term}%`)
  }

  query
    .order('name', { referencedTable: 'contribution_types', ascending: true })
    .order('valid_from', { ascending: false })
    .range(from, to)

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data as unknown as TariffRow[]) ?? [], count: count ?? 0 }
}

export function useTariffs(query: TariffsQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => fetchTariffs(query),
    placeholderData: keepPreviousData,
  })
}

export type ServiceOption = {
  id: string
  name: string
  is_active: boolean
}

export async function fetchServiceOptions(): Promise<ServiceOption[]> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('contribution_types')
    .select('id, name, is_active')
    .order('name', { ascending: true })
  if (error) throw error
  return (data as ServiceOption[]) ?? []
}

export function useServiceOptions() {
  return useQuery({
    queryKey: SERVICES_KEY,
    queryFn: fetchServiceOptions,
    staleTime: 60_000,
  })
}

export function useCreateTariff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TariffWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase.from('tariffs').insert(input).select().single()
      if (error) throw error
      return data as Tariff
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateTariff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & TariffWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('tariffs')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Tariff
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteTariff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase.from('tariffs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}