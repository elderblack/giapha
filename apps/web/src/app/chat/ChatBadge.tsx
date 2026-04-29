import { MessageCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'

export function ChatBadge() {
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
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
    void load()
  }, [load])

  useEffect(() => {
    if (!sb || !uid) return
    const ch = sb
      .channel('family-chat-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_chat_messages' },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      sb.removeChannel(ch)
    }
  }, [sb, uid, load])

  if (!sb || !uid) return null

  return (
    <Link
      to="/app/chat"
      className="relative inline-flex h-10 items-center justify-center rounded-full border border-abnb-hairlineSoft bg-abnb-canvas px-3 shadow-abnb-inner transition-colors hover:bg-abnb-surfaceSoft"
      title="Tin nhắn"
    >
      <MessageCircle className="h-[18px] w-[18px] text-abnb-ink" strokeWidth={2} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-abnb-primary px-1 text-[10px] font-bold leading-none text-abnb-onPrimary">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
