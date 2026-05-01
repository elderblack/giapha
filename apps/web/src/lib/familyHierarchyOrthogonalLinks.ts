/**
 * Orthogonal + bus nhánh cha–con; gộp cạnh của cặp có spouse_id trong chart.
 * Giữ khớp với logic trong apps/mobile/lib/tree/hierarchyChartLayout.ts
 */
import type * as d3 from 'd3'

export const ROOT_ID = '__tree_root__'

type ParentEdge = 'father' | 'mother' | 'root' | 'spouse_inline'

export type StratRowForHierarchy = {
  id: string
  parentId: string | null
  name: string
  avatar_url: string | null
  is_self: boolean
  parent_edge: ParentEdge
}

export type MarriageSeg = {
  x1: number
  x2: number
  y: number
  aId: string
  bId: string
}

/** Bước khe giữa các đoạn dọc (mobile + web đồng bộ). */
const linkGapFn = (nodeH: number) => Math.max(2, Math.round(nodeH * 0.06))

const xfFmt = (n: number): string => n.toFixed(2)

export function orthogonalLinkPathBetweenCenters(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  nodeH: number,
  opts?: { stemFromInvisibleRoot?: boolean; attach?: 'marriageJunction' },
): string {
  const xf = xfFmt

  const half = nodeH / 2

  if (opts?.stemFromInvisibleRoot) {
    const lip = Math.max(2, Math.round(nodeH * 0.05))
    const drop = Math.max(28, Math.round(nodeH * 0.95))
    const yAttach = ty - half - lip
    let y0 = ty - half - drop
    y0 = Math.max(6, Math.min(y0, yAttach - 18))
    return `M ${xf(tx)},${xf(y0)} L ${xf(tx)},${xf(yAttach)}`
  }

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

function outboundStemX(
  parent: d3.HierarchyPointNode<StratRowForHierarchy>,
  junctionByMember: Map<string, { xm: number; y: number }>,
): number {
  return junctionByMember.get(parent.data.id)?.xm ?? parent.x
}

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
    return childXsSorted.map((tx) => orthogonalLinkPathBetweenCenters(sx, sy, tx, childYCommon, nodeH))
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

function uniqLinksByTargetId(
  links: d3.HierarchyPointLink<StratRowForHierarchy>[],
): d3.HierarchyPointLink<StratRowForHierarchy>[] {
  const seen = new Set<string>()
  const out: d3.HierarchyPointLink<StratRowForHierarchy>[] = []
  for (const lk of links) {
    const t = lk.target as d3.HierarchyPointNode<StratRowForHierarchy>
    if (seen.has(t.data.id)) continue
    seen.add(t.data.id)
    out.push(lk)
  }
  return out
}

function mergeSpousePartnerLinkBuckets(
  byParentId: Map<string, d3.HierarchyPointLink<StratRowForHierarchy>[]>,
  members: { id: string; spouse_id?: string | null }[],
): Map<string, d3.HierarchyPointLink<StratRowForHierarchy>[]> {
  const memberById = new Map(members.map((m) => [m.id, m]))
  const absorbed = new Set<string>()
  const out = new Map<string, d3.HierarchyPointLink<StratRowForHierarchy>[]>()

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
        const ta = a.target as d3.HierarchyPointNode<StratRowForHierarchy>
        const tb = b.target as d3.HierarchyPointNode<StratRowForHierarchy>
        return ta.x - tb.x
      })
      if (merged.length > 0) out.set(canon, merged)
      continue
    }

    if (selfBucket.length > 0) out.set(pid, selfBucket)
  }

  /** Cùng một cặp vợ–chồng không được giữ hai key (solo + canon) — chỉ giữ ô id nhỏ hơn. */
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

  return out
}

/**
 * Junction từ thanh đôi + fallback khi thanh không vẽ (ô quá gần) để neo bus vẫn nằm giữ cặp.
 */
export function buildSpouseStemJunctionMap(
  marriages: MarriageSeg[],
  members: Readonly<{ id: string; spouse_id?: string | null }[]>,
  layoutRoot: d3.HierarchyPointNode<StratRowForHierarchy>,
  genMap: Map<string, number>,
  nodeW: number,
  nodeH: number,
): Map<string, { xm: number; y: number }> {
  const junctionByMember = new Map<string, { xm: number; y: number }>()
  for (const mr of marriages) {
    const xm = (mr.x1 + mr.x2) / 2
    junctionByMember.set(mr.aId, { xm, y: mr.y })
    junctionByMember.set(mr.bId, { xm, y: mr.y })
  }

  const pos = new Map<string, d3.HierarchyPointNode<StratRowForHierarchy>>()
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
    const pair = [m.id, sid] as const
    for (const id of pair) {
      if (!junctionByMember.has(id)) junctionByMember.set(id, { xm, y: jy })
    }
  }

  return junctionByMember
}

export function buildHierarchyOrthogonalLinkPaths(opts: {
  layoutRoot: d3.HierarchyPointNode<StratRowForHierarchy>
  genMap: Map<string, number>
  membersForSpouseEdges: readonly { id: string; spouse_id?: string | null }[]
  nodeW: number
  nodeH: number
  marriagesWithIds: MarriageSeg[]
}): string[] {
  const { layoutRoot, genMap, membersForSpouseEdges, nodeW, nodeH } = opts
  const marriages = opts.marriagesWithIds

  const junctionByMember = buildSpouseStemJunctionMap(
    marriages,
    membersForSpouseEdges,
    layoutRoot,
    genMap,
    nodeW,
    nodeH,
  )

  const rawLinks = layoutRoot.links().filter((l) => {
    const t = l.target as d3.HierarchyPointNode<StratRowForHierarchy>
    return t.data.parent_edge !== 'spouse_inline'
  })

  const linksByNonRootParent = new Map<string, d3.HierarchyPointLink<StratRowForHierarchy>[]>()
  for (const link of rawLinks) {
    const s = link.source as d3.HierarchyPointNode<StratRowForHierarchy>
    if (s.data.id === ROOT_ID) continue
    const pid = s.data.id
    const bucket = linksByNonRootParent.get(pid) ?? []
    bucket.push(link)
    linksByNonRootParent.set(pid, bucket)
  }

  const mergedByCanon = mergeSpousePartnerLinkBuckets(linksByNonRootParent, [...membersForSpouseEdges])

  const parentOutCountsMerged = new Map<string, number>()
  for (const [cid, arr] of mergedByCanon) parentOutCountsMerged.set(cid, arr.length)

  const linkPaths: string[] = []

  for (const link of rawLinks) {
    const s = link.source as d3.HierarchyPointNode<StratRowForHierarchy>
    if (s.data.id !== ROOT_ID) continue
    const t = link.target as d3.HierarchyPointNode<StratRowForHierarchy>
    linkPaths.push(orthogonalLinkPathBetweenCenters(t.x, t.y, t.x, t.y, nodeH, { stemFromInvisibleRoot: true }))
  }

  const rowTol = nodeH * 0.72
  const genGapMin = nodeH * 1.08

  for (const [canonId, plinks] of mergedByCanon) {
    const repLink =
      plinks.find((l) => ((l.source as d3.HierarchyPointNode<StratRowForHierarchy>).data.id === canonId)) ?? plinks[0]
    const sNode = repLink.source as d3.HierarchyPointNode<StratRowForHierarchy>
    const targetsUnsorted = plinks.map((l) => l.target as d3.HierarchyPointNode<StratRowForHierarchy>)
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

  return linkPaths
}