import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { role } from '../design/roles'
import { getSupabase } from '../lib/supabase'
import { profileAllowsPasswordChange } from './profile/profileSettingsUtils'

export function ProfileSettingsSecurityPage() {
  const { user } = useAuth()
  const sb = getSupabase()
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function submitPasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (!sb || !user) return
    setPwdMsg(null)
    if (!profileAllowsPasswordChange(user.identities)) {
      setPwdMsg({ kind: 'err', text: 'Tài khoản đăng nhập Google không đổi mật khẩu tại đây.' })
      return
    }
    if (!pwdCurrent) {
      setPwdMsg({ kind: 'err', text: 'Nhập mật khẩu hiện tại.' })
      return
    }
    if (pwdNew.length < 6) {
      setPwdMsg({ kind: 'err', text: 'Mật khẩu mới cần ít nhất 6 ký tự.' })
      return
    }
    if (pwdNew !== pwdConfirm) {
      setPwdMsg({ kind: 'err', text: 'Mật khẩu mới và xác nhận không khớp.' })
      return
    }

    setPwdBusy(true)
    const credential =
      user.email != null
        ? ({ email: user.email, password: pwdCurrent } as const)
        : user.phone != null
          ? ({ phone: user.phone, password: pwdCurrent } as const)
          : null
    if (credential === null) {
      setPwdBusy(false)
      setPwdMsg({ kind: 'err', text: 'Không có email hoặc số điện thoại trên tài khoản để xác nhận.' })
      return
    }

    const { error: verifyErr } = await sb.auth.signInWithPassword(credential)

    if (verifyErr) {
      setPwdBusy(false)
      setPwdMsg({
        kind: 'err',
        text:
          verifyErr.message.toLowerCase().includes('invalid') ||
          verifyErr.message.toLowerCase().includes('credential')
            ? 'Mật khẩu hiện tại không đúng.'
            : verifyErr.message,
      })
      return
    }

    const { error: updateErr } = await sb.auth.updateUser({ password: pwdNew })
    setPwdBusy(false)
    if (updateErr) {
      setPwdMsg({ kind: 'err', text: updateErr.message })
      return
    }
    setPwdCurrent('')
    setPwdNew('')
    setPwdConfirm('')
    setPwdMsg({ kind: 'ok', text: 'Đã đổi mật khẩu. Lần sau đăng nhập bằng mật khẩu mới.' })
  }

  if (!sb) {
    return <p className={`${role.bodySm} text-abnb-error`}>Không kết nối được.</p>
  }

  if (!user?.id) {
    return <p className={`${role.bodySm} text-abnb-muted`}>Cần đăng nhập.</p>
  }

  return (
    <div className="min-h-[100vh] bg-[#f0f2f5] pb-16 pt-4 dark:bg-abnb-canvas">
      <div className="mx-auto max-w-[720px] px-4 sm:px-6">
        <div className="mb-6">
          <Link
            to="/app/profile"
            className={`${role.link} inline-flex items-center gap-2 text-[14px] font-semibold no-underline`}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
            Về hồ sơ
          </Link>
          <h1 className={`${role.headingModule} mt-4 text-[1.35rem]`}>Bảo mật đăng nhập</h1>
          <p className={`${role.bodySm} mt-2 text-abnb-muted`}>Đổi mật khẩu khi bạn đăng nhập bằng email hoặc số điện thoại.</p>
        </div>

        <div className={`${role.cardQuiet} rounded-abnb-xl border border-abnb-hairlineSoft/90 p-6 shadow-abnb sm:p-8`}>
          {profileAllowsPasswordChange(user.identities) ? (
            <>
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 shrink-0 text-abnb-muted" aria-hidden />
                <h2 className={`${role.headingSection} text-[1.05rem]`}>Đổi mật khẩu</h2>
              </div>
              <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
                Xác nhận mật khẩu hiện tại rồi nhập mật khẩu mới. Áp dụng cho đăng nhập bằng{' '}
                {user.email ? 'email' : ''}
                {user.email && user.phone ? ' hoặc ' : ''}
                {user.phone ? 'số điện thoại' : ''}.
              </p>
              <form onSubmit={(e) => void submitPasswordChange(e)} className="mt-6 max-w-xl space-y-5">
                <div>
                  <label className={`${role.caption} text-abnb-body`} htmlFor="pwd-current">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    id="pwd-current"
                    type="password"
                    autoComplete="current-password"
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    className={`${role.input} mt-2`}
                  />
                </div>
                <div>
                  <label className={`${role.caption} text-abnb-body`} htmlFor="pwd-new">
                    Mật khẩu mới
                  </label>
                  <input
                    id="pwd-new"
                    type="password"
                    autoComplete="new-password"
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    className={`${role.input} mt-2`}
                  />
                </div>
                <div>
                  <label className={`${role.caption} text-abnb-body`} htmlFor="pwd-confirm">
                    Nhập lại mật khẩu mới
                  </label>
                  <input
                    id="pwd-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    className={`${role.input} mt-2`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={pwdBusy}
                  className={`${role.btnSecondary} !rounded-full px-8 disabled:opacity-60`}
                >
                  {pwdBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cập nhật mật khẩu'}
                </button>
              </form>
              {pwdMsg ? (
                <p
                  className={`mt-4 text-sm ${pwdMsg.kind === 'ok' ? 'text-abnb-ink' : 'text-abnb-error'}`}
                  role="status"
                >
                  {pwdMsg.text}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h2 className={`${role.headingSection} text-[1.05rem]`}>Mật khẩu</h2>
              <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
                Bạn đăng nhập bằng Google — không đổi mật khẩu tại đây.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
