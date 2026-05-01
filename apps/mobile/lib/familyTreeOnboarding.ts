import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidInviteUuid(s: string): boolean {
  return UUID_RE.test(s.trim())
}

type JoinBody = { ok?: boolean; error?: string; name?: string; family_tree_id?: string }

function joinFamilyTreeResultMessage(body: JoinBody | null): string | null {
  if (body?.ok) return null
  if (!body) return 'Không tham gia được.'
  switch (body.error) {
    case 'already_in_another_tree':
      return 'Bạn đã thuộc một dòng họ khác. Mỗi tài khoản chỉ có một dòng họ.'
    case 'not_found':
      return 'Không tìm thấy mã mời.'
    default:
      return 'Không tham gia được.'
  }
}

export async function joinFamilyTreeInvite(
  sb: SupabaseClient,
  invite: string,
): Promise<{ ok: true; treeId: string } | { ok: false; message: string }> {
  const uuid = invite.trim()
  if (!isValidInviteUuid(uuid)) {
    return { ok: false, message: 'Mã mời không đúng định dạng (UUID).' }
  }
  const { data, error } = await sb.rpc('join_family_tree', { p_invite: uuid })
  if (error) {
    return { ok: false, message: error.message }
  }
  const body = data as JoinBody
  if (body?.ok && typeof body.family_tree_id === 'string' && body.family_tree_id.length > 0) {
    return { ok: true, treeId: body.family_tree_id }
  }
  const msg = joinFamilyTreeResultMessage(body)
  return { ok: false, message: msg ?? 'Không tham gia được.' }
}

function createRpcMissing(message: string): boolean {
  const m = message.toLowerCase()
  if (m.includes('name_too_short') || m.includes('unauthorized') || m.includes('already_in_family_tree')) return false
  return (
    (m.includes('create_family_tree') &&
      (m.includes('does not exist') || m.includes('could not find') || m.includes('schema cache'))) ||
    (m.includes('could not find the function') && m.includes('create_family_tree'))
  )
}

export async function createFamilyTreeSpace(
  sb: SupabaseClient,
  opts: {
    name: string
    clan_name: string | null
    origin_place: string | null
    description: string | null
  },
): Promise<{ ok: true; treeId: string } | { ok: false; message: string }> {
  const { data: treeId, error: rpcErr } = await sb.rpc('create_family_tree', {
    p_name: opts.name.trim(),
    p_clan_name: opts.clan_name,
    p_origin_place: opts.origin_place,
    p_description: opts.description,
  })
  if (rpcErr) {
    if (createRpcMissing(rpcErr.message)) {
      return {
        ok: false,
        message:
          'Máy chủ chưa có create_family_tree. Hãy chạy migration Supabase mới nhất.',
      }
    }
    const m = rpcErr.message.toLowerCase()
    if (m.includes('name_too_short')) return { ok: false, message: 'Tên dòng họ cần ít nhất 2 ký tự.' }
    if (m.includes('unauthorized')) return { ok: false, message: 'Phiên đăng nhập hết hạn. Đăng nhập lại.' }
    if (m.includes('already_in_family_tree')) {
      return { ok: false, message: 'Bạn đã có dòng họ — không thể tạo thêm.' }
    }
    return { ok: false, message: rpcErr.message }
  }
  if (treeId == null || treeId === '') {
    return { ok: false, message: 'Không tạo được dòng họ.' }
  }
  return { ok: true, treeId: String(treeId) }
}
