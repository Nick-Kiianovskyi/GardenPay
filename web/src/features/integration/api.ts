import { useQuery } from '@tanstack/react-query'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export type IntegrationTable = 'members' | 'plots' | 'tariffs'

export type IntegrationStat = {
  table: IntegrationTable
  count: number | null
  error: string | null
}

export type IntegrationStats = {
  isConfigured: boolean
  urlHost: string | null
  results: IntegrationStat[]
  errors: string[]
}

const STAT_TABLES: IntegrationTable[] = ['members', 'plots', 'tariffs']

const countRows = async (table: IntegrationTable): Promise<IntegrationStat> => {
  if (!supabase) {
    return { table, count: null, error: 'Supabase не налаштовано (немає env-змінних)' }
  }
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return { table, count: count ?? null, error: error?.message ?? null }
}

export function useIntegrationStats() {
  return useQuery({
    queryKey: ['integration-stats'],
    queryFn: async (): Promise<IntegrationStats> => {
      const results = await Promise.all(STAT_TABLES.map(countRows))
      return {
        isConfigured: isSupabaseConfigured,
        urlHost: import.meta.env.VITE_SUPABASE_URL || null,
        results,
        errors: results.flatMap((r) => (r.error ? [r.error] : [])),
      }
    },
    staleTime: 30_000,
  })
}