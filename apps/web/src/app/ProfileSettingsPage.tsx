import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/useAuth'
import { role } from '../design/roles'
import { getSupabase } from '../lib/supabase'

const schema = z.object({
  full_name: z.string().min(1, 'Bắt buộc').max(120),
  username: z.string().max(64).optional().or(z.literal('')),
  bio: z.string().max(2000).optional().or(z.literal('')),
  hometown: z.string().max(120).optional().or(z.literal('')),
  current_city: z.string().max(120).optional().or(z.literal('')),
  occupation: z.string().max(120).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

function profileAllowsPasswordChange(identities: { provider: string }[] | undefined): boolean {
  if (!identities?.length) return false
  return identities.some((i) => i.provider === 'email' || i.provider === 'phone')
}

type ProfileRow = {
  id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  hometown: string | null
  current_city: string | null
  occupation: string | null
  phone: string | null
}

export function ProfileSettingsPage() {
  const { user } = useAuth()
  const sb = getSupabase()
  const [loading, setLoading] = useState(true)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      username: '',
      bio: '',
      hometown: '',
      current_city: '',
      occupation: '',
      phone: '',
    },
  })

  useEffect(() => {
    if (!user?.id) return
    let mounted = true
    void (async () => {
      const client = getSupabase()
      if (!client) {
        if (mounted) setLoading(false)
        return
      }
      const { data, error } = await client.from('profiles').select('*').eq('id', user.id).single()
      if (!mounted) return
      if (error || !data) {
        setLoading(false)
        return
      }
      const p = data as ProfileRow
      reset({
        full_name: p.full_name,
        username: p.username ?? '',
        bio: p.bio ?? '',
        hometown: p.hometown ?? '',
        current_city: p.current_city ?? '',
        occupation: p.occupation ?? '',
        phone: p.phone ?? '',
      })
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [user?.id, reset])

  const onSave = handleSubmit(async (values) => {
    if (!user?.id || !sb) return
    setSaveMsg(null)
    const username = values.username?.trim() === '' ? null : values.username?.trim().toLowerCase()
    const { error } = await sb
      .from('profiles')
      .update({
        full_name: values.full_name.trim(),
        username,
        bio: values.bio?.trim() || null,
        hometown: values.hometown?.trim() || null,
        current_city: values.current_city?.trim() || null,
        occupation: values.occupation?.trim() || null,
        phone: values.phone?.trim() || null,
      })
      .eq('id', user.id)
    if (error) {
      setSaveMsg(error.message.includes('unique') ? 'Username đã được dùng.' : error.message)
      return
    }
    setSaveMsg('Đã lưu thông tin.')
  })

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
    let verifyErr: { message: string } | null = null
    if (user.email) {
      const { error } = await sb.auth.signInWithPassword({
        email: user.email,
        password: pwdCurrent,
      })
      verifyErr = error
    } else if (user.phone) {
      const { error } = await sb.auth.signInWithPassword({
        phone: user.phone,
        password: pwdCurrent,
      })
      verifyErr = error
    } else {
      setPwdBusy(false)
      setPwdMsg({ kind: 'err', text: 'Không có email hoặc số điện thoại trên tài khoản để xác nhận.' })
      return
    }

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

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
      </div>
    )
  }

  if (!user?.id) {
    return <p className={`${role.bodySm} text-abnb-muted`}>Cần đăng nhập để chỉnh cài đặt.</p>
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
          <h1 className={`${role.headingModule} mt-4 text-[1.35rem]`}>Cài đặt tài khoản</h1>
          <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
            Chỉnh thông tin công khai trên trang của bạn và bảo mật đăng nhập.
          </p>
        </div>

        <div className={`${role.cardQuiet} rounded-abnb-xl border border-abnb-hairlineSoft/90 p-6 shadow-abnb sm:p-8`}>
          <h2 className={`${role.headingSection} text-[1.05rem]`}>Thông tin hồ sơ</h2>
          <form onSubmit={(e) => void onSave(e)} className="mt-8 max-w-xl space-y-6">
            <div>
              <label className={`${role.caption} text-abnb-body`} htmlFor="settings-full_name">
                Họ tên *
              </label>
              <input id="settings-full_name" {...register('full_name')} className={`${role.input} mt-2`} />
              {errors.full_name ? <p className="mt-1 text-sm text-abnb-error">{errors.full_name.message}</p> : null}
            </div>
            <div>
              <label className={`${role.caption} text-abnb-body`} htmlFor="settings-username">
                Username (tuỳ chọn)
              </label>
              <input
                id="settings-username"
                {...register('username')}
                className={`${role.input} mt-2`}
                autoComplete="username"
              />
              {errors.username ? <p className="mt-1 text-sm text-abnb-error">{errors.username.message}</p> : null}
            </div>
            <div>
              <label className={`${role.caption} text-abnb-body`} htmlFor="settings-bio">
                Tiểu sử ngắn
              </label>
              <textarea
                id="settings-bio"
                rows={4}
                {...register('bio')}
                className={`${role.input} mt-2 min-h-[6rem] resize-y py-3`}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={`${role.caption} text-abnb-body`} htmlFor="settings-hometown">
                  Quê quán
                </label>
                <input id="settings-hometown" {...register('hometown')} className={`${role.input} mt-2`} />
              </div>
              <div>
                <label className={`${role.caption} text-abnb-body`} htmlFor="settings-city">
                  Đang sống tại
                </label>
                <input id="settings-city" {...register('current_city')} className={`${role.input} mt-2`} />
              </div>
            </div>
            <div>
              <label className={`${role.caption} text-abnb-body`} htmlFor="settings-job">
                Nghề nghiệp
              </label>
              <input id="settings-job" {...register('occupation')} className={`${role.input} mt-2`} />
            </div>
            <div>
              <label className={`${role.caption} text-abnb-body`} htmlFor="settings-phone">
                Điện thoại (tuỳ chọn)
              </label>
              <input
                id="settings-phone"
                {...register('phone')}
                inputMode="tel"
                autoComplete="tel"
                className={`${role.input} mt-2`}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`${role.btnPrimary} !rounded-full px-10 disabled:opacity-60`}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu thông tin'}
            </button>
          </form>

          {saveMsg ? (
            <p className={`${role.bodySm} mt-4 text-abnb-muted`} role="status">
              {saveMsg}
            </p>
          ) : null}

          {profileAllowsPasswordChange(user.identities) ? (
            <>
              <div className="my-10 border-t border-abnb-hairlineSoft/90" />
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
              <div className="my-10 border-t border-abnb-hairlineSoft/90" />
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
