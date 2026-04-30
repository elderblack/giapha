import { Maximize2, MessageCircle, Search } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import { role } from '../../design/roles'
import { markFamilyChatConversationRead } from './chatReadSync'
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
  const [search, setSearch] = useState('')
  const [popoverBox, setPopoverBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const { threads, loading, reload } = useChatThreads()

  /** Cùng nguồn với từng dòng trong ThreadList để không lệch số badge. */
  const unreadTotal = useMemo(() => threads.reduce((s, t) => s + t.unreadCount, 0), [threads])

  const updatePopoverPosition = useCallback(() => {
    const el = buttonRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const margin = 8
    const width = Math.min(352, vw - margin * 2)
    // Căn phải theo nút, nhưng kéo vào trong viewport để không cắt mép trái
    let left = r.right - width
    if (left < margin) left = margin
    if (left + width > vw - margin) left = vw - margin - width
    const top = r.bottom + 6
    setPopoverBox({ top, left, width })
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
    if (next) void reload()
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
        {unreadTotal > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-abnb-primary px-1 text-[10px] font-bold leading-none text-abnb-onPrimary">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>
      {popoverOpen && popoverBox ? (
        <div
          className="fixed z-[200] flex max-h-[min(85vh,calc(100dvh-2rem))] flex-col overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-abnb-lg"
          style={{
            top: popoverBox.top,
            left: popoverBox.left,
            width: popoverBox.width,
          }}
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
              onThreadActivate={(id) => {
                void markFamilyChatConversationRead(sb, uid, id)
              }}
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
