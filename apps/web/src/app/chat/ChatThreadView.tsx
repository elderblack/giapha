import { ArrowLeft, Loader2, Maximize2, Minus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'
import type { ChatParticipant } from './types'
import { useChatMessages } from './useChatMessages'
import { useChatPresence } from './useChatPresence'

type Variant = 'page' | 'mini'

export function ChatThreadView(props: {
  conversationId: string
  variant: Variant
  onExpand?: () => void
  onMinimize?: () => void
  onClose?: () => void
}) {
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const { conversationId, variant } = props

  const { messages, loading, sendText, sendImage, bottomRef } = useChatMessages(conversationId)
  const { otherPresence, sendTyping } = useChatPresence(conversationId)
  const [otherUser, setOtherUser] = useState<{ full_name: string; avatar_url: string | null } | null>(null)

  useEffect(() => {
    if (!sb || !uid || !conversationId) return
    let mounted = true
    void (async () => {
      const { data: parts } = await sb
        .from('family_chat_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
      const otherId = ((parts ?? []) as Pick<ChatParticipant, 'user_id'>[]).find(
        (p) => p.user_id !== uid,
      )?.user_id
      if (!otherId || !mounted) return
      const { data: prof } = await sb
        .from('profiles')
        .select('full_name,avatar_url')
        .eq('id', otherId)
        .single()
      if (mounted && prof) setOtherUser(prof as { full_name: string; avatar_url: string | null })
    })()
    return () => {
      mounted = false
    }
  }, [sb, uid, conversationId])

  useEffect(() => {
    if (!sb || !uid || !conversationId || loading) return
    void sb
      .from('family_chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', uid)
  }, [sb, uid, conversationId, messages.length, loading])

  const avatar =
    otherUser?.avatar_url ? (
      <img src={otherUser.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
    ) : (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-abnb-surfaceStrong text-[13px] font-semibold text-abnb-ink">
        {otherUser?.full_name[0]?.toUpperCase() ?? '?'}
      </span>
    )

  const titleBlock =
    otherUser != null ? (
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-semibold leading-tight text-abnb-ink">{otherUser.full_name}</span>
        {variant === 'page' && otherPresence.isOnline && (
          <span className="text-[11px] text-green-600">Đang hoạt động</span>
        )}
        {variant === 'mini' && otherPresence.isOnline && (
          <span className="truncate text-[11px] text-green-600">Đang hoạt động</span>
        )}
      </div>
    ) : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-abnb-hairlineSoft bg-abnb-canvas/90 px-2 py-2 backdrop-blur sm:gap-3 sm:px-3">
        {variant === 'page' ? (
          <>
            <Link
              to="/app/chat"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-abnb-muted transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-ink sm:hidden"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </Link>
            {otherUser ? (
              <div className="flex min-w-0 items-center gap-2.5">
                {avatar}
                {titleBlock}
              </div>
            ) : (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-abnb-muted" />
            )}
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {otherUser ? avatar : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-abnb-muted" />}
              {otherUser ? titleBlock : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {props.onExpand ? (
                <button
                  type="button"
                  onClick={props.onExpand}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-abnb-primary transition-colors hover:bg-abnb-surfaceSoft"
                  title="Mở trong tin nhắn"
                >
                  <Maximize2 className="h-4 w-4" strokeWidth={2} />
                </button>
              ) : null}
              {props.onMinimize ? (
                <button
                  type="button"
                  onClick={props.onMinimize}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-abnb-muted transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-ink"
                  title="Thu nhỏ"
                >
                  <Minus className="h-5 w-5" strokeWidth={2} />
                </button>
              ) : null}
              {props.onClose ? (
                <button
                  type="button"
                  onClick={props.onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-abnb-muted transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-ink"
                  title="Đóng"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              ) : null}
            </div>
          </>
        )}
      </header>
      <MessageList messages={messages} loading={loading} bottomRef={bottomRef} />
      {otherPresence.isTyping && (
        <div className="shrink-0 px-3 py-1 sm:px-4">
          <span className="text-[12px] italic text-abnb-muted">Đang nhập…</span>
        </div>
      )}
      <MessageComposer
        conversationId={conversationId}
        onSendText={sendText}
        onSendImage={sendImage}
        onTyping={sendTyping}
      />
    </div>
  )
}
