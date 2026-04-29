import * as d3 from 'd3'
import { useCallback, useEffect, useRef } from 'react'
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { abnbTokens } from '../design/tokens'
import { chartNodeDomId } from '../lib/chartMemberUi'
import { memberInitial } from '../app/tree/treeUi'

export type ChartMember = {
  id: string
  full_name: string
  gender?: string | null
  father_id: string | null
  mother_id: string | null
  /** Cùng cặp vợ/chồng trên danh sách — dùng để kéo hai nút sát nhau trên sơ đồ */
  spouse_id?: string | null
  /** Đời trong phả (0=đời 1). Tùy chọn — ảnh hưởng hàng dọc trên cây phả hệ */
  lineage_generation?: number | null
  avatar_url?: string | null
}

type SimNode = d3.SimulationNodeDatum & {
  id: string
  label: string
  avatar_url: string | null
  is_self: boolean
}

type Props = {
  members: ChartMember[]
  className?: string
  selectedId?: string | null
  /** Node người dùng đã liên kết (highlight & avatar “bạn”) */
  selfMemberId?: string | null
  onNodeClick?: (id: string) => void
}

export function FamilyTreeChart({ members, className, selectedId, selfMemberId, onNodeClick }: Props) {
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

    const width = Math.max(wrap.clientWidth, 280)
    const height = Math.min(680, Math.max(360, 120 + members.length * 62))

    const svg = d3.select(svgEl)
    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)
    svg.selectAll('*').remove()

    const zoomLayer = svg.append('g').attr('class', 'force-zoom-layer')
    const g = zoomLayer.append('g')

    const selfId = selfMemberId ?? null
    const nodes: SimNode[] = members.map((m) => ({
      id: m.id,
      label: m.full_name,
      avatar_url: m.avatar_url?.trim() || null,
      is_self: Boolean(selfId && m.id === selfId),
    }))

    const idSet = new Set(members.map((m) => m.id))
    const seen = new Set<string>()
    const linkPairs: { source: string; target: string }[] = []
    for (const m of members) {
      if (m.father_id && idSet.has(m.father_id)) {
        const k = `${m.father_id}\n${m.id}`
        if (!seen.has(k)) {
          seen.add(k)
          linkPairs.push({ source: m.father_id, target: m.id })
        }
      }
      if (m.mother_id && idSet.has(m.mother_id)) {
        const k = `${m.mother_id}\n${m.id}`
        if (!seen.has(k)) {
          seen.add(k)
          linkPairs.push({ source: m.mother_id, target: m.id })
        }
      }
    }

    const links = linkPairs.map((l) => ({
      source: l.source,
      target: l.target,
    })) as d3.SimulationLinkDatum<SimNode>[]

    const defs = svg.append('defs')
    nodes.forEach((d) => {
      const cid = chartNodeDomId(d.id, 'fclip')
      defs.append('clipPath').attr('id', cid).append('circle').attr('cx', 0).attr('cy', 0).attr('r', 28)
    })

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>(links)
          .id((d) => d.id)
          .distance(92)
          .strength(0.5),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-340))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius(54))

    const stroke = abnbTokens.hairline
    const strokeSel = abnbTokens.primary

    const linkSel = g
      .append('g')
      .attr('stroke', stroke)
      .attr('stroke-opacity', 0.78)
      .attr('stroke-width', 1.2)
      .selectAll<SVGLineElement, (typeof links)[0]>('line')
      .data(links)
      .join('line')

    const svgNode = svgEl as SVGSVGElement

    const worldFromEvent = (event: d3.D3DragEvent<SVGGElement, SimNode, unknown>) => {
      const [px, py] = d3.pointer(event, svgNode)
      const t = d3.zoomTransform(svgNode)
      return t.invert([px, py])
    }

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        event.sourceEvent?.stopPropagation()
        if (!event.active) simulation.alphaTarget(0.35).restart()
        const [wx, wy] = worldFromEvent(event)
        d.fx = wx
        d.fy = wy
      })
      .on('drag', (event, d) => {
        event.sourceEvent?.stopPropagation()
        const [wx, wy] = worldFromEvent(event)
        d.fx = wx
        d.fy = wy
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    const nodeSel = g
      .append('g')
      .attr('class', 'force-nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'grab')
      .call(drag)
      .on('click', (e, d) => {
        e.stopPropagation()
        onNodeClick?.(d.id)
      })

    const avatarR = 28

    nodeSel.each(function (d) {
      const el = d3.select(this)
      if (d.is_self) {
        el.append('circle')
          .attr('r', avatarR + 5)
          .attr('fill', 'none')
          .attr('stroke', abnbTokens.primary)
          .attr('stroke-width', 2)
          .attr('opacity', 0.9)
      }
      const fillBg = d.is_self ? `${abnbTokens.primary}12` : abnbTokens.canvas
      const strokeMain = d.is_self ? abnbTokens.primary : stroke
      const sw = d.is_self ? 2 : 1.35
      el.append('circle')
        .attr('class', 'force-node-bg')
        .attr('r', avatarR)
        .attr('fill', fillBg)
        .attr('stroke', strokeMain)
        .attr('stroke-width', sw)
        .attr('filter', 'drop-shadow(0 2px 8px rgb(0 0 0 / 0.09))')

      if (d.avatar_url) {
        el.append('image')
          .attr('href', d.avatar_url)
          .attr('x', -avatarR)
          .attr('y', -avatarR)
          .attr('width', avatarR * 2)
          .attr('height', avatarR * 2)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .attr('clip-path', `url(#${chartNodeDomId(d.id, 'fclip')})`)
      } else {
        el.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', 15)
          .attr('font-weight', '700')
          .attr('fill', strokeSel)
          .text(memberInitial(d.label))
      }

      el.append('text')
        .attr('y', avatarR + 14)
        .attr('text-anchor', 'middle')
        .attr('font-size', 10.5)
        .attr('font-weight', '600')
        .attr('fill', abnbTokens.ink)
        .text(d.label.length > 16 ? `${d.label.slice(0, 14)}…` : d.label)

      if (d.is_self) {
        el.append('text')
          .attr('y', avatarR + 28)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9)
          .attr('font-weight', '700')
          .attr('fill', strokeSel)
          .text('Bạn')
      }
    })

    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0)

      nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
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
      simulation.stop()
      svg.on('.zoom', null)
      zoomRef.current = null
    }
  }, [members, selfMemberId, onNodeClick])

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || members.length === 0) return
    const inner = d3.select(svgEl).select<SVGGElement>('g.force-zoom-layer > g')
    if (inner.empty()) return

    const stroke = abnbTokens.hairline
    const strokeSel = abnbTokens.primary

    inner
      .select('g.force-nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .select<SVGCircleElement>('circle.force-node-bg')
      .attr('fill', (d) => {
        if (d.id === selectedId) return `${abnbTokens.primary}20`
        if (d.is_self) return `${abnbTokens.primary}12`
        return abnbTokens.canvas
      })
      .attr('stroke', (d) => {
        if (d.id === selectedId) return strokeSel
        if (d.is_self) return abnbTokens.primary
        return stroke
      })
      .attr('stroke-width', (d) => {
        if (d.id === selectedId) return 2.4
        if (d.is_self) return 2
        return 1.35
      })
  }, [selectedId, members])

  const shellPad = 'box-border px-4 pt-4 pb-3 sm:px-5 sm:pt-5'

  if (members.length === 0) {
    return (
      <div className={`${shellPad} ${className ?? ''}`}>
        <p className="text-sm text-abnb-muted">Thêm người để xem sơ đồ quan hệ.</p>
      </div>
    )
  }

  return (
    <div className={`${shellPad} ${className ?? ''}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[12px] text-abnb-muted">
          Kéo từng người để bố trí; cuộn để phóng; kéo nền để xem vùng khác.
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
      <div className="overflow-hidden rounded-abnb-lg border border-abnb-hairlineSoft bg-gradient-to-b from-abnb-canvas to-abnb-surfaceSoft/25 shadow-abnb-inner">
        <div ref={wrapRef} className="w-full">
          <svg ref={svgRef} className="w-full max-w-full touch-none" role="img" aria-label="Sơ đồ lực cha mẹ và con" />
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-abnb-muted">
        Mỗi đường nối là quan hệ cha hoặc mẹ → con. Bố trí lực có thể chồng khi có nhiều cạnh; hãy kéo nút để tách
        rõ.
      </p>
    </div>
  )
}
