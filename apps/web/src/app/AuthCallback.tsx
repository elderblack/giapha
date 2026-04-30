import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export function AuthCallback() {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/app'

  useEffect(() => {
    const run = async () => {
      const sb = getSupabase()
      if (!sb || !isSupabaseConfigured()) {
        setFailed(true)
        setReady(true)
        return
      }
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code)
        if (error) {
          setFailed(true)
          setReady(true)
          return
        }
      } else {
        const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
        const hp = new URLSearchParams(hash)
        const accessToken = hp.get('access_token')
        const refreshToken = hp.get('refresh_token')
        const type = hp.get('type')
        if (accessToken && refreshToken && type === 'recovery') {
          const { error } = await sb.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            setFailed(true)
            setReady(true)
            return
          }
          window.history.replaceState(null, '', `${url.pathname}${url.search}`)
        } else {
          await sb.auth.getSession()
        }
      }
      setReady(true)
    }
    void run()
  }, [])

  if (!isSupabaseConfigured()) {
    return <Navigate to="/app/login" replace />
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-abnb-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
        <p className="text-sm text-abnb-muted">Đang hoàn tất đăng nhập…</p>
      </div>
    )
  }

  if (failed) {
    return <Navigate to="/app/login" replace />
  }

  return <Navigate to={next.startsWith('/app') ? next : '/app'} replace />
}
