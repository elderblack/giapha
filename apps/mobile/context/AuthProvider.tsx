import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { AuthContext } from './authContext'
import { bootstrapSupabase, getSupabase, hasSupabaseCredentials } from '@/lib/supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [bootstrapping, setBootstrapping] = useState(() => hasSupabaseCredentials())
  const [session, setSession] = useState<Session | null>(null)
  /** Chờ getSession sau khi có client — false ngay khi không có credentials */
  const [sessionLoading, setSessionLoading] = useState(() => hasSupabaseCredentials())

  useEffect(() => {
    if (!hasSupabaseCredentials()) {
      setBootstrapping(false)
      setSessionLoading(false)
      return
    }
    void bootstrapSupabase().finally(() => setBootstrapping(false))
  }, [])

  useEffect(() => {
    if (!hasSupabaseCredentials()) return
    if (bootstrapping) return

    const sb = getSupabase()
    if (!sb) {
      setSessionLoading(false)
      return
    }

    let cancelled = false

    sb.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!cancelled) setSession(s ?? null)
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false)
      })

    const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [bootstrapping])

  const loading = hasSupabaseCredentials() && (bootstrapping || sessionLoading)

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: async () => {
        await getSupabase()?.auth.signOut()
        setSession(null)
      },
    }),
    [session, loading],
  )

  if (!hasSupabaseCredentials()) {
    return (
      <AuthContext.Provider
        value={{
          session: null,
          user: null,
          loading: false,
          signOut: async () => {},
        }}
      >
        {children}
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
