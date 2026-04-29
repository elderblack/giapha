import { Loader2, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { role } from '../../design/roles'
import { getSupabase } from '../../lib/supabase'
import { normalizeVnPhoneToE164 } from '../../lib/phoneE164'
import { provisionMemberPhoneErrorVi } from './treeTypes'

/** Khớp Edge Function `provision-member-phone-account` / secret MEMBER_DEFAULT_ACCOUNT_PASSWORD */
export const MEMBER_DEFAULT_LOGIN_PASSWORD_COPY = '123456'

type Props = {
  memberId: string
  memberName: string
  memberPhone: string | null | undefined
  supportsMemberPhoneColumn: boolean
  disabled?: boolean
  onDone: () => void
}

/** Thay cho lời mời email: nhập SĐT → lưu node → cấp tài khoản (mật khẩu mặc định). */
export function MemberPhoneAccountCard({
  memberId,
  memberName,
  memberPhone,
  supportsMemberPhoneColumn,
  disabled,
  onDone,
}: Props) {
  const sb = getSupabase()
  const [phoneInput, setPhoneInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okHint, setOkHint] = useState<string | null>(null)

  useEffect(() => {
    setPhoneInput((memberPhone ?? '').trim())
    setErr(null)
    setOkHint(null)
  }, [memberId, memberPhone])

  async function createAccount() {
    if (!sb) return
    setErr(null)
    setOkHint(null)
    const raw = phoneInput.trim()
    if (!raw) {
      setErr('Nhập số điện thoại.')
      return
    }
    if (!normalizeVnPhoneToE164(raw)) {
      setErr('Số không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678.')
      return
    }
    if (!supportsMemberPhoneColumn) {
      setErr(
        'Chưa lưu được SĐT vào hệ thống — chạy migration (supabase db push), tải lại trang và thử lại.',
      )
      return
    }

    setBusy(true)
    const stored = memberPhone?.trim() ?? ''
    if (raw !== stored) {
      const { error: upErr } = await sb
        .from('family_tree_members')
        .update({ phone: raw })
        .eq('id', memberId)
      if (upErr) {
        setBusy(false)
        setErr(upErr.message)
        return
      }
    }

    const { data, error } = await sb.functions.invoke('provision-member-phone-account', {
      body: { member_id: memberId },
    })
    setBusy(false)

    const body = data as {
      ok?: boolean
      skipped?: boolean
      reason?: string
      error?: string
      linked_existing?: boolean
      default_password_hint?: boolean
    } | null

    if (body?.ok && body.skipped) {
      setErr('Không đọc được SĐT sau khi lưu — tải lại trang và thử lại.')
      return
    }

    if (body?.ok) {
      const parts = [
        body.linked_existing
          ? 'Đã gắn tài khoản hiện có với số này.'
          : 'Đã tạo tài khoản và liên kết.',
      ]
      if (body.default_password_hint !== false) {
        parts.push(
          `Đăng nhập tab Điện thoại → «Số + mật khẩu» → mật khẩu ${MEMBER_DEFAULT_LOGIN_PASSWORD_COPY}.`,
        )
      }
      setOkHint(parts.join(' '))
      onDone()
      return
    }

    if (body?.error) {
      setErr(provisionMemberPhoneErrorVi(body.error))
      return
    }

    setErr(error?.message ?? 'Không gọi được máy chủ.')
  }

  return (
    <div
      className={`mt-3 rounded-abnb-lg border border-dashed border-abnb-hairlineSoft bg-abnb-surfaceSoft/30 px-4 py-3`}
    >
      <p className={`${role.caption} font-medium text-abnb-ink`}>Tạo tài khoản (số điện thoại)</p>
      <p className={`${role.caption} mt-1 text-abnb-muted`}>
        Mật khẩu mặc định lần đầu: <strong>{MEMBER_DEFAULT_LOGIN_PASSWORD_COPY}</strong> · {memberName}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="0912345678"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          disabled={disabled || busy}
          className={`${role.input} !h-11 min-w-0 flex-1`}
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void createAccount()}
          className={`inline-flex !h-11 shrink-0 items-center justify-center gap-2 ${role.btnPrimary} !rounded-full !px-5 !text-[13px]`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Smartphone className="h-4 w-4" />
              Tạo tài khoản
            </>
          )}
        </button>
      </div>
      {!supportsMemberPhoneColumn ? (
        <p className={`${role.caption} mt-2 text-amber-800/90`}>
          Để lưu SĐT và cấp tài khoản, chạy{' '}
          <code className="rounded bg-abnb-canvas px-1 py-px text-[12px]">supabase db push</code> rồi tải lại trang.
        </p>
      ) : null}
      {err ? (
        <p className="mt-2 text-[13px] text-abnb-error" role="alert">
          {err}
        </p>
      ) : null}
      {okHint ? (
        <p className="mt-2 text-[13px] font-medium text-abnb-primary" role="status">
          {okHint}
        </p>
      ) : null}
    </div>
  )
}
