import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'
import type { ChatMessage } from './types'

export function useChatMessages(conversationId: string | undefined) {
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    if (!sb || !uid || !conversationId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await sb
      .from('family_chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages((data as ChatMessage[]) ?? [])
    setLoading(false)
  }, [sb, uid, conversationId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!sb || !uid || !conversationId) return
    const ch = sb
      .channel(`family-chat-thread-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        },
      )
      .subscribe()
    return () => {
      sb.removeChannel(ch)
    }
  }, [sb, uid, conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendText(body: string) {
    if (!sb || !uid || !conversationId) return
    const text = body.trim()
    if (!text) return
    await sb.from('family_chat_messages').insert({
      conversation_id: conversationId,
      sender_id: uid,
      body: text,
    })
  }

  async function sendImage(storagePath: string) {
    if (!sb || !uid || !conversationId) return
    await sb.from('family_chat_messages').insert({
      conversation_id: conversationId,
      sender_id: uid,
      attachment_path: storagePath,
      attachment_kind: 'image',
    })
  }

  return { messages, loading, sendText, sendImage, bottomRef }
}
