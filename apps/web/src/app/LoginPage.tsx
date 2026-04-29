import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Loader2, TreePine } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { normalizeVnPhoneToE164 } from '../lib/phoneE164'
import { role } from '../design/roles'

/** Callback Supabase Auth; `next` được AuthCallback đọc sau magic link / xác nhận email / OAuth. */
function authCallbackRedirectUrl(postAuthPath: string) {
  const base =
    import.meta.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? `${window.location.origin}`
  const callback = `${base}/app/auth/callback`
  const safe =
    postAuthPath.startsWith('/app') && !postAuthPath.startsWith('//')
      ? postAuthPath
      : '/app/home'
  return `${callback}?next=${encodeURIComponent(safe)}`
}

function formatOAuthClientError(message: string): string {
  const m = message.toLowerCase()
  if (
    m.includes('not enabled') ||
    m.includes('unsupported provider') ||
    m.includes('validation_failed')
  ) {
    return 'Đăng nhập Google hiện không khả dụng.'
  }
  return message
}

type AuthTab = 'email' | 'phone'
/** Tab email: mật khẩu, đăng ký, hoặc magic link */
type EmailAuthMode = 'password' | 'register' | 'magic'

export function LoginPage() {
  const { session, loading } = useAuth()
  const loc = useLocation() as { state?: { from?: string } }
  const from = loc.state?.from ?? '/app/home'
  const [tab, setTab] = useState<AuthTab>('email')
  const [emailMode, setEmailMode] = useState<EmailAuthMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [phonePwd, setPhonePwd] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const redirectTo = useMemo(
    () => authCallbackRedirectUrl(from),
    [from],
  )

  if (!isSupabaseConfigured() || !getSupabase()) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6">
        <p className="text-center text-sm text-abnb-muted">
          Đăng nhập tạm thời chưa khả dụng. Vui lòng thử lại sau.
        </p>
        <Link to="/" className={`${role.btnPrimary} mt-6 !rounded-full`}>
          Về trang chủ
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
      </div>
    )
  }

  if (session) {
    return <Navigate to={from.startsWith('/app') ? from : '/app/home'} replace />
  }

  const sb = getSupabase()!

  function switchTab(next: AuthTab) {
    setTab(next)
    setMsg(null)
    setPhonePwd('')
    setPassword('')
    setPasswordConfirm('')
    if (next === 'phone') setEmailMode('password')
  }

  function setEmailAuthMode(mode: EmailAuthMode) {
    setEmailMode(mode)
    setMsg(null)
  }

  async function submitPasswordSignIn(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!email.trim() || !password) {
      setMsg({ kind: 'err', text: 'Nhập email và mật khẩu.' })
      return
    }
    setBusy(true)
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    setMsg({ kind: 'ok', text: 'Đăng nhập thành công.' })
  }

  async function submitPasswordSignUp(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!email.trim() || !password) {
      setMsg({ kind: 'err', text: 'Nhập email và mật khẩu.' })
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
    const name = registerName.trim() || 'Thành viên mới'
    setBusy(true)
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { full_name: name, name },
      },
    })
    setBusy(false)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    if (data.session) {
      setMsg({ kind: 'ok', text: 'Đã tạo tài khoản.' })
    } else {
      setMsg({
        kind: 'ok',
        text: 'Đã gửi email xác nhận. Mở link trong thư để kích hoạt tài khoản.',
      })
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!email.trim()) {
      setMsg({ kind: 'err', text: 'Nhập email.' })
      return
    }
    setBusy(true)
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo,
      },
    })
    setBusy(false)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    setMsg({
      kind: 'ok',
      text: 'Đã gửi link đăng nhập. Kiểm tra hộp thư (và thư mục spam).',
    })
  }

  async function submitPhonePasswordSignIn(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const e164 = normalizeVnPhoneToE164(phoneInput)
    if (!e164) {
      setMsg({
        kind: 'err',
        text: 'Số không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678',
      })
      return
    }
    if (!phonePwd.trim()) {
      setMsg({ kind: 'err', text: 'Nhập mật khẩu.' })
      return
    }
    setBusy(true)
    const { error } = await sb.auth.signInWithPassword({
      phone: e164,
      password: phonePwd,
    })
    setBusy(false)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    setMsg({ kind: 'ok', text: 'Đăng nhập thành công.' })
  }

  async function signInGoogle() {
    setMsg(null)
    setBusy(true)
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    setBusy(false)
    if (error) setMsg({ kind: 'err', text: formatOAuthClientError(error.message) })
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
        <div
          className={`${role.card} w-full max-w-md rounded-abnb-xl !p-8 shadow-abnb-lg`}
        >
          <h1 className={role.headingSection}>Đăng nhập</h1>
          <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
            Đăng nhập bằng email và mật khẩu, số điện thoại + mật khẩu hoặc Google. Tạo tài khoản tại đây rồi dùng
            mã mời ở mục Dòng họ nếu được mời.
          </p>

          <div className="mt-6 flex rounded-full bg-abnb-surfaceSoft p-1">
            <button
              type="button"
              onClick={() => switchTab('email')}
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
                tab === 'email'
                  ? 'bg-abnb-canvas text-abnb-ink shadow-sm'
                  : 'text-abnb-muted hover:text-abnb-ink'
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => switchTab('phone')}
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
                tab === 'phone'
                  ? 'bg-abnb-canvas text-abnb-ink shadow-sm'
                  : 'text-abnb-muted hover:text-abnb-ink'
              }`}
            >
              Điện thoại
            </button>
          </div>

          {tab === 'email' ? (
            <div className="mt-6 space-y-4">
              <div className="flex gap-1 rounded-full bg-abnb-surfaceSoft p-0.5">
                {(
                  [
                    ['password', 'Đăng nhập'],
                    ['register', 'Đăng ký'],
                    ['magic', 'Link email'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setEmailAuthMode(mode)}
                    className={`min-w-0 flex-1 rounded-full px-1 py-2 text-center text-[11px] font-semibold leading-tight transition-colors sm:px-2 sm:text-xs ${
                      emailMode === mode
                        ? 'bg-abnb-canvas text-abnb-ink shadow-sm'
                        : 'text-abnb-muted hover:text-abnb-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {emailMode === 'password' ? (
                <form onSubmit={(e) => void submitPasswordSignIn(e)} className="space-y-4">
                  <div>
                    <label htmlFor="auth-email" className={`${role.caption} text-abnb-body`}>
                      Email
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${role.input} mt-2`}
                      placeholder="ban@email.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-password" className={`${role.caption} text-abnb-body`}>
                      Mật khẩu
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${role.input} mt-2`}
                    />
                    <p className={`${role.bodySm} mt-2 text-right`}>
                      <Link
                        to="/app/forgot-password"
                        className="font-semibold text-abnb-primary no-underline hover:underline"
                      >
                        Quên mật khẩu?
                      </Link>
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className={`${role.btnPrimary} w-full justify-center !rounded-full disabled:opacity-60`}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Đăng nhập'}
                  </button>
                </form>
              ) : emailMode === 'register' ? (
                <form onSubmit={(e) => void submitPasswordSignUp(e)} className="space-y-4">
                  <div>
                    <label htmlFor="reg-name" className={`${role.caption} text-abnb-body`}>
                      Tên hiển thị
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      autoComplete="name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className={`${role.input} mt-2`}
                      placeholder="Có thể bỏ trống"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-email" className={`${role.caption} text-abnb-body`}>
                      Email
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${role.input} mt-2`}
                      placeholder="ban@email.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-password" className={`${role.caption} text-abnb-body`}>
                      Mật khẩu
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${role.input} mt-2`}
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-password2" className={`${role.caption} text-abnb-body`}>
                      Nhập lại mật khẩu
                    </label>
                    <input
                      id="reg-password2"
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
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tạo tài khoản'}
                  </button>
                </form>
              ) : (
                <form onSubmit={(e) => void sendMagicLink(e)} className="space-y-4">
                  <div>
                    <label htmlFor="auth-email-magic" className={`${role.caption} text-abnb-body`}>
                      Email
                    </label>
                    <input
                      id="auth-email-magic"
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
                    className={`${role.btnSecondary} w-full justify-center !rounded-full disabled:opacity-60`}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Gửi link đăng nhập'
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={(e) => void submitPhonePasswordSignIn(e)} className="mt-8 space-y-4">
              <p className={`${role.bodySm} text-abnb-muted`}>
                Nhập số điện thoại đã đăng ký và mật khẩu. Đặt mật khẩu mới trong Hồ sơ sau khi đăng nhập.
              </p>
              <div>
                <label htmlFor="auth-phone-pwd" className={`${role.caption} text-abnb-body`}>
                  Số di động (Việt Nam)
                </label>
                <input
                  id="auth-phone-pwd"
                  type="tel"
                  autoComplete="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className={`${role.input} mt-2`}
                  placeholder="0912345678"
                />
              </div>
              <div>
                <label htmlFor="auth-phone-password-field" className={`${role.caption} text-abnb-body`}>
                  Mật khẩu
                </label>
                <input
                  id="auth-phone-password-field"
                  type="password"
                  autoComplete="current-password"
                  value={phonePwd}
                  onChange={(e) => setPhonePwd(e.target.value)}
                  className={`${role.input} mt-2`}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className={`${role.btnPrimary} w-full justify-center !rounded-full disabled:opacity-60`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Đăng nhập'}
              </button>
            </form>
          )}

          <div className="relative my-8">
            <span className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-abnb-hairlineSoft" />
            </span>
            <span className="relative flex justify-center">
              <span className="bg-abnb-canvas px-3 text-xs font-medium uppercase tracking-wider text-abnb-muted">
                hoặc
              </span>
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void signInGoogle()}
            className={`${role.btnSecondary} w-full justify-center !rounded-full disabled:opacity-60`}
          >
            Tiếp tục với Google
          </button>
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
