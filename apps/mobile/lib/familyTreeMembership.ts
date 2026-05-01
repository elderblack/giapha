import type { SupabaseClient } from '@supabase/supabase-js'

export async function getUserFamilyTreeId(
  sb: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from('family_tree_roles')
    .select('family_tree_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return null
  const id = data?.family_tree_id
  return typeof id === 'string' ? id : null
}
