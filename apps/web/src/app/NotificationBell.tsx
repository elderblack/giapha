import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { getSupabase } from '../lib/supabase'
import { role } from '../design/roles'

export type AppNotificationRow = {
  id: string
  kind: string
  payload: Record<string, unknown>
  family_tree_id: string | null
  read_at: string | null
  created_at: string
}

function payloadSummary(kind: string, _payload: Record<string, unknown>): string {
  switch (kind) {
    case 'post_created':
      return 'Bài mới trong dòng họ của bạn.'
    case 'post_reacted':
      return 'Có người phản hồi bài viết của bạn.'
    case 'comment_on_post':
    case 'comment_on_post_reply':
      return 'Bình luận mới trên bài viết.'
    case 'reply_to_comment':
      return 'Có người trả lời bình luận của bạn.'
    case 'friend_request':
      return 'Lời mời kết bạn mới.'
    case 'friend_request_accepted':
      return 'Lời mời kết bạn đã được chấp nhận.'
    default:
      return 'Thông báo mới.'
  }
}

export function NotificationBell() {
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<AppNotificationRow[]>([])
  const [unread, setUnread] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!sb || !uid) return
    const { data, error } = await sb
      .from('family_notifications')
      .select('id,kind,payload,family_tree_id,read_at,created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(40)
    if (error || !data) return
    const list = data as AppNotificationRow[]
    setRows(list)
    setUnread(list.filter((r) => !r.read_at).length)
  }, [sb, uid])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!sb || !uid) return
    const ch = sb
      .channel(`family-notifications-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_notifications',
          filter: `user_id=eq.${uid}`,
        },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      sb.removeChannel(ch)
    }
  }, [sb, uid, load])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function markRead(ids: string[]) {
    if (!sb || !ids.length) return
    await sb.from('family_notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
    await load()
  }

  async function openPanel() {
    const next = !open
    setOpen(next)
    if (next && rows.length) {
      const unreadIds = rows.filter((r) => !r.read_at).map((r) => r.id)
      if (unreadIds.length) await markRead(unreadIds)
    }
  }

  if (!sb || !uid) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => void openPanel()}
        className="relative inline-flex h-10 items-center justify-center rounded-full border border-abnb-hairlineSoft bg-abnb-canvas px-3 shadow-abnb-inner transition-colors hover:bg-abnb-surfaceSoft"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Thông báo"
      >
        <Bell className="h-[18px] w-[18px] text-abnb-ink" strokeWidth={2} />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-abnb-primary px-1 text-[10px] font-bold leading-none text-abnb-onPrimary">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className={`absolute right-0 top-[calc(100%+6px)] z-50 w-[min(100vw-2rem,22rem)] rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard p-2 shadow-abnb-lg`}
          role="dialog"
          aria-label="Thông báo"
        >
          <p className={`${role.headingModule} px-2 pb-2 pt-1`}>Thông báo</p>
          <ul className={`max-h-[min(70vh,22rem)] space-y-1 overflow-y-auto`}>
            {rows.length === 0 ? (
              <li className={`${role.bodySm} px-3 py-6 text-center text-abnb-muted`}>Chưa có thông báo.</li>
            ) : (
              rows.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-abnb-lg px-3 py-2 ${r.read_at ? 'opacity-85' : 'bg-abnb-primary/[0.06]'}`}
                >
                  <p className="text-[13px] font-medium leading-snug text-abnb-ink">{payloadSummary(r.kind, r.payload)}</p>
                  <p className={`${role.statLabel} mt-0.5 normal-case text-abnb-muted`}>{formatDt(r.created_at)}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function formatDt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}
