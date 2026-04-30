import { Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { role } from '../../design/roles'
import { getSupabase } from '../../lib/supabase'
import { broadcastFamilyChatThreadsReload } from './chatReadSync'

type ProfileRow = { id: string; full_name: string; avatar_url: string | null }

function rpcErrVi(msg: string): string {
  const s = msg.toLowerCase()
  if (s.includes('group_need_at_least_two')) return 'Chọn thêm ít nhất một người (tổng tối thiểu 2 thành viên).'
  if (s.includes('group_member_not_eligible')) return 'Một số người chưa đủ điều kiện nhắn cùng bạn (bạn bè hoặc cùng dòng họ).'
  if (s.includes('group_creator_must_be_member')) return 'Bạn phải nằm trong danh sách thành viên.'
  if (s.includes('not_authenticated')) return 'Vui lòng đăng nhập lại.'
  return msg || 'Không tạo được nhóm.'
}

type Props = {
  open: boolean
  onClose: () => void
  /** Sau khi tạo xong */
  onCreated: (conversationId: string) => void
}

export function ChatCreateGroupModal(props: Props) {
  const { open, onClose, onCreated } = props
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id

  const [title, setTitle] = useState('')
  const [candidates, setCandidates] = useState<ProfileRow[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [loadingList, setLoadingList] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCandidates = useCallback(async () => {
    if (!sb || !uid) return
    setLoadingList(true)
    setError(null)
    const ids = new Set<string>()
    const { data: fr } = await sb.from('family_friendships').select('user_low,user_high').or(`user_low.eq.${uid},user_high.eq.${uid}`)
    for (const row of (fr ?? []) as { user_low: string; user_high: string }[]) {
      ids.add(row.user_low === uid ? row.user_high : row.user_low)
    }

    const { data: roleRow } = await sb
      .from('family_tree_roles')
      .select('family_tree_id')
      .eq('user_id', uid)
      .maybeSingle()
    const fid = (roleRow as { family_tree_id?: string } | null)?.family_tree_id
    if (fid) {
      const { data: roles } = await sb.from('family_tree_roles').select('user_id').eq('family_tree_id', fid)
      for (const r of (roles ?? []) as { user_id: string }[]) {
        if (r.user_id !== uid) ids.add(r.user_id)
      }
    }

    ids.delete(uid)
    const idArr = [...ids]
    if (idArr.length === 0) {
      setCandidates([])
      setLoadingList(false)
      return
    }

    const { data: profs } = await sb
      .from('profiles')
      .select('id,full_name,avatar_url')
      .in('id', idArr)
      .order('full_name', { ascending: true })

    setCandidates(((profs ?? []) as ProfileRow[]).sort((a, b) => a.full_name.localeCompare(b.full_name)))
    setLoadingList(false)
  }, [sb, uid])

  useEffect(() => {
    if (!open) return
    setTitle('')
    setPicked(new Set())
    void loadCandidates()
  }, [open, loadCandidates])

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (!sb || !uid) return
    if (picked.size < 1) {
      setError('Chọn ít nhất một người trong nhóm.')
      return
    }
    const memberIds = [uid, ...[...picked]]
    setSubmitBusy(true)
    setError(null)
    const { data, error: rpcError } = await sb.rpc('family_chat_create_group', {
      /** Luôn gửi đủ hai tham số: PostgREST khớp theo chữ ký; bỏ p_title sẽ gây lỗi "function ... (p_member_ids) not found". */
      p_title: title.trim(),
      p_member_ids: memberIds,
    })
    setSubmitBusy(false)
    if (rpcError) {
      setError(rpcErrVi(rpcError.message))
      return
    }
    const convId = data as string
    broadcastFamilyChatThreadsReload()
    onCreated(convId)
    onClose()
  }

  if (!open || !sb || !uid) return null

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/40 px-3 pb-[calc(env(safe-area-inset-bottom,0)+16px)] pt-[min(40vh,12rem)] sm:items-center sm:p-6 sm:pb-6 sm:pt-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-labelledby="chat-create-group-title"
        className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-abnb-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-abnb-hairlineSoft px-4 py-3">
          <div className="min-w-0">
            <h2 id="chat-create-group-title" className={`${role.headingModule} m-0 text-[17px]`}>
              Nhóm mới
            </h2>
            <p className={`${role.bodySm} mt-1 text-abnb-muted`}>
              Chọn người trong{' '}
              <strong>bạn bè</strong> hoặc <strong>cùng dòng họ</strong> của bạn.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-abnb-muted hover:bg-abnb-surfaceSoft hover:text-abnb-ink"
            title="Đóng"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="shrink-0 border-b border-abnb-hairlineSoft/80 px-4 py-3">
          <label className={`${role.bodySm} mb-1.5 block font-semibold text-abnb-ink`}>Tên nhóm</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Gia đình ông Ba"
            className="h-11 w-full rounded-abnb-lg border border-abnb-hairline bg-abnb-surfaceSoft px-3 text-[14px] text-abnb-ink placeholder:text-abnb-muted focus:border-abnb-ink focus:outline-none focus:ring-1 focus:ring-abnb-ink/15"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {loadingList ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-abnb-primary" strokeWidth={2} />
            </div>
          ) : candidates.length === 0 ? (
            <p className={`${role.bodySm} px-1 py-8 text-center text-abnb-muted`}>
              Chưa có ai để thêm — kết bạn hoặc tham gia dòng họ trước nhé.
            </p>
          ) : (
            <ul className="space-y-1 py-2">
              {candidates.map((p) => {
                const checked = picked.has(p.id)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => togglePick(p.id)}
                      className={`flex w-full items-center gap-3 rounded-abnb-lg px-3 py-2.5 text-left transition-colors ${
                        checked ? 'bg-abnb-primary/12 ring-1 ring-abnb-primary/25' : 'hover:bg-abnb-surfaceSoft'
                      }`}
                    >
                      <input readOnly type="checkbox" checked={checked} className="pointer-events-none h-4 w-4 accent-abnb-primary" />
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-abnb-surfaceStrong text-[14px] font-semibold text-abnb-ink">
                          {p.full_name[0]?.toUpperCase() ?? '?'}
                        </span>
                      )}
                      <span className={`${role.bodyMd} truncate font-semibold text-abnb-ink`}>{p.full_name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {error ? (
          <p className={`${role.bodySm} shrink-0 px-4 pb-2 text-abnb-error`} role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex shrink-0 gap-2 border-t border-abnb-hairlineSoft px-4 py-3">
          <button
            type="button"
            onClick={() => onClose()}
            className="flex-1 rounded-abnb-lg border border-abnb-hairlineSoft py-3 text-[14px] font-semibold text-abnb-ink hover:bg-abnb-surfaceSoft"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={submitBusy || picked.size < 1 || loadingList}
            onClick={() => void submit()}
            className="flex-1 rounded-abnb-lg bg-abnb-primary py-3 text-[14px] font-semibold text-abnb-onPrimary hover:opacity-95 disabled:opacity-50"
          >
            {submitBusy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Đang tạo…
              </span>
            ) : (
              `Tạo (${picked.size + 1} người)`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
