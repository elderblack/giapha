import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import { ChatThreadView } from './ChatThreadView'
import { useChatDock } from './ChatDockContext'
import type { ChatParticipant } from './types'

export function FloatingMiniChat() {
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const location = useLocation()
  const navigate = useNavigate()
  const { miniConversationId, miniMinimized, closeMiniConversation, setMiniMinimized } = useChatDock()

  const onMainChat = location.pathname === '/app/chat' || location.pathname.startsWith('/app/chat/')
  const [otherName, setOtherName] = useState<string | null>(null)
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null)

  const loadPeer = useCallback(
    async (conversationId: string) => {
      if (!sb || !uid) return
      const { data: parts } = await sb
        .from('family_chat_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
      const otherId = ((parts ?? []) as Pick<ChatParticipant, 'user_id'>[]).find((p) => p.user_id !== uid)?.user_id
      if (!otherId) return
      const { data: prof } = await sb.from('profiles').select('full_name,avatar_url').eq('id', otherId).single()
      if (prof) {
        setOtherName((prof as { full_name: string }).full_name)
        setOtherAvatar((prof as { avatar_url: string | null }).avatar_url)
      }
    },
    [sb, uid],
  )

  useEffect(() => {
    if (!miniConversationId) {
      setOtherName(null)
      setOtherAvatar(null)
      return
    }
    void loadPeer(miniConversationId)
  }, [miniConversationId, loadPeer])

  if (!miniConversationId || onMainChat || !sb || !uid) return null

  const bottomOffset =
    'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px)+8px)] md:bottom-4'

  if (miniMinimized) {
    return (
      <button
        type="button"
        onClick={() => setMiniMinimized(false)}
        className={`fixed right-3 z-[60] flex max-w-[min(18rem,calc(100vw-1.5rem))] items-center gap-2 rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard py-2 pl-2 pr-3 text-left shadow-abnb-lg ${bottomOffset}`}
        title="Mở lại trò chuyện"
      >
        {otherAvatar ? (
          <img src={otherAvatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-abnb-surfaceStrong text-[13px] font-semibold text-abnb-ink">
            {otherName?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-abnb-ink">{otherName ?? '…'}</span>
      </button>
    )
  }

  return (
    <div
      className={`fixed right-3 z-[60] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-abnb-lg ${bottomOffset}`}
      style={{ height: 'min(28rem, calc(100dvh - 6.5rem - env(safe-area-inset-bottom, 0px)))' }}
      role="dialog"
      aria-label="Trò chuyện nhanh"
    >
      <ChatThreadView
        conversationId={miniConversationId}
        variant="mini"
        onExpand={() => {
          void navigate(`/app/chat/${miniConversationId}`)
        }}
        onMinimize={() => setMiniMinimized(true)}
        onClose={closeMiniConversation}
      />
    </div>
  )
}
