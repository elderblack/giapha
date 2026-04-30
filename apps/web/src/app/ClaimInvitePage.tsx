import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getSupabase } from '../lib/supabase'
import { role } from '../design/roles'
import { inviteViaRpcErrorVi } from './tree/treeTypes'

/** Liên kết tài khoản bằng token từ email (sau đăng nhập). Query: ?token= */
export function ClaimInvitePage() {
  const { session, loading: authLoading } = useAuth()
  const sb = getSupabase()
  const [params] = useSearchParams()
  const token = params.get('token')?.trim() ?? ''

  const [done, setDone] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState<string | null>(null)
  const [treeId, setTreeId] = useState<string | null>(null)

  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    if (authLoading || !session?.user?.id || !sb || !token) return
    ran.current = true
    let cancel = false
    setDone('busy')
    void (async () => {
      const { data, error } = await sb.rpc('claim_family_tree_member_via_invite', { p_token: token })
      if (cancel) return
      if (error) {
        setDone('err')
        setMsg(error.message)
        return
      }
      const body = data as { ok?: boolean; family_tree_id?: string; error?: string }
      if (!body?.ok) {
        setDone('err')
        setMsg(inviteViaRpcErrorVi(body?.error))
        return
      }
      setTreeId(body.family_tree_id ?? null)
      setDone('ok')
    })()
    return () => {
      cancel = true
    }
  }, [authLoading, session?.user?.id, sb, token])

  if (!token) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6">
        <p className={`${role.bodyMd} text-center text-abnb-muted`}>Thiếu liên kết hợp lệ trong URL.</p>
        <Link to="/app" className={`${role.btnPrimary} no-underline !rounded-full`}>
          Về GiaPhả
        </Link>
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/app/login" replace state={{ from: `/app/claim-invite?token=${encodeURIComponent(token)}` }} />
  }

  if (done === 'busy' || done === 'idle') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
        <p className={`${role.bodySm} text-abnb-muted`}>Đang hoàn tất liên kết…</p>
      </div>
    )
  }

  if (done === 'err') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6">
        <p className="max-w-md text-center text-sm font-medium text-abnb-error" role="alert">
          {msg ?? 'Không liên kết được.'}
        </p>
        <Link to="/app" className={`${role.btnSecondary} no-underline !rounded-full`}>
          Về trang chủ
        </Link>
      </div>
    )
  }

  const to = treeId ? `/app/trees/${treeId}/chart` : '/app'
  return <Navigate to={to} replace />
}
