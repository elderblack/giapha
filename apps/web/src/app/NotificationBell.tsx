import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getSupabase } from '../lib/supabase'
import { role } from '../design/roles'
import {
  collectProfileIdsFromNotificationRows,
  notificationDisplay,
  webNotificationNavigateTo,
} from '../../../../shared/appNotifications'

export type AppNotificationRow = {
  id: string
  kind: string
  payload: Record<string, unknown>
  family_tree_id: string | null
  read_at: string | null
  created_at: string
}

export function NotificationBell() {
  const { user } = useAuth()
  const sb = getSupabase()
  const navigate = useNavigate()
  const uid = user?.id
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<AppNotificationRow[]>([])
  const [nameById, setNameById] = useState<Record<string, string>>({})
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
    const ids = collectProfileIdsFromNotificationRows(list)
    let names: Record<string, string> = {}
    if (ids.length) {
      const { data: profs } = await sb.from('profiles').select('id, full_name').in('id', ids)
      if (profs) {
        names = Object.fromEntries(
          (profs as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name?.trim() ?? '']),
        )
      }
    }
    setNameById(names)
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
    setOpen((o) => !o)
  }

  async function onRowActivate(row: AppNotificationRow) {
    if (row.read_at == null) await markRead([row.id])
    setOpen(false)
    const target = webNotificationNavigateTo(row)
    if (target) navigate(target)
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
              rows.map((r) => {
                const { title, detail } = notificationDisplay(r.kind, r.payload, nameById)
                const target = webNotificationNavigateTo(r)
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => void onRowActivate(r)}
                      className={`w-full rounded-abnb-lg px-3 py-2.5 text-left transition-colors ${
                        r.read_at ? 'opacity-90 hover:bg-abnb-surfaceSoft/80' : 'bg-abnb-primary/[0.06] hover:bg-abnb-primary/[0.1]'
                      }`}
                    >
                      <p className="text-[13px] font-semibold leading-snug text-abnb-ink">{title}</p>
                      {detail ? (
                        <p className={`${role.statLabel} mt-0.5 normal-case ${target ? 'text-abnb-primary' : 'text-abnb-muted'}`}>
                          {target ? detail : 'Không thể mở nhanh — mục đã lưu trong danh sách.'}
                        </p>
                      ) : null}
                      <p className={`${role.statLabel} mt-1 normal-case text-abnb-muted`}>{formatDt(r.created_at)}</p>
                    </button>
                  </li>
                )
              })
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
