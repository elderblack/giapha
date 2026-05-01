import type { SupabaseClient } from '@supabase/supabase-js'

/** Tối giản các trường cần tải — khớp RLS của `family_tree_members` */
export type TreeMemberRow = {
  id: string
  family_tree_id: string
  full_name: string
  gender: string | null
  father_id: string | null
  mother_id: string | null
  lineage_generation: number | null
  spouse_id: string | null
  linked_profile_id: string | null
  avatar_url?: string | null
  birth_date?: string | null
  death_date?: string | null
  notes?: string | null
  phone?: string | null
}

export const MEMBERS_SELECT_WITH_PHONE =
  'id,family_tree_id,full_name,gender,birth_date,death_date,notes,father_id,mother_id,lineage_generation,spouse_id,phone,linked_profile_id'

export const MEMBERS_SELECT_NO_PHONE =
  'id,family_tree_id,full_name,gender,birth_date,death_date,notes,father_id,mother_id,lineage_generation,spouse_id,linked_profile_id'

function memberPhoneMissingError(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('family_tree_members.phone') ||
    (m.includes('column') && m.includes('phone') && m.includes('does not exist'))
  )
}

export async function fetchTreeMembers(
  sb: SupabaseClient,
  treeId: string,
): Promise<{ rows: TreeMemberRow[]; error: string | null; supportsMemberPhoneColumn: boolean }> {
  let supportsMemberPhoneColumn = true
  let first = await sb.from('family_tree_members').select(MEMBERS_SELECT_WITH_PHONE).eq('family_tree_id', treeId).order('full_name')

  let data = first.data as TreeMemberRow[] | null
  let error = first.error

  if (error && memberPhoneMissingError(error.message ?? '')) {
    supportsMemberPhoneColumn = false
    const fallback = await sb.from('family_tree_members').select(MEMBERS_SELECT_NO_PHONE).eq('family_tree_id', treeId).order('full_name')
    data = fallback.data as TreeMemberRow[] | null
    error = fallback.error
  }

  if (error) {
    return { rows: [], error: error.message, supportsMemberPhoneColumn: true }
  }

  const rowsRaw = ((data ?? []) as TreeMemberRow[]).map((m) => ({ ...m, avatar_url: m.avatar_url ?? null }))

  const profileIds = [...new Set(rowsRaw.map((m) => m.linked_profile_id).filter((id): id is string => Boolean(id)))]
  let avatarByProfile = new Map<string, string | null>()
  if (profileIds.length > 0) {
    const { data: profs, error: pe } = await sb.from('profiles').select('id, avatar_url').in('id', profileIds)
    if (!pe && profs) {
      avatarByProfile = new Map((profs as { id: string; avatar_url: string | null }[]).map((p) => [p.id, p.avatar_url]))
    }
  }

  return {
    rows: rowsRaw.map((m) => ({
      ...m,
      avatar_url: m.linked_profile_id ? avatarByProfile.get(m.linked_profile_id) ?? null : null,
    })),
    error: null,
    supportsMemberPhoneColumn,
  }
}

export function rowsToChartMembers(members: TreeMemberRow[]) {
  return members.map((m) => ({
    id: m.id,
    full_name: m.full_name,
    gender: m.gender ?? null,
    father_id: m.father_id,
    mother_id: m.mother_id,
    spouse_id: m.spouse_id,
    lineage_generation: m.lineage_generation ?? null,
    avatar_url: m.avatar_url ?? null,
  }))
}
