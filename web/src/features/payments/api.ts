import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  OpenChargeOption,
  Payment,
  PaymentRow,
  PaymentWriteInput,
} from '@/features/payments/types'

const KEY = ['payments'] as const
const CHARGES_KEY = ['payment-open-charges'] as const
const MEMBERS_KEY = ['payment-members'] as const

export type PaymentsQuery = {
  search: string
  page: number
  pageSize: number
}

export type PaymentsResult = {
  data: PaymentRow[]
  count: number
}

type RawRow = Payment & {
  members: { member_no: string; first_name: string; last_name: string } | null
  charges: {
    charge_no: string | null
    plots: { plot_no: string } | null
    contribution_types: { name: string } | null
  } | null
}

export async function fetchPayments({
  search,
  page,
  pageSize,
}: PaymentsQuery): Promise<PaymentsResult> {
  if (!supabase) throw new Error('Supabase is not configured')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const query = supabase
    .from('payments')
    .select(
      `id, member_id, charge_id, amount_minor, kind, method, status, paid_on, reference,
       received_by, note, created_at, updated_at,
       members(member_no, first_name, last_name),
       charges(charge_no, plots(plot_no), contribution_types(name))`,
      { count: 'exact' }
    )

  const term = search.trim().toLowerCase()
  if (term) {
    query.or(`reference.ilike.%${term}%,charges.charge_no.ilike.%${term}%`)
  }

  query.order('paid_on', { ascending: false }).order('created_at', { ascending: false }).range(from, to)

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data as unknown as RawRow[]) ?? [], count: count ?? 0 }
}

export function usePayments(query: PaymentsQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => fetchPayments(query),
    placeholderData: keepPreviousData,
  })
}

export type PaymentMemberOption = {
  id: string
  member_no: string
  first_name: string
  last_name: string
}

export function usePaymentMemberOptions() {
  return useQuery({
    queryKey: MEMBERS_KEY,
    queryFn: async (): Promise<PaymentMemberOption[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('members')
        .select('id, member_no, first_name, last_name')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
      if (error) throw error
      return (data as PaymentMemberOption[]) ?? []
    },
    staleTime: 60_000,
  })
}

export function useOpenChargesForMember(memberId: string) {
  return useQuery({
    queryKey: [...CHARGES_KEY, memberId],
    queryFn: async (): Promise<OpenChargeOption[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('charges')
        .select(
          'id, charge_no, amount_minor, paid_minor, contribution_types(name), plots(plot_no)'
        )
        .eq('member_id', memberId)
        .in('status', ['open', 'partially_paid'])
        .order('issued_on', { ascending: true })
      if (error) throw error
      return (data as unknown as OpenChargeOption[]) ?? []
    },
    enabled: Boolean(memberId),
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PaymentWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase.from('payments').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY })
      void queryClient.invalidateQueries({ queryKey: ['charges'] })
    },
  })
}

export function useUpdatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & PaymentWriteInput) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase.from('payments').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY })
      void queryClient.invalidateQueries({ queryKey: ['charges'] })
    },
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase.from('payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY })
      void queryClient.invalidateQueries({ queryKey: ['charges'] })
    },
  })
}