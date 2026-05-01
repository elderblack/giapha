import * as d3 from 'd3'
import { useCallback, useEffect, useRef } from 'react'
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { abnbTokens } from '../design/tokens'
import { chartNodeDomId } from '../lib/chartMemberUi'
import type { MemberRow } from '../app/tree/treeTypes'
import { chartSubtitleForViewer } from '../lib/kinshipVi'
import { computeMemberGenerations } from '../lib/familyTreeGenerations'
import { memberInitial } from '../app/tree/treeUi'
import type { ChartMember } from './FamilyTreeChart'
import {
  ROOT_ID,
  buildHierarchyOrthogonalLinkPaths,
  type StratRowForHierarchy,
  type MarriageSeg,
} from '../lib/familyHierarchyOrthogonalLinks'

/** root = đầu nhánh; spouse_inline = vào cùng thế hệ với vợ/chồng (không vẽ cạnh ↑ cha/mẹ) */
type StratRow = StratRowForHierarchy

function buildStratRows(members: ChartMember[], selfMemberId: string | null | undefined): StratRow[] {
  const idSet = new Set(members.map((m) => m.id))
  const memberById = new Map(members.map((m) => [m.id, m]))
  const primaryParent = (
    m: ChartMember,
  ): { id: string | null; edge: StratRowForHierarchy['parent_edge'] } => {
    if (m.father_id && idSet.has(m.father_id)) return { id: m.father_id, edge: 'father' }
    if (m.mother_id && idSet.has(m.mother_id)) return { id: m.mother_id, edge: 'mother' }
    return { id: null, edge: 'root' }
  }
  const selfId = selfMemberId ?? null

  const resolveParent = (m: ChartMember): { parentId: string; parent_edge: StratRowForHierarchy['parent_edge'] } => {
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
        avatar_url: m.avatar_url?.trim() || null,
        is_self: Boolean(selfId && m.id === selfId),
        parent_edge: r.parent_edge,
      }
    }),
  ]
}

function chartRowsForKinship(members: ChartMember[]): MemberRow[] {
  return members.map((m) => ({
    id: m.id,
    family_tree_id: '',
    full_name: m.full_name,
    gender: m.gender ?? null,
    birth_date: null,
    death_date: null,
    notes: null,
    father_id: m.father_id,
    mother_id: m.mother_id,
    lineage_generation: m.lineage_generation ?? null,
    spouse_id: m.spouse_id ?? null,
    linked_profile_id: null,
  }))
}

function edgeHint(edge: StratRowForHierarchy['parent_edge']): string {
  if (edge === 'father') return '↑ Cha'
  if (edge === 'mother') return '↑ Mẹ'
  if (edge === 'spouse_inline') return 'Vợ/chồng'
  return 'Đầu nhánh'
}

function shiftSubtree(node: d3.HierarchyPointNode<StratRow>, dx: number) {
  for (const d of node.descendants()) {
    d.x += dx
  }
}

function assignYByGeneration(
  layoutRoot: d3.HierarchyPointNode<StratRow>,
  genMap: Map<string, number>,
  innerH: number,
) {
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

/** Vợ chồng (cùng spouse_id) được kéo sát nhau; gom theo thế hệ hiệu dụng (không theo depth D3) */
function packSpousePairsByGeneration(
  layoutRoot: d3.HierarchyPointNode<StratRow>,
  members: ChartMember[],
  genMap: Map<string, number>,
  innerW: number,
  nodeW: number,
  pairGap: number,
  siblingGap: number,
) {
  const memberById = new Map(members.map((m) => [m.id, m]))
  const byGen = new Map<number, d3.HierarchyPointNode<StratRow>[]>()
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
    type Unit = { nodes: d3.HierarchyPointNode<StratRow>[] }
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

function collectMarriageSegments(
  layoutRoot: d3.HierarchyPointNode<StratRow>,
  members: ChartMember[],
  genMap: Map<string, number>,
  nodeW: number,
  nodeH: number,
): MarriageSeg[] {
  const seen = new Set<string>()
  const out: MarriageSeg[] = []
  const pos = new Map<string, d3.HierarchyPointNode<StratRow>>()
  const half = nodeH / 2
  const gapSeg = Math.max(5, Math.round(nodeH * 0.06))
  const pad = 1.75
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
    const y = Math.min(leftN.y, rightN.y) - half - gapSeg
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

function expandInnerWidthForPackedNodes(
  layoutRoot: d3.HierarchyPointNode<StratRow>,
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

type Props = {
  members: ChartMember[]
  className?: string
  selectedId?: string | null
  selfMemberId?: string | null
  onNodeClick?: (id: string) => void
}

export function FamilyTreeHierarchyChart({
  members,
  className,
  selectedId,
  selfMemberId,
  onNodeClick,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const resetZoom = useCallback(() => {
    const svgEl = svgRef.current
    if (!svgEl || !zoomRef.current) return
    d3.select(svgEl).transition().duration(200).call(zoomRef.current.transform, d3.zoomIdentity)
  }, [])

  const zoomBy = useCallback((factor: number) => {
    const svgEl = svgRef.current
    if (!svgEl || !zoomRef.current) return
    d3.select(svgEl).transition().duration(150).call(zoomRef.current.scaleBy, factor)
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    const svgEl = svgRef.current
    if (!wrap || !svgEl || members.length === 0) return

    const width = Math.max(wrap.clientWidth, 320)
    const margin = { top: 24, right: 36, bottom: 28, left: 36 }
    const innerWViewport = width - margin.left - margin.right
    const innerH = Math.min(960, Math.max(400, 72 + members.length * 86))

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    const stratRows = buildStratRows(members, selfMemberId ?? null)

    let hierarchyRoot: d3.HierarchyNode<StratRow>
    try {
      hierarchyRoot = d3
        .stratify<StratRow>()
        .id((d) => d.id)
        .parentId((d) => d.parentId)(stratRows)
    } catch {
      svg
        .append('text')
        .attr('x', 12)
        .attr('y', 28)
        .attr('fill', abnbTokens.muted)
        .attr('font-size', 12)
        .text('Không dựng được cây (có thể có vòng quan hệ cha/mẹ).')
      return undefined
    }

    const zoomLayer = svg.append('g').attr('class', 'tree-zoom-layer')
    const g = zoomLayer.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const treeLayout = d3.tree<StratRow>().size([innerWViewport, innerH])
    const layoutRoot = treeLayout(hierarchyRoot)

    const genMap = computeMemberGenerations(members)
    const kinshipRows = chartRowsForKinship(members)
    assignYByGeneration(layoutRoot, genMap, innerH)

    const nodeW = 182
    const nodeH = 54
    const pairGap = 14
    const siblingGap = 36
    packSpousePairsByGeneration(layoutRoot, members, genMap, innerWViewport, nodeW, pairGap, siblingGap)
    const innerW = expandInnerWidthForPackedNodes(layoutRoot, innerWViewport, nodeW, siblingGap)
    const svgTotalW = margin.left + innerW + margin.right
    svg.attr('width', svgTotalW).attr('height', innerH + margin.top + margin.bottom).attr('viewBox', `0 0 ${svgTotalW} ${innerH + margin.top + margin.bottom}`)

    const marriages = collectMarriageSegments(layoutRoot, members, genMap, nodeW, nodeH)

    const stroke = abnbTokens.hairline
    const strokeSel = abnbTokens.primary

    const linkPaths = buildHierarchyOrthogonalLinkPaths({
      layoutRoot: layoutRoot as d3.HierarchyPointNode<StratRowForHierarchy>,
      genMap,
      membersForSpouseEdges: members,
      nodeW,
      nodeH,
      marriagesWithIds: marriages,
    })

    g.append('g')
      .attr('fill', 'none')
      .attr('stroke', stroke)
      .attr('stroke-opacity', 0.78)
      .attr('stroke-width', 1.35)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .selectAll('path')
      .data(linkPaths)
      .join('path')
      .attr('d', (d) => d)

    g.append('g')
      .attr('fill', 'none')
      .attr('stroke', strokeSel)
      .attr('stroke-opacity', 0.42)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .selectAll('line')
      .data(marriages)
      .join('line')
      .attr('x1', (d) => d.x1)
      .attr('x2', (d) => d.x2)
      .attr('y1', (d) => d.y)
      .attr('y2', (d) => d.y)

    const nodes = layoutRoot.descendants().filter((d) => d.data.id !== ROOT_ID)

    const defs = svg.append('defs')
    for (const d of nodes) {
      const cid = chartNodeDomId(d.data.id, 'hclip')
      defs
        .append('clipPath')
        .attr('id', cid)
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 17)
    }

    const rx = 14
    const avatarR = 17
    const pad = 9

    const nodeWrap = g.append('g').attr('class', 'tree-nodes')
    const nodeG = nodeWrap
      .selectAll<SVGGElement, d3.HierarchyPointNode<StratRow>>('g.tree-node')
      .data(nodes)
      .join('g')
      .attr('class', 'tree-node')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', onNodeClick ? 'pointer' : 'default')
      .on('click', (e, d) => {
        e.stopPropagation()
        onNodeClick?.(d.data.id)
      })

    nodeG
      .append('rect')
      .attr('class', 'tree-node-bg')
      .attr('x', -nodeW / 2)
      .attr('y', -nodeH / 2)
      .attr('width', nodeW)
      .attr('height', nodeH)
      .attr('rx', rx)
      .attr('fill', (d) => {
        if (d.data.is_self) return `${abnbTokens.primary}0c`
        return abnbTokens.canvas
      })
      .attr('stroke', (d) => {
        if (d.data.is_self) return strokeSel
        return stroke
      })
      .attr('stroke-width', (d) => {
        if (d.data.is_self) return 2.1
        return 1.2
      })
      .attr('filter', 'drop-shadow(0 3px 10px rgb(0 0 0 / 0.07))')

    const avatarX = -nodeW / 2 + pad + avatarR

    nodeG.each(function (d) {
      const grp = d3.select(this)
      const av = grp.append('g').attr('transform', `translate(${avatarX},0)`)

      if (d.data.avatar_url) {
        av.append('circle')
          .attr('r', avatarR)
          .attr('fill', abnbTokens.surfaceSoft)
          .attr('stroke', abnbTokens.hairline)
          .attr('stroke-width', 1)
        av.append('image')
          .attr('href', d.data.avatar_url)
          .attr('x', -avatarR)
          .attr('y', -avatarR)
          .attr('width', avatarR * 2)
          .attr('height', avatarR * 2)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .attr('clip-path', `url(#${chartNodeDomId(d.data.id, 'hclip')})`)
      } else {
        av.append('circle')
          .attr('r', avatarR)
          .attr('fill', `${abnbTokens.primary}18`)
          .attr('stroke', abnbTokens.hairline)
          .attr('stroke-width', 1.1)
        av.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', 13)
          .attr('font-weight', '700')
          .attr('fill', strokeSel)
          .text(memberInitial(d.data.name))
      }

      if (d.data.is_self) {
        grp
          .append('rect')
          .attr('x', nodeW / 2 - 38)
          .attr('y', -nodeH / 2 + 6)
          .attr('width', 32)
          .attr('height', 16)
          .attr('rx', 8)
          .attr('fill', `${abnbTokens.primary}20`)
          .attr('stroke', `${abnbTokens.primary}55`)
        grp
          .append('text')
          .attr('x', nodeW / 2 - 22)
          .attr('y', -nodeH / 2 + 16)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9)
          .attr('font-weight', '700')
          .attr('fill', strokeSel)
          .text('Bạn')
      }
    })

    const nameX = -nodeW / 2 + pad + avatarR * 2 + 12
    nodeG
      .append('text')
      .attr('x', nameX)
      .attr('y', -5)
      .attr('text-anchor', 'start')
      .attr('font-size', 12)
      .attr('font-weight', '600')
      .attr('fill', abnbTokens.ink)
      .text((d) => {
        const name = d.data.name
        return name.length > 18 ? `${name.slice(0, 16)}…` : name
      })

    nodeG
      .append('text')
      .attr('x', nameX)
      .attr('y', 12)
      .attr('text-anchor', 'start')
      .attr('font-size', 9.5)
      .attr('font-weight', '500')
      .attr('fill', abnbTokens.muted)
      .text((d) => {
        const hint = edgeHint(d.data.parent_edge)
        const raw = chartSubtitleForViewer(selfMemberId ?? null, d.data.id, kinshipRows, genMap, hint)
        return raw.length > 26 ? `${raw.slice(0, 24)}…` : raw
      })

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.18, 3.2])
      .filter((event) => {
        if (event.type === 'dblclick') return false
        return !event.button
      })
      .on('zoom', (event) => {
        zoomLayer.attr('transform', event.transform.toString())
      })

    zoomRef.current = zoom
    svg.call(zoom)

    return () => {
      svg.on('.zoom', null)
      zoomRef.current = null
    }
  }, [members, selfMemberId, onNodeClick])

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || members.length === 0) return
    const layer = d3.select(svgEl).select<SVGGElement>('g.tree-zoom-layer > g')
    if (layer.empty()) return
    const nodesGroup = layer.select('g.tree-nodes')
    if (nodesGroup.empty()) return

    const stroke = abnbTokens.hairline
    const strokeSel = abnbTokens.primary

    nodesGroup
      .selectAll<SVGGElement, d3.HierarchyPointNode<StratRow>>('g.tree-node')
      .select<SVGRectElement>('rect.tree-node-bg')
      .attr('fill', (d) => {
        if (d.data.id === selectedId) return `${abnbTokens.primary}16`
        if (d.data.is_self) return `${abnbTokens.primary}0c`
        return abnbTokens.canvas
      })
      .attr('stroke', (d) => {
        if (d.data.id === selectedId) return strokeSel
        if (d.data.is_self) return strokeSel
        return stroke
      })
      .attr('stroke-width', (d) => {
        if (d.data.id === selectedId) return 2.35
        if (d.data.is_self) return 2.1
        return 1.2
      })
  }, [selectedId, members])

  const shellPad = 'box-border px-4 pt-4 pb-3 sm:px-5 sm:pt-5'

  if (members.length === 0) {
    return (
      <div className={`${shellPad} ${className ?? ''}`}>
        <p className="text-sm text-abnb-muted">Thêm người để xem cây phả hệ.</p>
      </div>
    )
  }

  return (
    <div className={`${shellPad} ${className ?? ''}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[12px] text-abnb-muted">
          Cuộn để phóng; kéo nền để di chuyển. Ảnh hiện khi người đó đã liên kết tài khoản có avatar.
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => zoomBy(1.2)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-abnb-hairlineSoft bg-abnb-canvas text-abnb-ink shadow-abnb-inner hover:bg-abnb-surfaceSoft"
            aria-label="Phóng to"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(0.8)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-abnb-hairlineSoft bg-abnb-canvas text-abnb-ink shadow-abnb-inner hover:bg-abnb-surfaceSoft"
            aria-label="Thu nhỏ"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-abnb-hairlineSoft bg-abnb-canvas px-3 text-[12px] font-semibold text-abnb-ink shadow-abnb-inner hover:bg-abnb-surfaceSoft"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Vừa khung
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-abnb-lg border border-abnb-hairlineSoft bg-gradient-to-b from-abnb-canvas via-abnb-surfaceSoft/20 to-abnb-surfaceSoft/40 shadow-abnb-inner">
        <div ref={wrapRef} className="w-full">
          <svg ref={svgRef} className="w-full max-w-full touch-none" role="img" aria-label="Cây phả hệ" />
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-abnb-muted">
        <strong>Đầu nhánh</strong> = người chưa gắn cha hoặc mẹ <em>trên sơ đồ này</em> (không phải “tổ tông” theo nghĩa lịch sử). Dòng{' '}
        <span className="font-medium text-abnb-body">↑ Cha / ↑ Mẹ</span> là hướng cạnh trên cây; khi bạn đã liên kết tài khoản với một người trên cây, dòng dưới tên ưu tiên{' '}
        <strong>xưng hô với bạn</strong> (Cha, Lão tổ…). Người có bạn đời đã
        gắn cha/mẹ trên sơ đồ được xếp <strong>cùng hàng</strong> với bạn đời (nhãn <strong>Vợ/chồng</strong>), không có đường dọc giả
        tới cha/mẹ của bạn đời. <strong>Đời trong phả</strong> (tab Thành viên) tách các mốc lão tổ không cha mẹ ra đúng hàng dọc.
        Hai người có quan hệ <strong>vợ/chồng</strong> được kéo sát nhau và nối bằng đoạn ngang màu hồng nhạt.
      </p>
    </div>
  )
}
