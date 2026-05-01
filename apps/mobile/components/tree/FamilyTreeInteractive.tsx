import FontAwesome from '@expo/vector-icons/FontAwesome'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useCallback, useEffect, useMemo } from 'react'
import { Image, Platform, StyleSheet, View, Pressable as RNPressable, type LayoutRectangle } from 'react-native'
import Svg, { G, Line, Path } from 'react-native-svg'
import { Gesture, GestureDetector, GestureHandlerRootView, Pressable } from 'react-native-gesture-handler'
import Animated, { clamp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/Themed'
import { usePalette } from '@/hooks/usePalette'
import type { ChartLayoutModel, HierarchyChartNodeUi } from '@/lib/tree/hierarchyChartLayout'
import { memberInitial } from '@/lib/tree/treeUi'
import { Font } from '@/theme/typography'

const MIN_SCALE = 0.22
const MAX_SCALE = 4.2

type EdgeSvgProps = {
  svgW: number
  svgH: number
  marginLeft: number
  marginTop: number
  linkPaths: string[]
  marriages: ReadonlyArray<{ x1: number; x2: number; y: number }>
  strokeTree: string
  strokeMarriage: string
}

const TreeEdgesSvg = React.memo(function TreeEdgesSvg({
  svgW,
  svgH,
  marginLeft,
  marginTop,
  linkPaths,
  marriages,
  strokeTree,
  strokeMarriage,
}: EdgeSvgProps) {
  return (
    <Svg pointerEvents="none" width={svgW} height={svgH} style={StyleSheet.absoluteFill}>
      <G transform={`translate(${marginLeft},${marginTop})`}>
        <G>
          {linkPaths.map((d, idx) => (
            <Path
              key={`l-${idx}`}
              d={d}
              stroke={strokeTree}
              strokeWidth={Platform.OS === 'android' ? 2.05 : 2.15}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </G>
        <G opacity={0.95}>
          {marriages.map((m, idx) => (
            <Line
              key={`m-${idx}`}
              x1={m.x1}
              y1={m.y}
              x2={m.x2}
              y2={m.y}
              stroke={strokeMarriage}
              strokeWidth={2.45}
              strokeLinecap="round"
            />
          ))}
        </G>
      </G>
    </Svg>
  )
})

const NodeCard = React.memo(function NodeCard({
  node,
  nodeW,
  nodeH,
  selected,
}: {
  node: HierarchyChartNodeUi
  nodeW: number
  nodeH: number
  selected: boolean
}) {
  const p = usePalette()
  const avSize = Math.min(38, Math.floor(nodeH * 0.62))
  const isDark = p.scheme === 'dark'

  const grad =
    selected
      ? isDark
        ? ([`${p.accent}44`, `${p.surfaceElevated}EE`] as const)
        : ([`${p.accent}22`, `#FFFFFF`] as const)
      : node.is_self
        ? isDark
          ? ([`${p.accentMuted}CC`, `#1F2836`] as const)
          : ([`${p.accentMuted}AA`, `#FFFFFF`] as const)
        : isDark
          ? (['#1E2838', '#141C28'] as const)
          : (['#FFFFFF', '#FAFBFD'] as const)

  const borderC = selected ? p.accent : node.is_self ? `${p.accent}99` : p.border

  return (
    <View
      style={{
        width: nodeW,
        height: nodeH,
        borderRadius: 17,
        borderWidth: StyleSheet.hairlineWidth + (selected ? 1.2 : 0),
        borderColor: borderC,
        overflow: 'hidden',
        shadowColor: p.shadow,
        shadowOpacity: selected || node.is_self ? 0.14 : isDark ? 0.55 : 0.08,
        shadowRadius: selected ? 10 : isDark ? 12 : 7,
        shadowOffset: { width: 0, height: selected ? 4 : 3 },
        elevation: selected ? 6 : node.is_self ? 5 : 3,
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1.15, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          paddingHorizontal: 12,
        }}
      >
        {node.avatar_url ? (
          <Image source={{ uri: node.avatar_url }} style={{ width: avSize, height: avSize, borderRadius: avSize / 2 }} />
        ) : (
          <View
            style={{
              width: avSize,
              height: avSize,
              borderRadius: avSize / 2,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: `${borderC}AA`,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: p.accentMuted,
            }}
          >
            <Text style={{ fontFamily: Font.bold, fontSize: 14, color: p.accent }}>{memberInitial(node.name)}</Text>
          </View>
        )}

        <View style={{ flex: 1 }} pointerEvents="box-none">
          <Text numberOfLines={1} style={{ fontFamily: Font.bold, fontSize: 13, color: p.ink, letterSpacing: -0.25 }}>
            {node.name.length > 22 ? `${node.name.slice(0, 20)}…` : node.name}
          </Text>
          <Text numberOfLines={2} style={{ fontFamily: Font.medium, marginTop: 3, fontSize: 11, color: p.muted, lineHeight: 14.5 }}>
            {node.subtitle}
          </Text>
        </View>

        {node.is_self ? (
          <View style={{ position: 'absolute', right: 9, top: 8 }} pointerEvents="none">
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 999,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: `${p.accent}66`,
                backgroundColor: `${p.accent}2A`,
              }}
            >
              <Text style={{ fontFamily: Font.bold, fontSize: 9, color: p.accent, letterSpacing: 0.2 }}>BẠN</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
})

function focusAnchor(
  layout: Extract<ChartLayoutModel, { ok: true }>,
  focusMemberId: string | null | undefined,
): { fx: number; fy: number; hasSubject: boolean } {
  if (focusMemberId) {
    const n = layout.nodes.find((x) => x.id === focusMemberId)
    if (n) {
      return {
        fx: layout.margin.left + n.cx,
        fy: layout.margin.top + n.cy,
        hasSubject: true,
      }
    }
  }
  const selfFallback = layout.nodes.find((x) => x.is_self)
  if (selfFallback) {
    return {
      fx: layout.margin.left + selfFallback.cx,
      fy: layout.margin.top + selfFallback.cy,
      hasSubject: true,
    }
  }
  return { fx: layout.svgW / 2, fy: layout.svgH / 2, hasSubject: false }
}

function fitScaleForViewport(
  layout: Extract<ChartLayoutModel, { ok: true }>,
  box: LayoutRectangle,
  preferReadableZoom: boolean,
): number {
  /** Neo scale = góc trên–trái; chỉ thu padding khi có chủ thể để “gần đọc được” mà không scale vượt hai chiều. */
  const pad = preferReadableZoom ? 0.93 : 0.96
  const fit = Math.min((box.width * pad) / layout.svgW, (box.height * pad) / layout.svgH)
  return clamp(fit, MIN_SCALE, preferReadableZoom ? 2.65 : 2.8)
}

type Props = {
  layout: Extract<ChartLayoutModel, { ok: true }>
  containerLayout: LayoutRectangle | null
  selectedMemberId?: string | null
  onSelectMember?: (id: string | null) => void
  /** Ưu tiên căn giữa màn ô này (thường là «Bạn»). */
  focusMemberId?: string | null
  variant?: 'inline' | 'fullscreen'
  onRequestOpenFullscreen?: () => void
}

export function FamilyTreeInteractive({
  layout,
  containerLayout,
  selectedMemberId = null,
  onSelectMember,
  focusMemberId = null,
  variant = 'inline',
  onRequestOpenFullscreen,
}: Props) {
  const p = usePalette()
  const insets = useSafeAreaInsets()

  const scale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)

  const savedTx = useSharedValue(0)
  const savedTy = useSharedValue(0)

  const pinchBase = useSharedValue(1)
  const panStartTx = useSharedValue(0)
  const panStartTy = useSharedValue(0)

  useEffect(() => {
    const box = containerLayout
    if (!box || box.width < 40 || box.height < 40) return
    const anchor = focusAnchor(layout, focusMemberId)
    const s = fitScaleForViewport(layout, box, anchor.hasSubject)
    const bx = box.width / 2
    const by = box.height / 2
    const nx = bx - anchor.fx * s
    const ny = by - anchor.fy * s
    scale.value = withTiming(s)
    tx.value = withTiming(nx)
    ty.value = withTiming(ny)
    pinchBase.value = s
    savedTx.value = nx
    savedTy.value = ny
  }, [
    layout,
    layout.svgW,
    layout.svgH,
    focusMemberId,
    containerLayout?.width,
    containerLayout?.height,
    scale,
    tx,
    ty,
    pinchBase,
    savedTx,
    savedTy,
  ])

  const strokeTree = useMemo(
    () => (p.scheme === 'dark' ? 'rgba(148,163,184,0.92)' : 'rgba(71,85,105,0.38)'),
    [p.scheme],
  )
  const strokeMarriage = useMemo(() => `${p.accent}BF`, [p.accent])

  const focusState = useMemo(() => focusAnchor(layout, focusMemberId), [layout, focusMemberId])

  const pan = Gesture.Pan()
    /** Tránh chiếm chạm khi chỉ nhấp chọn ô (RN Pressable trong Pan hay mất hit). */
    .activeOffsetX([-14, 14])
    .activeOffsetY([-14, 14])
    .minDistance(4)
    .onBegin(() => {
      panStartTx.value = tx.value
      panStartTy.value = ty.value
    })
    .onUpdate((ev) => {
      tx.value = panStartTx.value + ev.translationX
      ty.value = panStartTy.value + ev.translationY
    })
    .onEnd(() => {
      savedTx.value = tx.value
      savedTy.value = ty.value
    })

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      pinchBase.value = scale.value
    })
    .onUpdate((ev) => {
      scale.value = clamp(pinchBase.value * ev.scale, MIN_SCALE, MAX_SCALE)
    })
    .onEnd(() => {
      pinchBase.value = scale.value
      savedTx.value = tx.value
      savedTy.value = ty.value
    })

  const composed = Gesture.Simultaneous(pan, pinch)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }))

  const zoomByFactor = useCallback(
    (mult: number) => {
      const cur = scale.value
      const next = clamp(cur * mult, MIN_SCALE, MAX_SCALE)
      pinchBase.value = next
      scale.value = withTiming(next)
    },
    [pinchBase, scale],
  )

  const resetFit = useCallback(() => {
    const box = containerLayout
    if (!box?.width || !layout) return
    const anchor = focusAnchor(layout, focusMemberId)
    const s = fitScaleForViewport(layout, box, anchor.hasSubject)
    const bx = box.width / 2
    const by = box.height / 2
    const nx = bx - anchor.fx * s
    const ny = by - anchor.fy * s
    scale.value = withTiming(s)
    tx.value = withTiming(nx)
    ty.value = withTiming(ny)
    pinchBase.value = s
    savedTx.value = nx
    savedTy.value = ny
  }, [containerLayout, layout, focusMemberId, pinchBase, scale, tx, ty, savedTx, savedTy])

  const { svgW, svgH, margin, nodeW, nodeH, nodes, linkPaths, marriages } = layout

  const vignetteColors = useMemo(() => {
    if (p.scheme === 'dark') return ['#0E141D', '#0B0F14', '#151C26'] as const
    return ['#EAEFF6', `${p.canvasMuted}`, '#E4EBF6'] as const
  }, [p.scheme, p.canvasMuted])

  const dockTone = useMemo(() => {
    if (p.scheme === 'dark') return 'rgba(24,31,42,0.9)'
    return 'rgba(255,255,255,0.94)'
  }, [p.scheme])

  const toolDockBottom =
    variant === 'fullscreen' ? Math.max(16, insets.bottom + 10) : Platform.OS === 'ios' ? 108 : 100

  return (
    <GestureHandlerRootView style={styles.flex1}>
      <View style={styles.relativeFill}>
        <LinearGradient colors={vignetteColors} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

        <GestureDetector gesture={composed}>
          {/* Toàn chiều vùng phả đồ: kéo/chụm hoạt động ngay trên canvas trống. */}
          <View style={styles.touchSheet} collapsable={false}>
            <Animated.View
              collapsable={false}
              pointerEvents="box-none"
              style={[
                { width: svgW, height: svgH, transformOrigin: 'top left' as const },
                styles.chartOrigin,
                animatedStyle,
              ]}
            >
              <TreeEdgesSvg
                svgW={svgW}
                svgH={svgH}
                marginLeft={margin.left}
                marginTop={margin.top}
                linkPaths={linkPaths}
                marriages={marriages}
                strokeTree={strokeTree}
                strokeMarriage={strokeMarriage}
              />

              {nodes.map((node) => {
                const lx = margin.left + node.cx
                const ly = margin.top + node.cy
                const sel = Boolean(selectedMemberId && node.id === selectedMemberId)
                return (
                  <Pressable
                    key={node.id}
                    onPress={() => onSelectMember?.(selectedMemberId === node.id ? null : node.id)}
                    style={[styles.hitNode, { left: lx - nodeW / 2, top: ly - nodeH / 2, width: nodeW, height: nodeH }]}
                  >
                    <NodeCard node={node} nodeW={nodeW} nodeH={nodeH} selected={sel} />
                  </Pressable>
                )
              })}
            </Animated.View>
          </View>
        </GestureDetector>

        <View style={[styles.overlayTools, { bottom: toolDockBottom }]} pointerEvents="box-none">
          <View style={[styles.toolDock, { backgroundColor: dockTone, borderColor: p.border }]}>
            <RNPressable style={styles.toolBtnInner} hitSlop={6} accessibilityLabel="Phóng to" onPress={() => zoomByFactor(1.18)}>
              <FontAwesome name="search-plus" size={19} color={p.accent} />
            </RNPressable>
            <View style={[styles.toolSep, { backgroundColor: `${p.border}88` }]} />
            <RNPressable style={styles.toolBtnInner} hitSlop={6} accessibilityLabel="Thu nhỏ" onPress={() => zoomByFactor(1 / 1.18)}>
              <FontAwesome name="search-minus" size={19} color={p.accent} />
            </RNPressable>
            <View style={[styles.toolSep, { backgroundColor: `${p.border}88` }]} />
            <RNPressable
              style={styles.toolBtnInner}
              hitSlop={6}
              accessibilityLabel={focusState.hasSubject ? 'Căn vào vị trí của bạn' : 'Vừa khung'}
              onPress={() => resetFit()}
            >
              <FontAwesome name={focusState.hasSubject ? 'user' : 'compress'} size={17} color={p.accent} />
            </RNPressable>
            {variant !== 'fullscreen' && onRequestOpenFullscreen ? (
              <>
                <View style={[styles.toolSep, { backgroundColor: `${p.border}88` }]} />
                <RNPressable
                  style={styles.toolBtnInner}
                  hitSlop={6}
                  accessibilityLabel="Xem phả đồ toàn màn hình"
                  onPress={onRequestOpenFullscreen}
                >
                  <FontAwesome name="expand" size={17} color={p.accent} />
                </RNPressable>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  relativeFill: { flex: 1, overflow: 'hidden' },
  touchSheet: { flex: 1 },
  chartOrigin: { position: 'absolute', left: 0, top: 0 },
  hitNode: { position: 'absolute' },
  overlayTools: {
    position: 'absolute',
    left: 12,
    zIndex: 20,
    alignItems: 'flex-start',
  },
  toolDock: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    paddingVertical: 6,
  },
  toolBtnInner: {
    width: 46,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolSep: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
  },
})
