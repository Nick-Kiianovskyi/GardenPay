import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  ChargesByStatusRow,
  ConsumptionRow,
  FinancialSummary,
  MonthlyFinanceRow,
  PaymentsByMethodRow,
  ReportChargeRow,
  ReportDebtorRow,
  ReportPaymentRow,
  ReportKind,
} from '@/features/reports/types'

export type ReportFilters = {
  search: string
  kind: ReportKind
  status?: string
  dateFrom?: string
  dateTo?: string
}

export type ReportResult = {
  data: unknown[]
  count: number
}

const cap = 1000

export function useReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ['report', filters],
    queryFn: async (): Promise<ReportResult> => {
      if (!supabase) throw new Error('Supabase is not configured')
      const term = filters.search.trim().toLowerCase()
      const status = filters.status && filters.status !== 'all' ? filters.status : undefined

      switch (filters.kind) {
        case 'debtors': {
          let query = supabase
            .from('v_debt_by_member')
            .select('*', { count: 'exact' })
            .order('debt_minor', { ascending: false })
            .limit(cap)
          if (term) void query.or(`member_no.ilike.%${term}%,member_name.ilike.%${term}%`)
          if (status === 'debtor') query = query.gt('debt_minor', 0)
          const { data, error } = await query
          if (error) throw error
          return { data: data as ReportDebtorRow[], count: (data ?? []).length }
        }
        case 'charges': {
          let query = supabase
            .from('charges')
            .select(
              `charge_no, issued_on, due_on, amount_minor, paid_minor, status,
               members(first_name, last_name), plots(plot_no), contribution_types(name)`,
              { count: 'exact' }
            )
            .order('issued_on', { ascending: false })
            .limit(cap)
          if (term) void query.or(`charge_no.ilike.%${term}%,note.ilike.%${term}%`)
          if (status) query = query.eq('status', status)
          const { data, count, error } = await query
          if (error) throw error
          const rows = ((data ?? []) as unknown as RawChargeReport[]).map((r): ReportChargeRow => ({
            charge_no: r.charge_no,
            member: r.members ? `${r.members.last_name} ${r.members.first_name}` : null,
            plot_no: r.plots?.plot_no ?? null,
            service: r.contribution_types?.name ?? null,
            issued_on: r.issued_on,
            due_on: r.due_on,
            amount_minor: r.amount_minor,
            paid_minor: r.paid_minor,
            status: r.status,
          }))
          return { data: rows, count: count ?? rows.length }
        }
        case 'payments': {
          let query = supabase
            .from('payments')
            .select(
              `paid_on, reference, method, amount_minor, status,
               members(first_name, last_name), charges(charge_no)`,
              { count: 'exact' }
            )
            .order('paid_on', { ascending: false })
            .limit(cap)
          if (term) void query.or(`reference.ilike.%${term}%,charges.charge_no.ilike.%${term}%`)
          if (status) query = query.eq('status', status)
          const { data, count, error } = await query
          if (error) throw error
          const rows = ((data ?? []) as unknown as RawPaymentReport[]).map((r): ReportPaymentRow => ({
            paid_on: r.paid_on,
            reference: r.reference,
            member: r.members ? `${r.members.last_name} ${r.members.first_name}` : null,
            charge_no: r.charges?.charge_no ?? null,
            method: r.method,
            amount_minor: r.amount_minor,
            status: r.status,
          }))
          return { data: rows, count: count ?? rows.length }
        }
        case 'water':
        case 'electricity': {
          const view =
            filters.kind === 'water' ? 'v_water_meter_readings' : 'v_electricity_meter_readings'
          const valueCol = filters.kind === 'water' ? 'reading_m3' : 'reading_kwh'
          const prevCol = filters.kind === 'water' ? 'previous_m3' : 'previous_kwh'
          const consCol = filters.kind === 'water' ? 'consumption_m3' : 'consumption_kwh'
          const searchCol = filters.kind === 'water' ? 'meter_no' : 'meter_no'

          let query = supabase.from(view).select('*', { count: 'exact' })
          if (term) void query.or(`${searchCol}.ilike.%${term}%,plot_no.ilike.%${term}%`)
          if (filters.dateFrom) query = query.gte('read_on', filters.dateFrom)
          if (filters.dateTo) query = query.lte('read_on', filters.dateTo)
          query = query.order('read_on', { ascending: false }).limit(cap)

          const { data, count, error } = await query
          if (error) throw error
          const rows = ((data ?? []) as unknown as RawConsumption[]).map((r): ConsumptionRow => ({
            read_on: r.read_on,
            meter_no: r.meter_no,
            plot_no: r.plot_no,
            reading: r[valueCol as keyof RawConsumption] as number,
            previous: r[prevCol as keyof RawConsumption] as number,
            consumption: r[consCol as keyof RawConsumption] as number,
            note: r.note,
          }))
          return { data: rows, count: count ?? rows.length }
        }
        case 'summary': {
          return { data: [], count: 0 }
        }
      }
    },
    placeholderData: keepPreviousData,
  })
}

type RawChargeReport = {
  charge_no: string
  issued_on: string
  due_on: string | null
  amount_minor: number
  paid_minor: number
  status: string
  members: { first_name: string; last_name: string } | null
  plots: { plot_no: string } | null
  contribution_types: { name: string } | null
}

type RawPaymentReport = {
  paid_on: string
  reference: string | null
  method: string
  amount_minor: number
  status: string
  members: { first_name: string; last_name: string } | null
  charges: { charge_no: string } | null
}

type RawConsumption = {
  read_on: string
  meter_no: string
  plot_no: string
  reading_m3: number
  reading_kwh: number
  previous_m3: number
  previous_kwh: number
  consumption_m3: number
  consumption_kwh: number
  note: string | null
}

export function useFinancialSummary() {
  return useQuery({
    queryKey: ['report-summary'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured')
      const summary = await supabase.from('v_financial_summary').select('*').limit(1)
      if (summary.error) throw summary.error
      const charges = await supabase.from('v_charges_by_status').select('*')
      if (charges.error) throw charges.error
      const methods = await supabase.from('v_payments_by_method').select('*')
      if (methods.error) throw methods.error
      const monthly = await supabase.from('v_monthly_finance').select('*')
      if (monthly.error) throw monthly.error
      return {
        summary: (summary.data?.[0] as FinancialSummary | null) ?? null,
        charges: (charges.data ?? []) as ChargesByStatusRow[],
        methods: (methods.data ?? []) as PaymentsByMethodRow[],
        monthly: (monthly.data ?? []) as MonthlyFinanceRow[],
      }
    },
    placeholderData: keepPreviousData,
  })
}