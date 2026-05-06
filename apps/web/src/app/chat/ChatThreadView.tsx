import { ArrowLeft, Maximize2, Minus, Pencil, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import { ChatUserAvatar } from './ChatUserAvatar'
import { ChatThreadHeaderSkeleton } from './ChatSkeletons'
import { broadcastFamilyChatThreadsReload, markFamilyChatConversationRead } from './chatReadSync'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'
import { PeerNicknameDialog } from './PeerNicknameDialog'
import type { ChatParticipant } from './types'
import { useChatMessages } from './useChatMessages'
import { useChatPresence } from './useChatPresence'

type DmPeer = {
  peerId: string
  full_name: string
  avatar_url: string | null
  nickname: string | null
}

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

  const [convMeta, setConvMeta] = useState<{ kind: 'dm' | 'group'; title: string | null } | null>(
    null,
  )
  const [participantCount, setParticipantCount] = useState(0)
  const [dmPeer, setDmPeer] = useState<DmPeer | null>(null)
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false)
  const [nicknameSaving, setNicknameSaving] = useState(false)
  const [senderNameByUserId, setSenderNameByUserId] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!sb || !uid || !conversationId) return
    let mounted = true
    void (async () => {
      const { data: convRow } = await sb
        .from('family_chat_conversations')
        .select('kind,title')
        .eq('id', conversationId)
        .single()

      if (!mounted) return

      const kindRaw = (convRow as { kind?: string } | null)?.kind
      const kind: 'dm' | 'group' = kindRaw === 'group' ? 'group' : 'dm'
      const title = (convRow as { title?: string | null } | null)?.title ?? null
      setConvMeta({ kind, title })
      setDmPeer(null)
      setSenderNameByUserId({})

      const { data: parts } = await sb
        .from('family_chat_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
      const userIds = ((parts ?? []) as Pick<ChatParticipant, 'user_id'>[]).map((p) => p.user_id)
      if (!mounted) return
      setParticipantCount(userIds.length)

      if (kind === 'group') {
        if (userIds.length === 0) return
        const { data: profs } = await sb.from('profiles').select('id,full_name').in('id', userIds)
        if (!mounted) return
        const map: Record<string, string> = {}
        for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
          map[p.id] = p.full_name
        }
        setSenderNameByUserId(map)
        return
      }

      const otherId = userIds.find((id) => id !== uid)
      if (!otherId) return
      const [{ data: prof }, { data: nickRow }] = await Promise.all([
        sb.from('profiles').select('full_name,avatar_url').eq('id', otherId).single(),
        sb
          .from('family_chat_peer_nicknames')
          .select('nickname')
          .eq('viewer_user_id', uid)
          .eq('peer_user_id', otherId)
          .maybeSingle(),
      ])
      const nickRaw = (nickRow as { nickname?: string } | null)?.nickname?.trim()
      if (mounted && prof) {
        setDmPeer({
          peerId: otherId,
          full_name: (prof as { full_name: string }).full_name,
          avatar_url: (prof as { avatar_url: string | null }).avatar_url,
          nickname: nickRaw || null,
        })
      }
    })()
    return () => {
      mounted = false
    }
  }, [sb, uid, conversationId])

  useEffect(() => {
    if (!sb || !uid || !conversationId || loading) return
    void markFamilyChatConversationRead(sb, uid, conversationId)
  }, [sb, uid, conversationId, messages.length, loading])

  const isGroup = convMeta?.kind === 'group'
  const groupTitle = (convMeta?.title?.trim() || 'Nhóm') as string
  const headerLoading = !convMeta || (!isGroup && !dmPeer)

  const dmDisplayName =
    dmPeer?.nickname?.trim() || dmPeer?.full_name || ''

  const avatar = isGroup ? (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-abnb-primary/12 text-abnb-primary ring-2 ring-abnb-canvas">
      <Users className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
    </span>
  ) : (
    <ChatUserAvatar avatarUrl={dmPeer?.avatar_url} size="sm" />
  )

  const titleBlock =
    isGroup && convMeta ? (
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-semibold leading-tight text-abnb-ink">{groupTitle}</span>
        <span className="truncate text-[11px] text-abnb-muted">{participantCount} thành viên · Nhóm</span>
      </div>
    ) : dmPeer != null ? (
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
        <div className="flex min-w-0 flex-col justify-center">
          <span className="truncate text-[15px] font-semibold leading-tight text-abnb-ink">{dmDisplayName}</span>
          {variant === 'page' && otherPresence.isOnline && (
            <span className="text-[11px] text-green-600">Đang hoạt động</span>
          )}
          {variant === 'mini' && otherPresence.isOnline && (
            <span className="truncate text-[11px] text-green-600">Đang hoạt động</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setNicknameModalOpen(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-abnb-muted transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-primary"
          title="Đặt biệt danh"
        >
          <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    ) : null

  async function commitNickname(trimmed: string) {
    if (!sb || !uid || !dmPeer) return
    setNicknameSaving(true)
    try {
      if (trimmed.length === 0) {
        const { error } = await sb
          .from('family_chat_peer_nicknames')
          .delete()
          .eq('viewer_user_id', uid)
          .eq('peer_user_id', dmPeer.peerId)
        if (error) return
        setDmPeer((p) => (p ? { ...p, nickname: null } : p))
      } else {
        const { error } = await sb.from('family_chat_peer_nicknames').upsert(
          {
            viewer_user_id: uid,
            peer_user_id: dmPeer.peerId,
            nickname: trimmed,
          },
          { onConflict: 'viewer_user_id,peer_user_id' },
        )
        if (error) return
        setDmPeer((p) => (p ? { ...p, nickname: trimmed } : p))
      }
      setNicknameModalOpen(false)
      broadcastFamilyChatThreadsReload()
    } finally {
      setNicknameSaving(false)
    }
  }

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
            {headerLoading ? (
              <ChatThreadHeaderSkeleton />
            ) : (
              <div className="flex min-w-0 items-center gap-2.5">
                {avatar}
                {titleBlock}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {headerLoading ? (
                <ChatThreadHeaderSkeleton />
              ) : (
                <>
                  {avatar}
                  {titleBlock}
                </>
              )}
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
      <MessageList
        messages={messages}
        loading={loading}
        bottomRef={bottomRef}
        senderNameByUserId={isGroup ? senderNameByUserId : undefined}
      />
      {dmPeer && (
        <PeerNicknameDialog
          open={nicknameModalOpen}
          peerFullName={dmPeer.full_name}
          draftInitial={dmPeer.nickname ?? ''}
          saving={nicknameSaving}
          onClose={() => {
            if (!nicknameSaving) setNicknameModalOpen(false)
          }}
          onCommit={commitNickname}
        />
      )}
      {!isGroup && otherPresence.isTyping ? (
        <div className="shrink-0 px-3 py-1 sm:px-4">
          <span className="text-[12px] italic text-abnb-muted">Đang nhập…</span>
        </div>
      ) : null}
      <MessageComposer
        conversationId={conversationId}
        onSendText={sendText}
        onSendImage={sendImage}
        onTyping={sendTyping}
      />
    </div>
  )
}
