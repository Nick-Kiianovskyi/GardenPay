import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  DebtByMemberRow,
  DebtByPlotRow,
  DebtByServiceRow,
  DebtOverallRow,
} from '@/features/debtors/types'

export type DebtQuery = {
  scope: 'member' | 'plot' | 'service'
  search: string
}

export type DebtResult = {
  data: (DebtByMemberRow | DebtByPlotRow | DebtByServiceRow)[]
  count: number
}

export function useDebtRows(query: DebtQuery) {
  return useQuery({
    queryKey: ['debt', query],
    queryFn: async (): Promise<DebtResult> => {
      if (!supabase) throw new Error('Supabase is not configured')
      let builder

      const from =
        query.scope === 'member'
          ? supabase.from('v_debt_by_member').select('*', { count: 'exact' })
          : query.scope === 'plot'
            ? supabase.from('v_debt_by_plot').select('*', { count: 'exact' })
            : supabase.from('v_debt_by_service').select('*', { count: 'exact' })

      builder = from

      const term = query.search.trim().toLowerCase()
      if (term) {
        if (query.scope === 'member') {
          void builder.or(`member_no.ilike.%${term}%,member_name.ilike.%${term}%`)
        } else if (query.scope === 'plot') {
          void builder.or(`plot_no.ilike.%${term}%,owner_name.ilike.%${term}%`)
        } else {
          void builder.or(`code.ilike.%${term}%,name.ilike.%${term}%`)
        }
      }

      builder.order('debt_minor', { ascending: false }).limit(1000)

      const { data, count, error } = await builder
      if (error) throw error
      return { data: (data ?? []) as (DebtByMemberRow | DebtByPlotRow | DebtByServiceRow)[], count: count ?? 0 }
    },
    placeholderData: keepPreviousData,
  })
}

export function useDebtOverall() {
  return useQuery({
    queryKey: ['debt-overall'],
    queryFn: async (): Promise<DebtOverallRow | null> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase.from('v_debt_overall').select('*').limit(1)
      if (error) throw error
      return ((data?.[0] as DebtOverallRow) ?? null) as DebtOverallRow | null
    },
  })
}

export type DebtorChargeRow = {
  id: string
  charge_no: string
  amount_minor: number
  paid_minor: number
  status: string
  issued_on: string
  due_on: string | null
  plots: { plot_no: string } | null
  contribution_types: { name: string } | null
}

const CHARGE_SELECT = `id, charge_no, amount_minor, paid_minor, status, issued_on, due_on,
  plots(plot_no), contribution_types(name)`

export function useDebtorCharges(
  filter: { memberId?: string; plotId?: string; serviceId?: string } | null
) {
  const { memberId, plotId, serviceId } = filter ?? {}
  return useQuery({
    queryKey: ['debtor-charges', filter],
    queryFn: async (): Promise<DebtorChargeRow[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      let query = supabase.from('charges').select(CHARGE_SELECT)
      if (memberId) query = query.eq('member_id', memberId)
      if (plotId) query = query.eq('plot_id', plotId)
      if (serviceId) query = query.eq('contribution_type_id', serviceId)
      const { data, error } = await query.order('issued_on', { ascending: false })
      if (error) throw error
      return (data as unknown as DebtorChargeRow[]) ?? []
    },
    enabled: Boolean(filter && (memberId || plotId || serviceId)),
    placeholderData: keepPreviousData,
  })
}

export type DebtorPaymentRow = {
  id: string
  amount_minor: number
  kind: string
  status: string
  paid_on: string
  reference: string | null
  charges: { charge_no: string } | null
}

const PAYMENT_SELECT = `id, amount_minor, kind, status, paid_on, reference, charges(charge_no)`

export function useDebtorPayments(
  filter: { memberId?: string; plotId?: string; serviceId?: string } | null
) {
  const { memberId, plotId, serviceId } = filter ?? {}
  return useQuery({
    queryKey: ['debtor-payments', filter],
    queryFn: async (): Promise<DebtorPaymentRow[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      let query = supabase.from('payments').select(PAYMENT_SELECT)
      if (memberId) query = query.eq('member_id', memberId)
      if (plotId) query = query.eq('charges.plot_id', plotId)
      if (serviceId) query = query.eq('charges.contribution_type_id', serviceId)
      const { data, error } = await query.order('paid_on', { ascending: false })
      if (error) throw error
      return (data as unknown as DebtorPaymentRow[]) ?? []
    },
    enabled: Boolean(filter && (memberId || plotId || serviceId)),
    placeholderData: keepPreviousData,
  })
}