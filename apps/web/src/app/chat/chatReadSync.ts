import type { SupabaseClient } from '@supabase/supabase-js'

/** Mọi `useChatThreads` lắng nghe và gọi lại load() — đồng bộ badge + danh sách giữa AppShell và /app/chat. */
export const FAMILY_CHAT_THREADS_RELOAD_EVENT = 'family-chat-threads-reload'

export function broadcastFamilyChatThreadsReload() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(FAMILY_CHAT_THREADS_RELOAD_EVENT))
}

export async function markFamilyChatConversationRead(
  sb: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<void> {
  const { error } = await sb
    .from('family_chat_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (!error) broadcastFamilyChatThreadsReload()
}
