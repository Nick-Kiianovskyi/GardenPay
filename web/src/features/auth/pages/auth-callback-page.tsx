import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { PageSpinner } from '@/components/shared/page-spinner'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  useEffect(() => {
    void supabase?.auth.getSession()
  }, [])

  if (!isSupabaseConfigured) return <Navigate to="/login" replace />
  return <PageSpinner label="Завершення входу…" />
}