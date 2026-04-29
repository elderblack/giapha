import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'

export type PresenceState = {
  isTyping: boolean
  isOnline: boolean
}

export function useChatPresence(conversationId: string | undefined) {
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const [otherPresence, setOtherPresence] = useState<PresenceState>({ isTyping: false, isOnline: false })
  const channelRef = useRef<ReturnType<NonNullable<typeof sb>['channel']> | null>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!sb || !uid || !conversationId) return

    const ch = sb.channel(`family-chat-live-${conversationId}`, {
      config: { presence: { key: uid } },
    })

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const otherKeys = Object.keys(state).filter((k) => k !== uid)
      setOtherPresence((prev) => ({ ...prev, isOnline: otherKeys.length > 0 }))
    })

    ch.on('broadcast', { event: 'typing' }, (payload) => {
      const from = (payload as { payload?: { user_id?: string } }).payload?.user_id
      if (from && from !== uid) {
        setOtherPresence((prev) => ({ ...prev, isTyping: true }))
        if (typingTimeout.current) clearTimeout(typingTimeout.current)
        typingTimeout.current = setTimeout(() => {
          setOtherPresence((prev) => ({ ...prev, isTyping: false }))
        }, 3000)
      }
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ online_at: new Date().toISOString() })
      }
    })

    channelRef.current = ch

    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
      sb.removeChannel(ch)
      channelRef.current = null
    }
  }, [sb, uid, conversationId])

  const sendTyping = useCallback(() => {
    if (!channelRef.current || !uid) return
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: uid },
    })
  }, [uid])

  return { otherPresence, sendTyping }
}
