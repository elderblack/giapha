import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { getSupabase } from '../lib/supabase'

/**
 * Ai có trong `platform_admins` (Supabase) mới được `true`.
 * RPC `is_platform_admin` — không expose danh sách admin cho client.
 */
export function usePlatformAdmin() {
  const { user, loading: authLoading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!user?.id) {
      setChecking(false)
      setIsAdmin(false)
      return
    }

    const sb = getSupabase()
    if (!sb) {
      setChecking(false)
      setIsAdmin(false)
      return
    }

    let cancelled = false
    setChecking(true)

    void Promise.resolve(sb.rpc('is_platform_admin'))
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setIsAdmin(false)
          return
        }
        setIsAdmin(Boolean(data))
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false)
      })
      .then(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, user?.id])

  return { loading: authLoading || checking, isAdmin }
}
