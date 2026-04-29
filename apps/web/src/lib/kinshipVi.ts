import type { MemberRow } from '../app/tree/treeTypes'

const KINSHIP_GENERIC = 'Họ hàng (xem quan hệ cha/mẹ trên cây)'

/** Tổ tiên theo nhánh cha/mẹ (không gồm chính người đó). */
export function collectAncestorIds(members: MemberRow[], personId: string): Set<string> {
  const out = new Set<string>()
  const q: string[] = []
  const m0 = byId(members, personId)
  if (m0?.father_id) q.push(m0.father_id)
  if (m0?.mother_id) q.push(m0.mother_id)
  while (q.length) {
    const id = q.shift()!
    if (out.has(id)) continue
    out.add(id)
    const m = byId(members, id)
    if (m?.father_id) q.push(m.father_id)
    if (m?.mother_id) q.push(m.mother_id)
  }
  return out
}

/** Nhãn dưới tên trên sơ đồ: ưu tiên xưng hô với người đã liên kết; tổ mốc → Lão tổ (đời N). */
export function chartSubtitleForViewer(
  viewerMemberId: string | null,
  targetId: string,
  members: MemberRow[],
  generations: Map<string, number>,
  structuralHint: string,
): string {
  if (!viewerMemberId) return structuralHint
  const target = byId(members, targetId)
  if (!target) return structuralHint
  if (target.id === viewerMemberId) return 'Bạn'

  const specific = describeKinship(viewerMemberId, target, members)
  if (specific && specific !== KINSHIP_GENERIC) return specific

  const anc = collectAncestorIds(members, viewerMemberId)
  if (anc.has(target.id)) {
    const tg = generations.get(target.id) ?? 0
    const vg = generations.get(viewerMemberId) ?? 0
    const bookGen = tg + 1
    const noParents = !target.father_id && !target.mother_id
    const vague = !specific || specific === KINSHIP_GENERIC
    if (vague && (noParents || vg - tg >= 2)) return `Lão tổ (đời ${bookGen})`
  }

  return structuralHint
}

function byId(members: MemberRow[], id: string | null): MemberRow | undefined {
  if (!id) return undefined
  return members.find((m) => m.id === id)
}

/** Xưng hô gợi ý theo vai trên cây (MVP — quan hệ máu trực hệ và vài bậc tổ cố định). */
export function describeKinship(
  viewerMemberId: string | null,
  target: MemberRow,
  members: MemberRow[],
): string | null {
  if (!viewerMemberId || viewerMemberId === target.id) return null

  const v = byId(members, viewerMemberId)
  if (!v) return null

  if (target.id === v.father_id) return 'Cha'
  if (target.id === v.mother_id) return 'Mẹ'
  if (v.spouse_id === target.id || target.spouse_id === v.id) return 'Vợ / chồng'

  const childOfViewer = members.some(
    (c) => c.id === target.id && (c.father_id === v.id || c.mother_id === v.id),
  )
  if (childOfViewer) return target.gender === 'female' ? 'Con (gái)' : target.gender === 'male' ? 'Con (trai)' : 'Con'

  const sameFather = v.father_id && v.father_id === target.father_id
  const sameMother = v.mother_id && v.mother_id === target.mother_id
  if ((sameFather || sameMother) && v.id !== target.id) {
    return 'Anh/chị/em (cùng cha hoặc cùng mẹ)'
  }

  /** Ông bà nội: cha của cha/mẹ của người xem là target */
  if (target.id === byId(members, v.father_id)?.father_id) return 'Ông nội'
  if (target.id === byId(members, v.father_id)?.mother_id) return 'Bà nội'
  if (target.id === byId(members, v.mother_id)?.father_id) return 'Ông ngoại'
  if (target.id === byId(members, v.mother_id)?.mother_id) return 'Bà ngoại'

  /** Cháu: con của con */
  const viewerChildren = members.filter((c) => c.father_id === v.id || c.mother_id === v.id)
  for (const ch of viewerChildren) {
    if (target.father_id === ch.id || target.mother_id === ch.id) {
      return target.gender === 'female' ? 'Cháu (gái)' : target.gender === 'male' ? 'Cháu (trai)' : 'Cháu'
    }
    const grandKids = members.filter((g) => g.father_id === ch.id || g.mother_id === ch.id)
    for (const g of grandKids) {
      if (target.father_id === g.id || target.mother_id === g.id) return 'Chắt'
    }
  }

  return KINSHIP_GENERIC
}
