import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Member, MemberWriteInput } from '@/features/members/types'

const MEMBERS_KEY = ['members'] as const

export type MembersQuery = {
  search: string
  page: number
  pageSize: number
}

export type MembersResult = {
  data: Member[]
  count: number
}

export async function fetchMembers({ search, page, pageSize }: MembersQuery): Promise<MembersResult> {
  if (!supabase) throw new Error('Supabase is not configured')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const query = supabase.from('members').select('*', { count: 'exact' })

  const term = search.trim().toLowerCase()
  if (term) {
    query.or(
      `member_no.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`
    )
  }

  query
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .range(from, to)

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data as Member[]) ?? [], count: count ?? 0 }
}

export function useMembers(query: MembersQuery) {
  return useQuery({
    queryKey: [...MEMBERS_KEY, query],
    queryFn: () => fetchMembers(query),
    placeholderData: keepPreviousData,
  })
}

export function useCreateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: MemberWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('members')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as Member
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  })
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & MemberWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('members')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Member
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  })
}

export function useDeleteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase.from('members').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  })
}