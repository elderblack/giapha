import type { SupabaseClient } from '@supabase/supabase-js'

import type { ChatConversation, ChatMessage, ChatParticipant, ChatThreadPreview } from './types'

export async function fetchChatThreads(sb: SupabaseClient, uid: string): Promise<ChatThreadPreview[]> {
  const { data: parts } = await sb
    .from('family_chat_participants')
    .select('conversation_id,last_read_at')
    .eq('user_id', uid)

  if (!parts || parts.length === 0) return []

  const convIds = (parts as Pick<ChatParticipant, 'conversation_id' | 'last_read_at'>[]).map((p) => p.conversation_id)
  const readMap = new Map(
    (parts as Pick<ChatParticipant, 'conversation_id' | 'last_read_at'>[]).map((p) => [p.conversation_id, p.last_read_at]),
  )

  const { data: convs } = await sb
    .from('family_chat_conversations')
    .select('*')
    .in('id', convIds)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (!convs || convs.length === 0) return []

  const { data: allParts } = await sb.from('family_chat_participants').select('conversation_id,user_id').in('conversation_id', convIds)

  const convPeerIds = new Map<string, string[]>()
  const participantCountByConv = new Map<string, number>()
  for (const p of (allParts ?? []) as Pick<ChatParticipant, 'conversation_id' | 'user_id'>[]) {
    participantCountByConv.set(p.conversation_id, (participantCountByConv.get(p.conversation_id) ?? 0) + 1)
    if (p.user_id === uid) continue
    const peers = convPeerIds.get(p.conversation_id) ?? []
    peers.push(p.user_id)
    convPeerIds.set(p.conversation_id, peers)
  }

  const otherUserIds = new Set<string>()
  for (const peers of convPeerIds.values()) {
    for (const pid of peers) otherUserIds.add(pid)
  }

  const profileMap = new Map<string, { id: string; full_name: string; avatar_url: string | null }>()
  if (otherUserIds.size > 0) {
    const { data: profiles } = await sb.from('profiles').select('id,full_name,avatar_url').in('id', [...otherUserIds])
    for (const p of (profiles ?? []) as { id: string; full_name: string; avatar_url: string | null }[]) {
      profileMap.set(p.id, p)
    }
  }

  const results: ChatThreadPreview[] = []
  for (const conv of convs as ChatConversation[]) {
    const isGroup = conv.kind === 'group'
    const peerIds = convPeerIds.get(conv.id) ?? []
    const participantCount = participantCountByConv.get(conv.id) ?? 0
    const primaryOtherId = peerIds[0] ?? ''

    const otherProfile = primaryOtherId ? profileMap.get(primaryOtherId) : undefined

    let lastMsg: ChatMessage | null = null
    const { data: msgs } = await sb
      .from('family_chat_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (msgs && msgs.length > 0) lastMsg = msgs[0] as ChatMessage

    const lastRead = readMap.get(conv.id)
    const { count: unreadCountRaw } = await sb
      .from('family_chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .neq('sender_id', uid)
      .gt('created_at', lastRead ?? '1970-01-01T00:00:00Z')
    const unreadCount = unreadCountRaw ?? 0

    const threadTitle = isGroup ? (conv.title?.trim() || 'Nhóm') : (otherProfile?.full_name ?? 'Người dùng')

    results.push({
      conversation: conv,
      isGroup,
      threadTitle,
      participantCount,
      otherUser: otherProfile ?? { id: primaryOtherId, full_name: threadTitle, avatar_url: null },
      lastMessage: lastMsg,
      unreadCount,
    })
  }

  return results
}
