import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'
import { useChatMessages } from './useChatMessages'
import { useChatPresence } from './useChatPresence'
import type { ChatParticipant } from './types'

export function ChatThreadPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id

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

  if (!conversationId) return null

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-abnb-hairlineSoft bg-abnb-canvas/90 px-3 py-2.5 backdrop-blur sm:px-4">
        <Link
          to="/app/chat"
          className="flex h-8 w-8 items-center justify-center rounded-full text-abnb-muted transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-ink sm:hidden"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        {otherUser ? (
          <div className="flex items-center gap-2.5">
            {otherUser.avatar_url ? (
              <img src={otherUser.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-abnb-surfaceStrong text-[13px] font-semibold text-abnb-ink">
                {otherUser.full_name[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold leading-tight text-abnb-ink">{otherUser.full_name}</span>
              {otherPresence.isOnline && (
                <span className="text-[11px] text-green-600">Đang hoạt động</span>
              )}
            </div>
          </div>
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-abnb-muted" />
        )}
      </header>
      <MessageList messages={messages} loading={loading} bottomRef={bottomRef} />
      {otherPresence.isTyping && (
        <div className="shrink-0 px-4 py-1">
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
