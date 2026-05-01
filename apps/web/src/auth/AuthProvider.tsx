import type { Session } from '@supabase/supabase-js'
import { useMemo, useEffect, useState } from 'react'
import { AuthContext } from './authContext'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(() => Boolean(getSupabase()))

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) return

    let cancelled = false

    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      if (cancelled) return
      setSession(s)
      if (event === 'INITIAL_SESSION') setLoading(false)
    })

    void Promise.resolve(sb.auth.getSession())
      .then(({ data: { session: s } }) => {
        if (cancelled) return
        setSession(s ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setSession(null)
      })
      .then(() => {
        if (!cancelled) setLoading(false)
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
