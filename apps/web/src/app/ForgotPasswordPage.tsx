import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { APP_LOGO_URL } from '../lib/appHeaderBrandEvents'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { role } from '../design/roles'

function recoverRedirectUrl() {
  const base =
    import.meta.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? `${window.location.origin}`
  const callback = `${base}/app/auth/callback`
  return `${callback}?next=${encodeURIComponent('/app/reset-password')}`
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const redirectTo = useMemo(() => recoverRedirectUrl(), [])

  if (!isSupabaseConfigured() || !getSupabase()) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6">
        <p className="text-center text-sm text-abnb-muted">
          Đăng nhập tạm thời chưa khả dụng. Vui lòng thử lại sau.
        </p>
        <Link to="/app/login" className={`${role.btnPrimary} mt-6 !rounded-full`}>
          Về đăng nhập
        </Link>
      </div>
    )
  }

  const sb = getSupabase()!

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!email.trim()) {
      setMsg({ kind: 'err', text: 'Nhập email.' })
      return
    }
    setBusy(true)
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setBusy(false)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    setMsg({
      kind: 'ok',
      text: 'Nếu email có tài khoản, bạn sẽ nhận link đặt lại mật khẩu. Kiểm tra hộp thư và thư mục spam.',
    })
  }

  return (
    <div className="relative min-h-svh bg-abnb-canvas">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-80" aria-hidden />
      <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-abnb-ink no-underline opacity-80 hover:opacity-100"
        >
          <img src={APP_LOGO_URL} alt="" className="h-5 w-5 rounded-abnb-md object-cover" />
          <span className="text-sm font-semibold">Về landing</span>
        </Link>
        <div className={`${role.card} w-full max-w-md rounded-abnb-xl !p-8 shadow-abnb-lg`}>
          <h1 className={role.headingSection}>Quên mật khẩu</h1>
          <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
            Nhập email đã đăng ký. Chúng tôi gửi link để đặt mật khẩu mới.
          </p>
          <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
            <div>
              <label htmlFor="forgot-email" className={`${role.caption} text-abnb-body`}>
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${role.input} mt-2`}
                placeholder="ban@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className={`${role.btnPrimary} w-full justify-center !rounded-full disabled:opacity-60`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gửi link đặt lại mật khẩu'}
            </button>
          </form>
          <p className={`${role.bodySm} mt-6 text-center`}>
            <Link
              to="/app/login"
              className="font-semibold text-abnb-primary no-underline hover:underline"
            >
              ← Quay lại đăng nhập
            </Link>
          </p>
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
