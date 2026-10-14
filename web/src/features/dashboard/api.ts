import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DashboardData } from '@/features/dashboard/types'

type SummaryRow = {
  charges_total_minor: number
  charges_count: number
  payments_total_minor: number
  debt_minor: number
  credit_minor: number
  debtors_count: number
}

type MonthlyRow = {
  month: string
  charges_minor: number
  payments_minor: number
}

type MemberDebtRow = { member_name: string; debt_minor: number }
type ServiceDebtRow = { name: string; debt_minor: number }

const headCount = async () => {
  if (!supabase) throw new Error('Supabase is not configured')
  return {
    members: ((await supabase.from('members').select('*', { count: 'exact', head: true })).count ?? 0),
    plots: ((await supabase.from('plots').select('*', { count: 'exact', head: true })).count ?? 0),
    payments: ((await supabase.from('payments').select('*', { count: 'exact', head: true })).count ?? 0),
  }
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardData> => {
      if (!supabase) throw new Error('Supabase is not configured')

      const [counts, summaryRes, monthlyRes, debtorsRes, servicesRes] = await Promise.all([
        headCount(),
        supabase.from('v_financial_summary').select('*').limit(1),
        supabase.from('v_monthly_finance').select('*'),
        supabase.from('v_debt_by_member').select('member_name, debt_minor').order('debt_minor', { ascending: false }).limit(5),
        supabase.from('v_debt_by_service').select('name, debt_minor').order('debt_minor', { ascending: false }).limit(8),
      ])

      for (const res of [summaryRes, monthlyRes, debtorsRes, servicesRes]) {
        if (res.error) throw res.error
      }

      const summary = (summaryRes.data?.[0] as SummaryRow | null) ?? null
      const monthly = (monthlyRes.data ?? []) as MonthlyRow[]
      const lastTwelve = monthly.slice(-12).map((r) => ({
        month: r.month,
        chargesMinor: r.charges_minor,
        paymentsMinor: r.payments_minor,
      }))

      return {
        membersCount: counts.members,
        plotsCount: counts.plots,
        paymentsCount: counts.payments,
        finance: {
          chargesTotalMinor: summary?.charges_total_minor ?? 0,
          chargesCount: summary?.charges_count ?? 0,
          paymentsTotalMinor: summary?.payments_total_minor ?? 0,
          debtMinor: summary?.debt_minor ?? 0,
          creditMinor: summary?.credit_minor ?? 0,
          debtorsCount: summary?.debtors_count ?? 0,
        },
        monthly: lastTwelve,
        topDebtors: ((debtorsRes.data ?? []) as MemberDebtRow[]).map((r) => ({
          memberName: r.member_name,
          debtMinor: r.debt_minor,
        })),
        debtByService: ((servicesRes.data ?? []) as ServiceDebtRow[]).map((r) => ({
          service: r.name,
          debtMinor: r.debt_minor,
        })),
      }
    },
    staleTime: 60_000,
  })
}