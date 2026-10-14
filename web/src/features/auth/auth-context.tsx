import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { RoleCode } from '@/types/role'

type AuthContextValue = {
  session: Session | null
  user: User | null
  roles: RoleCode[]
  isLoading: boolean
  isConfigured: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const loadRoles = async (): Promise<RoleCode[]> => {
  if (!supabase) return []
  const { data, error } = await supabase.from('user_roles').select('role_code')
  if (error) return []
  const roles = data.map((row: { role_code: string }) => row.role_code as RoleCode)
  return roles.length > 0 ? roles : ['member']
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [roles, setRoles] = useState<RoleCode[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) setRoles(await loadRoles())
      setIsLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next)
      setRoles(next ? await loadRoles() : [])
      setIsLoading(false)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      roles,
      isLoading,
      isConfigured: isSupabaseConfigured,
      signOut,
    }),
    [session, roles, isLoading, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}