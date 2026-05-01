import type { SupabaseClient } from '@supabase/supabase-js'

export async function markFamilyChatConversationRead(
  sb: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<void> {
  await sb
    .from('family_chat_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}
