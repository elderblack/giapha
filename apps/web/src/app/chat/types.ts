export type ChatConversation = {
  id: string
  kind: 'dm'
  last_message_at: string | null
  created_at: string
}

export type ChatParticipant = {
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string | null
}

export type ChatMessage = {
  id: string
  conversation_id: string
  sender_id: string
  body: string | null
  attachment_path: string | null
  attachment_kind: 'image' | null
  created_at: string
}

export type ChatThreadPreview = {
  conversation: ChatConversation
  otherUser: { id: string; full_name: string; avatar_url: string | null }
  lastMessage: ChatMessage | null
  unreadCount: number
}
