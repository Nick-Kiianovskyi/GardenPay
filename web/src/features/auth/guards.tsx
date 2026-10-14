import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageSpinner } from '@/components/shared/page-spinner'
import { useAuth } from '@/features/auth/auth-context'
import type { RoleCode } from '@/types/role'

function ConfigNotice() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Alert className="max-w-md">
        <AlertTitle>Supabase не налаштовано</AlertTitle>
        <AlertDescription>
          Укажіть VITE_SUPABASE_URL та VITE_SUPABASE_ANON_KEY у web/.env для авторизації.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { session, isLoading, isConfigured } = useAuth()
  const location = useLocation()

  if (isLoading) return <PageSpinner />
  if (!isConfigured) return <ConfigNotice />
  if (!session) return <Navigate to={`/login?next=${location.pathname}`} replace />
  return children ?? <Outlet />
}

export function RequireRole({ allow, children }: { allow: RoleCode[]; children?: ReactNode }) {
  const { session, roles, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <PageSpinner />
  if (!session) return <Navigate to={`/login?next=${location.pathname}`} replace />
  if (!roles.some((r) => allow.includes(r))) return <Navigate to="/403" replace />
  return children ?? <Outlet />
}

export function Can({ allow, children }: { allow: RoleCode[]; children: ReactNode }) {
  const { roles } = useAuth()
  if (!roles.some((r) => allow.includes(r))) return null
  return <>{children}</>
}