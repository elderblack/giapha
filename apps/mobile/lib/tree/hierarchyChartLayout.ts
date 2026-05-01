/**
 * Layout phả hệ RN — tái hiện thuật toán của `FamilyTreeHierarchyChart.tsx` web (D3 chỉ là tính toán, không cần DOM).
 */
import { stratify as d3stratify, tree as d3tree, type HierarchyPointLink, type HierarchyPointNode } from 'd3-hierarchy'

import type { ChartMember } from './chartMember'
import { computeMemberGenerations } from './familyTreeGenerations'
import { chartSubtitleForViewer, rowsToKinshipMembers } from './kinshipVi'
import type { TreeMemberRow } from './treeMemberRow'

const ROOT_ID = '__tree_root__'

type ParentEdge = 'father' | 'mother' | 'root' | 'spouse_inline'

type StratRow = {
  id: string
  parentId: string | null
  name: string
  avatar_url: string | null
  is_self: boolean
  parent_edge: ParentEdge
}

export type HierarchyChartNodeUi = {
  id: string
  cx: number
  cy: number
  name: string
  subtitle: string
  avatar_url: string | null
  is_self: boolean
}

export type ChartLayoutModel =
  | { ok: false; message: string }
  | {
      ok: true
      svgW: number
      svgH: number
      margin: { top: number; left: number; right: number; bottom: number }
      nodeW: number
      nodeH: number
      nodes: HierarchyChartNodeUi[]
      /** Path trong hệ qui chiếu nội bộ (+ margin chỉ bọc trong G khi render) */
      linkPaths: string[]
      marriages: Array<{ x1: number; x2: number; y: number; aId: string; bId: string }>
    }



function buildStratRows(members: ChartMember[], selfMemberId: string | null | undefined): StratRow[] {
  const idSet = new Set(members.map((m) => m.id))
  const memberById = new Map(members.map((m) => [m.id, m]))
  const primaryParent = (m: ChartMember): { id: string | null; edge: ParentEdge } => {
    if (m.father_id && idSet.has(m.father_id)) return { id: m.father_id, edge: 'father' }
    if (m.mother_id && idSet.has(m.mother_id)) return { id: m.mother_id, edge: 'mother' }
    return { id: null, edge: 'root' }
  }
  const selfId = selfMemberId ?? null

  const resolveParent = (m: ChartMember): { parentId: string; parent_edge: ParentEdge } => {
    const p = primaryParent(m)
    if (p.id !== null) return { parentId: p.id, parent_edge: p.edge }
    const sid = m.spouse_id
    if (sid && idSet.has(sid)) {
      const sp = memberById.get(sid)
      if (sp) {
        const spP = primaryParent(sp)
        if (spP.id !== null) return { parentId: spP.id, parent_edge: 'spouse_inline' }
      }
    }
    return { parentId: ROOT_ID, parent_edge: 'root' }
  }

  return [
    { id: ROOT_ID, parentId: null, name: '', avatar_url: null, is_self: false, parent_edge: 'root' },
    ...members.map((m) => {
      const r = resolveParent(m)
      return {
        id: m.id,
        parentId: r.parentId,
        name: m.full_name,
        avatar_url: m.avatar_url?.trim() ?? null,
        is_self: Boolean(selfId && m.id === selfId),
        parent_edge: r.parent_edge,
      }
    }),
  ]
}

function edgeHint(edge: ParentEdge): string {
  if (edge === 'father') return '↑ Cha'
  if (edge === 'mother') return '↑ Mẹ'
  if (edge === 'spouse_inline') return 'Vợ/chồng'
  return 'Đầu nhánh'
}

function shiftSubtree(node: HierarchyPointNode<StratRow>, dx: number) {
  for (const d of node.descendants()) {
    d.x += dx
  }
}

function assignYByGeneration(layoutRoot: HierarchyPointNode<StratRow>, genMap: Map<string, number>, innerH: number) {
  let maxG = 0
  for (const n of layoutRoot.descendants()) {
    if (n.data.id === ROOT_ID) continue
    maxG = Math.max(maxG, genMap.get(n.data.id) ?? 0)
  }
  const rowCount = Math.max(maxG + 1, 1)
  const band = innerH / rowCount
  for (const n of layoutRoot.descendants()) {
    if (n.data.id === ROOT_ID) continue
    const g = genMap.get(n.data.id) ?? 0
    n.y = band * (g + 0.5)
  }
}

function packSpousePairsByGeneration(
  layoutRoot: HierarchyPointNode<StratRow>,
  members: ChartMember[],
  genMap: Map<string, number>,
  innerW: number,
  nodeW: number,
  pairGap: number,
  siblingGap: number,
) {
  const memberById = new Map(members.map((m) => [m.id, m]))
  const byGen = new Map<number, HierarchyPointNode<StratRow>[]>()
  for (const n of layoutRoot.descendants()) {
    if (n.data.id === ROOT_ID) continue
    const g = genMap.get(n.data.id) ?? 0
    const arr = byGen.get(g) ?? []
    arr.push(n)
    byGen.set(g, arr)
  }

  const genKeys = [...byGen.keys()].sort((a, b) => a - b)
  for (const gen of genKeys) {
    const row = byGen.get(gen)!
    const used = new Set<string>()
    type Unit = { nodes: HierarchyPointNode<StratRow>[] }
    const units: Unit[] = []
    const sorted = [...row].sort((a, b) => a.x - b.x)

    for (const n of sorted) {
      if (used.has(n.data.id)) continue
      const sp = memberById.get(n.data.id)?.spouse_id
      const partner = sp ? sorted.find((p) => p.data.id === sp) : undefined
      if (partner && !used.has(partner.data.id)) {
        const a = n.x <= partner.x ? n : partner
        const b = a === n ? partner : n
        units.push({ nodes: [a, b] })
        used.add(a.data.id)
        used.add(b.data.id)
      } else {
        units.push({ nodes: [n] })
        used.add(n.data.id)
      }
    }
    units.sort((u, v) => u.nodes[0].x - v.nodes[0].x)

    let left = 0
    const half = nodeW / 2
    for (const u of units) {
      if (u.nodes.length === 1) {
        const n = u.nodes[0]
        shiftSubtree(n, left + half - n.x)
        left += nodeW + siblingGap
      } else {
        const [a, b] = u.nodes
        const newAx = left + half
        const newBx = left + nodeW + pairGap + half
        shiftSubtree(a, newAx - a.x)
        shiftSubtree(b, newBx - b.x)
        left += 2 * nodeW + pairGap + siblingGap
      }
    }

    const rowMin = Math.min(...row.map((n) => n.x - half))
    const rowMax = Math.max(...row.map((n) => n.x + half))
    const span = rowMax - rowMin
    const delta = (innerW - span) / 2 - rowMin
    if (Math.abs(delta) > 0.25) {
      for (const n of row) {
        shiftSubtree(n, delta)
      }
    }
  }
}

/**
 * Khi một hàng (nhiều anh/em) rộng hơn `innerW` viewport, bước căn giữa trong pack làm `.x`
 * tràn ngoài [0, innerW]; `Svg` chỉ có `width = viewport` nên bus bị crop — chỉ thấy nối vài ô giữa.
 * Mở rộng không gian nội và dịch ngang để mép ô + đường nằm trong bbox.
 */
function expandInnerWidthForPackedNodes(
  layoutRoot: HierarchyPointNode<StratRow>,
  innerWViewport: number,
  nodeW: number,
  siblingGap: number,
): number {
  const half = nodeW / 2
  let minBx = Infinity
  let maxBx = -Infinity
  for (const n of layoutRoot.descendants()) {
    if (n.data.id === ROOT_ID) continue
    minBx = Math.min(minBx, n.x - half)
    maxBx = Math.max(maxBx, n.x + half)
  }
  if (!Number.isFinite(minBx) || !Number.isFinite(maxBx)) return innerWViewport

  const span = maxBx - minBx
  const gutter = Math.max(28, Math.round(siblingGap * 1.5))
  const innerUsed = Math.max(innerWViewport, Math.ceil(span + gutter * 2))
  const ox = (innerUsed - span) / 2 - minBx

  if (Math.abs(ox) >= 1e-4) {
    for (const n of layoutRoot.descendants()) {
      n.x += ox
    }
  }
  return innerUsed
}

/** Bước khe nối từ mép đáy thẻ / mép marriage — đồng bộ orthogonal + marriage + bus */
const linkGapFn = (nodeH: number) => Math.max(2, Math.round(nodeH * 0.06))

function xfFmt(n: number): string {
  return n.toFixed(2)
}

/** Cạnh cha–con orthogonal; `stemFromInvisibleRoot` vẽ cọc đứng từ ROOT ảo xuống đầu nhánh (khớp chỗ ô trên cùng bị «lơ lửng» khi đời 0 không có đường lên cha). */
export function orthogonalLinkPathBetweenCenters(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  nodeH: number,
  opts?: { stemFromInvisibleRoot?: boolean; attach?: 'marriageJunction' },
): string {
  const xf = (n: number) => n.toFixed(2)
  const half = nodeH / 2

  /** Cọc ROOT → chỉ lên ô đầu hàng đời (đồng nhất nhiều đầu nhánh). */
  if (opts?.stemFromInvisibleRoot) {
    const lip = Math.max(2, Math.round(nodeH * 0.05))
    const drop = Math.max(28, Math.round(nodeH * 0.95))
    const yAttach = ty - half - lip
    let y0 = ty - half - drop
    y0 = Math.max(6, Math.min(y0, yAttach - 18))
    return `M ${xf(tx)},${xf(y0)} L ${xf(tx)},${xf(yAttach)}`
  }

  /** Kết thúc tại mép trong đường hôn phối (điểm trên đoạn ngang vợ–chồng), để nhánh dọc từ ông bà nối mịn vào thanh vợ–chồng. */
  if (opts?.attach === 'marriageJunction') {
    const gap = linkGapFn(nodeH)
    const yExit = sy + half + gap
    const yMeet = ty
    if (yExit >= yMeet - 0.001) return `M ${xf(sx)},${xf(sy + half)} L ${xf(tx)},${xf(yMeet)}`
    const midY = yExit + (yMeet - yExit) / 2
    if (Math.abs(sx - tx) < 0.75) return `M ${xf(sx)},${xf(yExit)} L ${xf(sx)},${xf(yMeet)}`
    return `M ${xf(sx)},${xf(yExit)} L ${xf(sx)},${xf(midY)} L ${xf(tx)},${xf(midY)} L ${xf(tx)},${xf(yMeet)}`
  }

  const gap = linkGapFn(nodeH)
  const yExit = sy + half + gap
  const yEnter = ty - half - gap
  if (yExit >= yEnter - 0.001) return `M ${xf(sx)},${xf(sy + half)} L ${xf(tx)},${xf(ty - half)}`
  const midY = yExit + (yEnter - yExit) / 2
  if (Math.abs(sx - tx) < 0.75) return `M ${xf(sx)},${xf(yExit)} L ${xf(sx)},${xf(yEnter)}`
  return `M ${xf(sx)},${xf(yExit)} L ${xf(sx)},${xf(midY)} L ${xf(tx)},${xf(midY)} L ${xf(tx)},${xf(yEnter)}`
}

/** Neo dọc từ cặp vợ–chồng (điểm giữa) khi ô cha trong chart có spouse. */
function outboundStemX(parent: HierarchyPointNode<StratRow>, junctionByMember: Map<string, { xm: number; y: number }>): number {
  return junctionByMember.get(parent.data.id)?.xm ?? parent.x
}

/**
 * Trụ xuống + bus ngang + cọc vào đỉnh ô từng con (cùng đời).
 */
function busPathsParentToChildren(
  sx: number,
  sy: number,
  childXsSorted: readonly number[],
  childYCommon: number,
  nodeH: number,
): string[] {
  if (childXsSorted.length === 0) return []
  const half = nodeH / 2
  const gap = linkGapFn(nodeH)
  const yExit = sy + half + gap
  const yEnter = childYCommon - half - gap
  const xf = xfFmt
  if (yExit >= yEnter - 0.001) {
    return childXsSorted.map((tx) =>
      orthogonalLinkPathBetweenCenters(sx, sy, tx, childYCommon, nodeH),
    )
  }
  const busY = yExit + (yEnter - yExit) * 0.48
  const minCx = childXsSorted[0]!
  const maxCx = childXsSorted[childXsSorted.length - 1]!
  const xhLo = Math.min(sx, minCx)
  const xhHi = Math.max(sx, maxCx)
  const paths: string[] = []
  paths.push(`M ${xf(sx)},${xf(yExit)} L ${xf(sx)},${xf(busY)} L ${xf(xhLo)},${xf(busY)} L ${xf(xhHi)},${xf(busY)}`)
  for (const cx of childXsSorted) {
    paths.push(`M ${xf(cx)},${xf(busY)} L ${xf(cx)},${xf(yEnter)}`)
  }
  return paths
}

/**
 * Trên stratify có con chỉ có `mother_id`/cha khác không lên được thẻ, và con chỉ có `father_id`/mẹ.
 * Gộp hai nhóm cạnh của cặp có `spouse_id` lấy từ dữ liệu — một bus chung neo tại giữa thanh đôi.
 */
function uniqLinksByTargetId(links: HierarchyPointLink<StratRow>[]): HierarchyPointLink<StratRow>[] {
  const seen = new Set<string>()
  const out: HierarchyPointLink<StratRow>[] = []
  for (const lk of links) {
    const t = lk.target as HierarchyPointNode<StratRow>
    if (seen.has(t.data.id)) continue
    seen.add(t.data.id)
    out.push(lk)
  }
  return out
}

function mergeSpousePartnerLinkBuckets(
  byParentId: Map<string, HierarchyPointLink<StratRow>[]>,
  members: ChartMember[],
): Map<string, HierarchyPointLink<StratRow>[]> {
  const memberById = new Map(members.map((m) => [m.id, m]))
  const absorbed = new Set<string>()
  const out = new Map<string, HierarchyPointLink<StratRow>[]>()

  const candidates = new Set<string>(byParentId.keys())
  for (const id of [...candidates]) {
    const sp = memberById.get(id)?.spouse_id
    if (sp && memberById.has(sp)) candidates.add(sp)
  }

  for (const pid of [...candidates].sort()) {
    if (absorbed.has(pid)) continue
    const sid = memberById.get(pid)?.spouse_id
    const selfBucket = byParentId.get(pid) ?? []
    const spouseInChart = sid != null && memberById.has(sid)
    const spouseBucket = spouseInChart && sid ? byParentId.get(sid) ?? [] : []

    if (spouseInChart && sid != null) {
      absorbed.add(pid)
      absorbed.add(sid)
      const canon = pid < sid ? pid : sid
      const merged = uniqLinksByTargetId([...selfBucket, ...spouseBucket]).sort((a, b) => {
        const ta = a.target as HierarchyPointNode<StratRow>
        const tb = b.target as HierarchyPointNode<StratRow>
        return ta.x - tb.x
      })
      if (merged.length > 0) out.set(canon, merged)
      continue
    }

    if (selfBucket.length > 0) out.set(pid, selfBucket)
  }

  /**
   * Cha/mẹ vừa có nhánh solo (processed trước) vừa có nhánh canon sau merge:
   * `canonId = lex min id` chứa hợp cả hai nhóm — xóa key thừa của nửa kia của cặp.
   */
  const dedupeStaleSpouseBuckets = (): void => {
    const seenPairs = new Set<string>()
    for (const m of members) {
      const sid = m.spouse_id
      if (!sid || !memberById.has(sid)) continue
      const lo = m.id < sid ? m.id : sid
      const hi = m.id < sid ? sid : m.id
      const pk = `${lo}\0${hi}`
      if (seenPairs.has(pk)) continue
      seenPairs.add(pk)
      if (out.has(lo) && out.has(hi)) out.delete(hi)
    }
  }
  dedupeStaleSpouseBuckets()

  return out
}

/**
 * Neo trụ đứng bus tại XM giữa cặp vợ–chồng ngay khi không vẽ được thanh hôn phối
 * hoặc chưa ghi junction — tránh chỉ neo theo tâm một ô làm ô con phía xa lệch mắt.
 */
function augmentSpouseStemJunctions(
  junctionByMember: Map<string, { xm: number; y: number }>,
  layoutRoot: HierarchyPointNode<StratRow>,
  members: ChartMember[],
  genMap: Map<string, number>,
  nodeW: number,
  nodeH: number,
) {
  const pos = new Map<string, HierarchyPointNode<StratRow>>()
  for (const n of layoutRoot.descendants()) {
    if (n.data.id !== ROOT_ID) pos.set(n.data.id, n)
  }
  const seen = new Set<string>()
  const half = nodeH / 2
  const gap = Math.max(5, Math.round(nodeH * 0.06))
  const pad = 1.75

  for (const m of members) {
    const sid = m.spouse_id
    if (!sid || seen.has(m.id)) continue
    const a = pos.get(m.id)
    const b = pos.get(sid)
    if (!a || !b) continue
    if ((genMap.get(m.id) ?? 0) !== (genMap.get(sid) ?? 0)) continue
    seen.add(m.id)
    seen.add(sid)

    let xm: number
    const leftN = a.x <= b.x ? a : b
    const rightN = a.x <= b.x ? b : a
    const ix1 = leftN.x + nodeW / 2
    const ix2 = rightN.x - nodeW / 2
    if (ix2 > ix1 + 2) xm = (ix1 - pad + ix2 + pad) / 2
    else xm = (leftN.x + rightN.x) / 2

    const jy = Math.min(leftN.y, rightN.y) - half - gap
    for (const id of [m.id, sid] as const) {
      if (!junctionByMember.has(id)) junctionByMember.set(id, { xm, y: jy })
    }
  }
}

function collectMarriageSegments(
  layoutRoot: HierarchyPointNode<StratRow>,
  members: ChartMember[],
  genMap: Map<string, number>,
  nodeW: number,
  nodeH: number,
): { x1: number; x2: number; y: number; aId: string; bId: string }[] {
  const seen = new Set<string>()
  const out: { x1: number; x2: number; y: number; aId: string; bId: string }[] = []
  const pos = new Map<string, HierarchyPointNode<StratRow>>()
  const half = nodeH / 2
  for (const n of layoutRoot.descendants()) {
    if (n.data.id !== ROOT_ID) pos.set(n.data.id, n)
  }
  for (const m of members) {
    const sid = m.spouse_id
    if (!sid || seen.has(m.id)) continue
    const a = pos.get(m.id)
    const b = pos.get(sid)
    if (!a || !b) continue
    if ((genMap.get(m.id) ?? 0) !== (genMap.get(sid) ?? 0)) continue
    seen.add(m.id)
    seen.add(sid)
    const leftN = a.x <= b.x ? a : b
    const rightN = a.x <= b.x ? b : a
    const x1 = leftN.x + nodeW / 2
    const x2 = rightN.x - nodeW / 2
    if (x2 <= x1 + 2) continue
    const gap = Math.max(5, Math.round(nodeH * 0.06))
    /** Thanh giữ hai ô — cùng bước «lõm mép trong» hai thẻ, gần orthogonal hơn tránh hai lớp tách nhìn trôi */
    const y = Math.min(leftN.y, rightN.y) - half - gap
    const pad = 1.75
    out.push({
      x1: x1 - pad,
      x2: x2 + pad,
      y,
      aId: leftN.data.id,
      bId: rightN.data.id,
    })
  }
  return out
}

export function computeHierarchyLayout(
  members: ChartMember[],
  treeRowsForKinshipSrc: TreeMemberRow[],
  selfMemberId: string | null | undefined,
  viewportWidth: number,
  overrides?: Partial<{ nodeW: number; nodeH: number; pairGap: number; siblingGap: number }>,
): ChartLayoutModel {
  if (members.length === 0) {
    return { ok: false, message: 'Chưa có người trên phả đồ.' }
  }

  const genMapMembers = computeMemberGenerations(members)
  const kinFull = rowsToKinshipMembers(treeRowsForKinshipSrc)

  const margin = { top: 28, left: 32, bottom: 32, right: 32 }
  const innerWViewport = Math.max(viewportWidth - margin.left - margin.right, 280)
  let innerW = innerWViewport

  const nodeW = overrides?.nodeW ?? 164
  const nodeH = overrides?.nodeH ?? 52
  const pairGap = overrides?.pairGap ?? 14
  const siblingGap = overrides?.siblingGap ?? 34
  /** Thưa ô hơn trên điện thoại ⇒ cần dải đứng rộng hơn một chút. */
  const rowPitch = siblingGap > 38 ? 92 : 82
  const innerH = Math.min(980, Math.max(376, 72 + members.length * rowPitch))

  const stratRows = buildStratRows(members, selfMemberId)

  let layoutRoot: HierarchyPointNode<StratRow>
  try {
    const root = d3stratify<StratRow>()
      .id((d) => d.id)
      .parentId((d) => (d.parentId == null ? null : d.parentId))(stratRows)
    layoutRoot = d3tree<StratRow>().size([innerWViewport, innerH])(root)
  } catch {
    return { ok: false, message: 'Không dựng được cây (có thể có vòng quan hệ cha/mẹ).' }
  }

  assignYByGeneration(layoutRoot, genMapMembers, innerH)

  packSpousePairsByGeneration(layoutRoot, members, genMapMembers, innerWViewport, nodeW, pairGap, siblingGap)

  innerW = expandInnerWidthForPackedNodes(layoutRoot, innerWViewport, nodeW, siblingGap)

  const marriages = collectMarriageSegments(layoutRoot, members, genMapMembers, nodeW, nodeH)

  const junctionByMember = new Map<string, { xm: number; y: number }>()
  for (const mr of marriages) {
    const xm = (mr.x1 + mr.x2) / 2
    junctionByMember.set(mr.aId, { xm, y: mr.y })
    junctionByMember.set(mr.bId, { xm, y: mr.y })
  }

  augmentSpouseStemJunctions(junctionByMember, layoutRoot, members, genMapMembers, nodeW, nodeH)

  /** Giữ luôn cạnh từ ROOT ảo → đầu nhánh (`parent_edge === 'root'`). Chỉ bỏ cạnh vào nút spouse_inline. */
  const rawLinks = layoutRoot.links().filter((l) => {
    const t = l.target as HierarchyPointNode<StratRow>
    return t.data.parent_edge !== 'spouse_inline'
  })

  const linksByNonRootParent = new Map<string, HierarchyPointLink<StratRow>[]>()
  for (const link of rawLinks) {
    const s = link.source as HierarchyPointNode<StratRow>
    if (s.data.id === ROOT_ID) continue
    const pid = s.data.id
    const bucket = linksByNonRootParent.get(pid) ?? []
    bucket.push(link)
    linksByNonRootParent.set(pid, bucket)
  }

  const mergedByCanon = mergeSpousePartnerLinkBuckets(linksByNonRootParent, members)

  const parentOutCountsMerged = new Map<string, number>()
  for (const [cid, arr] of mergedByCanon) {
    parentOutCountsMerged.set(cid, arr.length)
  }

  const linkPaths: string[] = []

  for (const link of rawLinks) {
    const s = link.source as HierarchyPointNode<StratRow>
    if (s.data.id !== ROOT_ID) continue
    const t = link.target as HierarchyPointNode<StratRow>
    linkPaths.push(orthogonalLinkPathBetweenCenters(t.x, t.y, t.x, t.y, nodeH, { stemFromInvisibleRoot: true }))
  }

  const rowTol = nodeH * 0.72
  const genGapMin = nodeH * 1.08

  for (const [canonId, plinks] of mergedByCanon) {
    const repLink =
      plinks.find((l) => ((l.source as HierarchyPointNode<StratRow>).data.id === canonId)) ?? plinks[0]
    const sNode = repLink.source as HierarchyPointNode<StratRow>
    const targetsUnsorted = plinks.map((l) => l.target as HierarchyPointNode<StratRow>)
    const targets = [...targetsUnsorted].sort((a, b) => a.x - b.x)
    const sxEff = outboundStemX(sNode, junctionByMember)
    const syEff = sNode.y
    const outsFromHere = parentOutCountsMerged.get(canonId) ?? plinks.length

    if (targets.length === 1) {
      const t = targets[0]!
      const jc = junctionByMember.get(t.data.id)
      const useMJ =
        jc != null &&
        t.data.parent_edge !== 'spouse_inline' &&
        outsFromHere === 1 &&
        Math.abs(jc.y - t.y) < rowTol &&
        Math.abs(jc.y - syEff) > genGapMin
      linkPaths.push(
        orthogonalLinkPathBetweenCenters(
          sxEff,
          syEff,
          useMJ ? jc.xm : t.x,
          useMJ ? jc.y : t.y,
          nodeH,
          useMJ ? { attach: 'marriageJunction' } : undefined,
        ),
      )
      continue
    }

    const childXs = [...new Set(targets.map((tt) => tt.x))].sort((a, b) => a - b)
    const ys = [...new Set(targets.map((tt) => tt.y))]
    const childY = ys.length === 1 ? ys[0]! : Math.min(...ys)
    linkPaths.push(...busPathsParentToChildren(sxEff, syEff, childXs, childY, nodeH))
  }

  const stratNodes = layoutRoot.descendants().filter((d) => d.data.id !== ROOT_ID)
  const genMapKin = computeMemberGenerations(kinFull)

  const uiNodes: HierarchyChartNodeUi[] = stratNodes.map((d) => {
    const hint = edgeHint(d.data.parent_edge)
    const subtitle = chartSubtitleForViewer(selfMemberId ?? null, d.data.id, kinFull, genMapKin, hint)
    return {
      id: d.data.id,
      cx: d.x,
      cy: d.y,
      name: d.data.name.trim() || '?',
      subtitle,
      avatar_url: d.data.avatar_url,
      is_self: d.data.is_self,
    }
  })

  const svgW = margin.left + innerW + margin.right
  const svgH = innerH + margin.top + margin.bottom

  return {
    ok: true,
    svgW,
    svgH,
    margin,
    nodeW,
    nodeH,
    nodes: uiNodes,
    linkPaths,
    marriages,
  }
}
