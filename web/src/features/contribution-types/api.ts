import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  ContributionType,
  ContributionTypeWriteInput,
} from '@/features/contribution-types/types'

const KEY = ['contribution-types'] as const

export type ContributionTypesQuery = {
  search: string
  page: number
  pageSize: number
}

export type ContributionTypesResult = {
  data: ContributionType[]
  count: number
}

export async function fetchContributionTypes({
  search,
  page,
  pageSize,
}: ContributionTypesQuery): Promise<ContributionTypesResult> {
  if (!supabase) throw new Error('Supabase is not configured')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const query = supabase.from('contribution_types').select('*', { count: 'exact' })

  const term = search.trim()
  if (term) {
    query.ilike('name', `%${term}%`)
  }

  query
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .range(from, to)

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data as ContributionType[]) ?? [], count: count ?? 0 }
}

export function useContributionTypes(query: ContributionTypesQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => fetchContributionTypes(query),
    placeholderData: keepPreviousData,
  })
}

const CODE_PREFIX = 'ct_'

async function nextContributionTypeSeq(): Promise<number> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.from('contribution_types').select('code')
  if (error) throw error
  let max = 0
  for (const row of (data ?? []) as { code: string }[]) {
    const match = /^ct_(\d+)$/.exec(row.code)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

export function useCreateContributionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ContributionTypeWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const seq = await nextContributionTypeSeq()
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = `${CODE_PREFIX}${String(seq + attempt).padStart(4, '0')}`
        const { data, error } = await supabase
          .from('contribution_types')
          .insert({ code, ...input })
          .select()
          .single()
        if (!error) return data as ContributionType
        if (error.code !== '23505') throw error
      }
      throw new Error('Не вдалося згенерувати унікальний код')
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateContributionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: { id: string } & ContributionTypeWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('contribution_types')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ContributionType
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteContributionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase.from('contribution_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}