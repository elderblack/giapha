import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Loader2, TreePine } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { role } from '../design/roles'

export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [done, setDone] = useState(false)

  if (!isSupabaseConfigured() || !getSupabase()) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6">
        <p className="text-center text-sm text-abnb-muted">
          Dịch vụ tạm thời chưa khả dụng. Vui lòng thử lại sau.
        </p>
        <Link to="/app/login" className={`${role.btnPrimary} mt-6 !rounded-full`}>
          Về đăng nhập
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-abnb-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="relative min-h-svh bg-abnb-canvas">
        <div className="flex min-h-svh flex-col items-center justify-center px-6">
          <div className={`${role.card} w-full max-w-md rounded-abnb-xl !p-8 text-center shadow-abnb-lg`}>
            <TreePine className="mx-auto h-10 w-10 text-abnb-primary" />
            <h1 className={`${role.headingSection} mt-4`}>Liên kết không hợp lệ</h1>
            <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
              Link đặt lại mật khẩu đã hết hạn hoặc đã dùng. Hãy gửi email mới.
            </p>
            <Link to="/app/forgot-password" className={`${role.btnPrimary} mt-6 inline-flex !rounded-full`}>
              Gửi lại email
            </Link>
            <p className={`${role.bodySm} mt-4`}>
              <Link to="/app/login" className="font-semibold text-abnb-primary hover:underline">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return <Navigate to="/app" replace />
  }

  const sb = getSupabase()!

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!password) {
      setMsg({ kind: 'err', text: 'Nhập mật khẩu mới.' })
      return
    }
    if (password.length < 6) {
      setMsg({ kind: 'err', text: 'Mật khẩu cần ít nhất 6 ký tự.' })
      return
    }
    if (password !== passwordConfirm) {
      setMsg({ kind: 'err', text: 'Mật khẩu xác nhận không khớp.' })
      return
    }
    setBusy(true)
    const { error } = await sb.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    setDone(true)
  }

  return (
    <div className="relative min-h-svh bg-abnb-canvas">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-80" aria-hidden />
      <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-abnb-ink no-underline opacity-80 hover:opacity-100"
        >
          <TreePine className="h-5 w-5 text-abnb-primary" />
          <span className="text-sm font-semibold">Về landing</span>
        </Link>
        <div className={`${role.card} w-full max-w-md rounded-abnb-xl !p-8 shadow-abnb-lg`}>
          <h1 className={role.headingSection}>Đặt mật khẩu mới</h1>
          <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
            Nhập mật khẩu mới cho tài khoản của bạn.
          </p>
          <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
            <div>
              <label htmlFor="reset-pass" className={`${role.caption} text-abnb-body`}>
                Mật khẩu mới
              </label>
              <input
                id="reset-pass"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${role.input} mt-2`}
              />
            </div>
            <div>
              <label htmlFor="reset-pass2" className={`${role.caption} text-abnb-body`}>
                Nhập lại mật khẩu
              </label>
              <input
                id="reset-pass2"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={`${role.input} mt-2`}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className={`${role.btnPrimary} w-full justify-center !rounded-full disabled:opacity-60`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu mật khẩu'}
            </button>
          </form>
          {msg ? (
            <p
              className={`mt-6 text-center text-sm ${msg.kind === 'ok' ? 'text-abnb-ink' : 'text-abnb-error'}`}
              role="status"
            >
              {msg.text}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
