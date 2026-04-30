import { Maximize2, MessageCircle, Search } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import { role } from '../../design/roles'
import { useChatDock } from './ChatDockContext'
import { ThreadList } from './ThreadList'
import { useChatThreads } from './useChatThreads'

export function ChatBadge() {
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const navigate = useNavigate()
  const { popoverOpen, setPopoverOpen, openMiniConversation, miniConversationId } = useChatDock()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [unread, setUnread] = useState(0)
  const [search, setSearch] = useState('')
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null)
  const { threads, loading } = useChatThreads()

  const updatePopoverPosition = useCallback(() => {
    const el = buttonRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 8
    const right = Math.max(margin, window.innerWidth - r.right)
    setPopoverPos({ top: r.bottom + 6, right })
  }, [])

  useLayoutEffect(() => {
    if (!popoverOpen) return
    updatePopoverPosition()
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
    return () => {
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [popoverOpen, updatePopoverPosition])

  const loadUnread = useCallback(async () => {
    if (!sb || !uid) return

    const { data: parts } = await sb
      .from('family_chat_participants')
      .select('conversation_id,last_read_at')
      .eq('user_id', uid)

    if (!parts || parts.length === 0) {
      setUnread(0)
      return
    }

    let total = 0
    for (const p of parts as { conversation_id: string; last_read_at: string | null }[]) {
      const { count } = await sb
        .from('family_chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', p.conversation_id)
        .neq('sender_id', uid)
        .gt('created_at', p.last_read_at ?? '1970-01-01T00:00:00Z')
      total += count ?? 0
    }
    setUnread(total)
  }, [sb, uid])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial/sync unread from Supabase
    void loadUnread()
  }, [loadUnread])

  useEffect(() => {
    if (!sb || !uid) return
    const topic = `family-chat-badge:${uid}`
    const ch = sb
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_chat_messages' },
        () => {
          void loadUnread()
        },
      )
      .subscribe()
    return () => {
      sb.removeChannel(ch)
    }
  }, [sb, uid, loadUnread])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!popoverOpen) return
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [popoverOpen, setPopoverOpen])

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return threads
    return threads.filter((t) => {
      const name = t.otherUser.full_name.toLowerCase()
      const body = t.lastMessage?.body?.toLowerCase() ?? ''
      return name.includes(q) || body.includes(q)
    })
  }, [threads, search])

  function openMainChat() {
    setPopoverOpen(false)
    setSearch('')
    void navigate('/app/chat')
  }

  function togglePopover() {
    const next = !popoverOpen
    setPopoverOpen(next)
    if (next) void loadUnread()
  }

  if (!sb || !uid) return null

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => togglePopover()}
        className="relative inline-flex h-10 items-center justify-center rounded-full border border-abnb-hairlineSoft bg-abnb-canvas px-3 shadow-abnb-inner transition-colors hover:bg-abnb-surfaceSoft"
        aria-expanded={popoverOpen}
        aria-haspopup="dialog"
        title="Tin nhắn"
      >
        <MessageCircle className="h-[18px] w-[18px] text-abnb-ink" strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-abnb-primary px-1 text-[10px] font-bold leading-none text-abnb-onPrimary">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {popoverOpen && popoverPos ? (
        <div
          className="fixed z-[100] flex w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-abnb-lg"
          style={{ top: popoverPos.top, right: popoverPos.right }}
          role="dialog"
          aria-label="Tin nhắn"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-abnb-hairlineSoft px-3 py-2.5">
            <h2 className={`${role.headingModule} m-0 text-[15px]`}>Đoạn chat</h2>
            <button
              type="button"
              onClick={() => openMainChat()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-abnb-primary transition-colors hover:bg-abnb-surfaceSoft"
              title="Mở rộng — xem trong tin nhắn"
            >
              <Maximize2 className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </div>
          <div className="shrink-0 border-b border-abnb-hairlineSoft/80 px-3 py-2">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-abnb-muted"
                strokeWidth={2}
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm trong tin nhắn…"
                className="h-10 w-full rounded-full border border-abnb-hairline bg-abnb-surfaceSoft py-2 pl-9 pr-3 text-[14px] text-abnb-ink placeholder:text-abnb-muted focus:border-abnb-ink focus:outline-none focus:ring-1 focus:ring-abnb-ink/10"
              />
            </label>
          </div>
          <div className="max-h-[min(55vh,24rem)] overflow-y-auto">
            <ThreadList
              threads={filteredThreads}
              loading={loading}
              activeId={miniConversationId ?? undefined}
              mode="pick"
              onPick={(id) => openMiniConversation(id)}
            />
          </div>
          <div className="shrink-0 border-t border-abnb-hairlineSoft p-2">
            <button
              type="button"
              onClick={() => openMainChat()}
              className="w-full rounded-abnb-lg py-2.5 text-center text-[14px] font-semibold text-abnb-primary transition-colors hover:bg-abnb-surfaceSoft"
            >
              Xem tất cả trong tin nhắn
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
