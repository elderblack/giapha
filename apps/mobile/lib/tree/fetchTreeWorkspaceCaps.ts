import type { SupabaseClient } from '@supabase/supabase-js'

export type TreeWorkspaceCaps = {
  ownerId: string | null
  myRole: 'owner' | 'editor' | 'member' | null
  /** Chủ cây trong `family_trees.owner_id`. */
  isOwner: boolean
  canEditMembers: boolean
  /** Cùng họ — được gọi RPC claim/unlink như web. */
  canUseClaim: boolean
}

/**
 * Khớp `TreeWorkspaceProvider` web: chỉnh sửa = chủ hoặc role `editor`;
 * claim/unlink khi có quyền trong dòng họ.
 */
export async function fetchTreeWorkspaceCaps(
  sb: SupabaseClient,
  treeId: string,
  userId: string,
): Promise<{ caps: TreeWorkspaceCaps | null }> {
  const [treeRes, roleRes] = await Promise.all([
    sb.from('family_trees').select('owner_id').eq('id', treeId).maybeSingle(),
    sb.from('family_tree_roles').select('role').eq('family_tree_id', treeId).eq('user_id', userId).maybeSingle(),
  ])

  const treeErr = treeRes.error?.message ?? null
  if (treeErr) return { caps: null }

  const ownerRow = treeRes.data as { owner_id: string | null } | null
  const ownerId = typeof ownerRow?.owner_id === 'string' ? ownerRow.owner_id : null
  const isOwner = Boolean(ownerId && ownerId === userId)

  const r = roleRes.data?.role
  const myRole: TreeWorkspaceCaps['myRole'] =
    r === 'owner' || r === 'editor' || r === 'member' ? r : null

  const hasTreeRole = Boolean(myRole) || isOwner

  const caps: TreeWorkspaceCaps = {
    ownerId,
    myRole,
    isOwner,
    canEditMembers: Boolean(isOwner || myRole === 'editor'),
    canUseClaim: Boolean(hasTreeRole),
  }

  return { caps }
}
