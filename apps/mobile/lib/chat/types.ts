export type ChatConversation = {
  id: string
  kind: 'dm' | 'group'
  title: string | null
  family_tree_id: string | null
  branch_root_member_id: string | null
  created_by: string | null
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
  isGroup: boolean
  threadTitle: string
  participantCount: number
  otherUser: { id: string; full_name: string; avatar_url: string | null }
  lastMessage: ChatMessage | null
  unreadCount: number
}
