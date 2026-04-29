import type { Session } from '@supabase/supabase-js'
import { useMemo, useEffect, useState } from 'react'
import { AuthContext } from './authContext'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(() => !!getSupabase())

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) return

    let cancelled = false

    sb.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!cancelled) setSession(s ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

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

  if (!isSupabaseConfigured()) {
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
