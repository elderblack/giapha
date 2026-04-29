import type { SupabaseClient } from '@supabase/supabase-js'

export async function clearMemberSpouse(sb: SupabaseClient, memberId: string) {
  const { data: a } = await sb.from('family_tree_members').select('spouse_id').eq('id', memberId).maybeSingle()
  const partner = (a?.spouse_id as string | null) ?? null
  if (partner) {
    await sb.from('family_tree_members').update({ spouse_id: null }).eq('id', partner)
  }
  await sb.from('family_tree_members').update({ spouse_id: null }).eq('id', memberId)
  await sb.from('family_tree_members').update({ spouse_id: null }).eq('spouse_id', memberId)
}

export async function applySpouseLink(
  sb: SupabaseClient,
  memberId: string,
  nextSpouseId: string | null,
): Promise<{ error: string | null }> {
  await clearMemberSpouse(sb, memberId)
  if (!nextSpouseId) return { error: null }
  await clearMemberSpouse(sb, nextSpouseId)
  const { error: e1 } = await sb.from('family_tree_members').update({ spouse_id: nextSpouseId }).eq('id', memberId)
  if (e1) return { error: e1.message }
  const { error: e2 } = await sb.from('family_tree_members').update({ spouse_id: memberId }).eq('id', nextSpouseId)
  if (e2) return { error: e2.message }
  return { error: null }
}
