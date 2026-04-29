import type { SupabaseClient } from '@supabase/supabase-js'

/** Sau migration one-tree-per-user: tối đa một dòng trong family_tree_roles cho mỗi user. */
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

export async function userBelongsToSomeFamilyTree(
  sb: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const id = await getUserFamilyTreeId(sb, userId)
  return id !== null
}
