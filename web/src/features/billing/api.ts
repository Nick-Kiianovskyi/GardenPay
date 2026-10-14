import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ChargeRow } from '@/features/charges/types'
import type { Member } from '@/features/members/types'
import type { PaymentRow } from '@/features/payments/types'
import type { MyPlotAssignment } from '@/features/billing/types'

const MY_MEMBER_KEY = ['my-member'] as const
const MY_CHARGES_KEY = ['my-charges'] as const
const MY_PAYMENTS_KEY = ['my-payments'] as const
const MY_PLOTS_KEY = ['my-plots'] as const

export function useMyMember(userId: string) {
  return useQuery({
    queryKey: [...MY_MEMBER_KEY, userId],
    queryFn: async (): Promise<Member | null> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return (data as Member) ?? null
    },
    enabled: Boolean(userId),
  })
}

export function useMyCharges(memberId: string) {
  return useQuery({
    queryKey: [...MY_CHARGES_KEY, memberId],
    queryFn: async (): Promise<ChargeRow[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('charges')
        .select(
          `id, charge_no, member_id, plot_id, contribution_type_id, tariff_id,
           water_meter_reading_id, electricity_meter_reading_id, period_from, period_to,
           quantity, unit, unit_price_minor, amount_minor, currency, status, issued_on, due_on,
           paid_minor, note, created_at, updated_at,
           members(member_no, first_name, last_name),
           plots(plot_no),
           contribution_types(name),
           tariffs(name, unit, valid_from, valid_to, amount_minor)`
        )
        .eq('member_id', memberId)
        .order('issued_on', { ascending: false })
      if (error) throw error
      return (data as unknown as ChargeRow[]) ?? []
    },
    enabled: Boolean(memberId),
  })
}

export function useMyPayments(memberId: string) {
  return useQuery({
    queryKey: [...MY_PAYMENTS_KEY, memberId],
    queryFn: async (): Promise<PaymentRow[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('payments')
        .select(
          `id, member_id, charge_id, amount_minor, kind, method, status, paid_on, reference,
           received_by, note, created_at, updated_at,
           members(member_no, first_name, last_name),
           charges(charge_no, plots(plot_no), contribution_types(name))`
        )
        .eq('member_id', memberId)
        .order('paid_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as PaymentRow[]) ?? []
    },
    enabled: Boolean(memberId),
  })
}

export function useMyPlots(memberId: string) {
  return useQuery({
    queryKey: [...MY_PLOTS_KEY, memberId],
    queryFn: async (): Promise<MyPlotAssignment[]> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('plot_assignments')
        .select('id, relation, start_on, end_on, plots(plot_no, area_m2, zone, status)')
        .eq('member_id', memberId)
        .order('start_on', { ascending: false })
      if (error) throw error
      return (data as unknown as MyPlotAssignment[]) ?? []
    },
    enabled: Boolean(memberId),
  })
}