import FontAwesome from '@expo/vector-icons/FontAwesome'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { FamilyTreeInteractive } from '@/components/tree/FamilyTreeInteractive'
import { TreesMembersList } from '@/components/tree/TreesMembersList'
import { TreeMemberAddModal, type MemberAddDraft } from '@/components/tree/TreeMemberAddModal'
import {
  TreeMemberEditModal,
  type MemberEditDraft,
} from '@/components/tree/TreeMemberEditModal'
import { TreeMemberPeekModal } from '@/components/tree/TreeMemberPeekModal'
import { TreesTabSkeleton } from '@/components/TreesTabSkeleton'
import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { computeHierarchyLayout } from '@/lib/tree/hierarchyChartLayout'
import { fetchTreeMembers, rowsToChartMembers, type TreeMemberRow } from '@/lib/tree/treeMemberRow'
import { getUserFamilyTreeId } from '@/lib/familyTreeMembership'
import { createFamilyTreeSpace, joinFamilyTreeInvite } from '@/lib/familyTreeOnboarding'
import { fetchTreeWorkspaceCaps, type TreeWorkspaceCaps } from '@/lib/tree/fetchTreeWorkspaceCaps'
import { claimRpcErrorVi } from '@/lib/tree/memberRpcMessages'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { Font } from '@/theme/typography'

/** Nút lớn hơn một chút, khoảng cách họ hàng rộng hơn — thích hợp touch. */
const MOBILE_TREE_LAYOUT_TUNING = { nodeW: 174, nodeH: 56, siblingGap: 44, pairGap: 22 } as const

/** Tab Dòng họ — phả đồ native (SVG + gesture), cùng dữ liệu với tài khoản. */
type TreeSegment = 'overview' | 'chart' | 'members'

type FamilyTreeMeta = {
  name: string | null
  clan_name: string | null
  origin_place: string | null
  description: string | null
}

const SEGMENTS: { id: TreeSegment; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'chart', label: 'Phả hệ' },
  { id: 'members', label: 'Thành viên' },
]

export default function TreesScreen() {
  const p = usePalette()
  const safeInsets = useSafeAreaInsets()
  const { user } = useAuth()
  const sb = getSupabase()
  const { width: windowW, height: windowH } = useWindowDimensions()
  const [treeId, setTreeId] = useState<string | null>(null)
  const [treeMeta, setTreeMeta] = useState<FamilyTreeMeta | null>(null)
  const [treeMetaLoading, setTreeMetaLoading] = useState(false)
  const [segment, setSegment] = useState<TreeSegment>('overview')
  const [busy, setBusy] = useState(true)
  const [membersErr, setMembersErr] = useState<string | null>(null)
  const [memberRows, setMemberRows] = useState<TreeMemberRow[]>([])
  const [chartArea, setChartArea] = useState<{ width: number; height: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [peekOpen, setPeekOpen] = useState(false)
  const [supportsMemberPhoneColumn, setSupportsMemberPhoneColumn] = useState(true)
  const [workspaceCaps, setWorkspaceCaps] = useState<TreeWorkspaceCaps | null>(null)
  const [editingMember, setEditingMember] = useState<TreeMemberRow | null>(null)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null)
  const [linkMsg, setLinkMsg] = useState<string | null>(null)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [treeMembershipResolved, setTreeMembershipResolved] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinBanner, setJoinBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createClan, setCreateClan] = useState('')
  const [createOrigin, setCreateOrigin] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [treeChartFsOpen, setTreeChartFsOpen] = useState(false)
  const [treeChartFsLayout, setTreeChartFsLayout] = useState<LayoutRectangle | null>(null)
  const refreshDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => {
      clearTimeout(refreshDebounceTimer.current)
    }
  }, [])

  const refreshMembers = useCallback(async () => {
    if (!sb || !treeId || !user?.id) {
      setMemberRows([])
      setBusy(false)
      return
    }
    const { rows, error, supportsMemberPhoneColumn: phoneCol } = await fetchTreeMembers(sb, treeId)
    setSupportsMemberPhoneColumn(phoneCol)
    if (error) {
      setMembersErr(error)
      setMemberRows([])
    } else {
      setMembersErr(null)
      setMemberRows(rows)
    }
    setBusy(false)
  }, [sb, treeId, user?.id])

  const scheduleRefreshMembers = useCallback(() => {
    clearTimeout(refreshDebounceTimer.current)
    refreshDebounceTimer.current = setTimeout(() => {
      void refreshMembers()
      refreshDebounceTimer.current = undefined
    }, 420)
  }, [refreshMembers])

  const loadTreeMeta = useCallback(async () => {
    if (!sb || !treeId) {
      setTreeMeta(null)
      setTreeMetaLoading(false)
      return
    }
    setTreeMetaLoading(true)
    try {
      const { data, error } = await sb
        .from('family_trees')
        .select('name,clan_name,origin_place,description')
        .eq('id', treeId)
        .maybeSingle()
      if (error || !data) setTreeMeta(null)
      else setTreeMeta(data as FamilyTreeMeta)
    } finally {
      setTreeMetaLoading(false)
    }
  }, [sb, treeId])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshMembers(), loadTreeMeta()])
  }, [refreshMembers, loadTreeMeta])

  const runPullRefresh = useCallback(async () => {
    setPullRefreshing(true)
    try {
      await refreshAll()
    } finally {
      setPullRefreshing(false)
    }
  }, [refreshAll])

  const submitJoinInvite = useCallback(async () => {
    if (!sb || !user?.id) return
    setJoinBanner(null)
    setJoinBusy(true)
    try {
      const r = await joinFamilyTreeInvite(sb, inviteCode)
      if (!r.ok) {
        setJoinBanner({ kind: 'err', text: r.message })
        return
      }
      setJoinBanner({ kind: 'ok', text: 'Đã tham gia dòng họ.' })
      setInviteCode('')
      setTreeId(r.treeId)
      setBusy(true)
    } finally {
      setJoinBusy(false)
    }
  }, [sb, user?.id, inviteCode])

  const submitCreateTree = useCallback(async () => {
    if (!sb || !user?.id) return
    const name = createName.trim()
    if (name.length < 2 || name.length > 200) {
      setCreateErr('Tên dòng họ cần 2–200 ký tự.')
      return
    }
    if (createDesc.length > 2000 || createClan.trim().length > 120 || createOrigin.trim().length > 200) {
      setCreateErr('Nội dung vượt giới hạn.')
      return
    }
    setCreateErr(null)
    setCreateBusy(true)
    try {
      const r = await createFamilyTreeSpace(sb, {
        name,
        clan_name: createClan.trim() ? createClan.trim().slice(0, 120) : null,
        origin_place: createOrigin.trim() ? createOrigin.trim().slice(0, 200) : null,
        description: createDesc.trim() ? createDesc.trim().slice(0, 2000) : null,
      })
      if (!r.ok) {
        setCreateErr(r.message)
        return
      }
      setTreeId(r.treeId)
      setBusy(true)
      setCreateOpen(false)
      setCreateName('')
      setCreateClan('')
      setCreateOrigin('')
      setCreateDesc('')
    } finally {
      setCreateBusy(false)
    }
  }, [sb, user?.id, createName, createClan, createOrigin, createDesc])

  useEffect(() => {
    if (!sb || !hasSupabaseCredentials() || !user?.id) {
      setBusy(false)
      setTreeId(null)
      setTreeMembershipResolved(false)
      return
    }
    setTreeMembershipResolved(false)
    let alive = true
    void (async () => {
      const tid = await getUserFamilyTreeId(sb, user.id)
      if (!alive) return
      setTreeId(tid)
      if (!tid) setBusy(false)
      setTreeMembershipResolved(true)
    })()
    return () => {
      alive = false
    }
  }, [sb, user?.id])

  useEffect(() => {
    if (!treeId) return
    setBusy(true)
    void refreshMembers()
  }, [treeId, refreshMembers])

  useEffect(() => {
    if (!treeId) {
      setTreeMeta(null)
      setTreeMetaLoading(false)
      return
    }
    void loadTreeMeta()
  }, [treeId, loadTreeMeta])

  useEffect(() => {
    setSegment('overview')
  }, [treeId])

  useEffect(() => {
    if (segment !== 'chart') setTreeChartFsOpen(false)
  }, [segment])

  useEffect(() => {
    if (treeChartFsOpen) setTreeChartFsLayout(null)
  }, [treeChartFsOpen])

  /** Đồng bộ realtime khi có thay đổi trong bảng thành viên. */
  useEffect(() => {
    if (!sb || !treeId) return
    const ch = sb
      .channel(`tree-members-${treeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_tree_members',
          filter: `family_tree_id=eq.${treeId}`,
        },
        () => {
          scheduleRefreshMembers()
        },
      )
      .subscribe()
    return () => {
      void sb.removeChannel(ch)
    }
  }, [sb, treeId, scheduleRefreshMembers])

  /** Quyền chủ/editor/member trong không gian này (theo RLS + RPC). */
  useEffect(() => {
    if (!sb || !treeId || !user?.id) {
      setWorkspaceCaps(null)
      return
    }
    let alive = true
    void (async () => {
      const { caps } = await fetchTreeWorkspaceCaps(sb, treeId, user.id)
      if (!alive) return
      setWorkspaceCaps(caps)
    })()
    return () => {
      alive = false
    }
  }, [sb, treeId, user?.id])

  const claimMember = useCallback(
    async (memberId: string) => {
      if (!sb) return
      setLinkMsg(null)
      setLinkBusyId(memberId)
      const { data, error } = await sb.rpc('claim_family_tree_member', { p_member_id: memberId })
      setLinkBusyId(null)
      if (error) {
        setLinkMsg(error.message)
        return
      }
      const body = data as { ok?: boolean; error?: string }
      if (!body?.ok) {
        setLinkMsg(claimRpcErrorVi(body?.error))
        return
      }
      void refreshMembers()
    },
    [sb, refreshMembers],
  )

  const unlinkMember = useCallback(
    async (memberId: string) => {
      if (!sb) return
      setLinkMsg(null)
      setLinkBusyId(memberId)
      const { data, error } = await sb.rpc('unlink_family_tree_member', { p_member_id: memberId })
      setLinkBusyId(null)
      if (error) {
        setLinkMsg(error.message)
        return
      }
      const body = data as { ok?: boolean; error?: string }
      if (!body?.ok) {
        setLinkMsg(claimRpcErrorVi(body?.error))
        return
      }
      void refreshMembers()
    },
    [sb, refreshMembers],
  )

  const submitMemberEdit = useCallback(
    async (memberId: string, draft: MemberEditDraft): Promise<string | null> => {
      if (!sb) return 'Chưa kết nối.'
      const row: Record<string, unknown> = {
        full_name: draft.full_name,
        gender: draft.gender,
        birth_date: draft.birth_date,
        death_date: draft.death_date,
        notes: draft.notes,
        father_id: draft.father_id,
        mother_id: draft.mother_id,
        lineage_generation: draft.lineage_generation,
      }
      if (supportsMemberPhoneColumn) row.phone = draft.phone
      const { error } = await sb.from('family_tree_members').update(row).eq('id', memberId)
      if (error) return error.message
      void refreshMembers()
      setEditingMember(null)
      setSelectedId(memberId)
      return null
    },
    [sb, refreshMembers, supportsMemberPhoneColumn],
  )

  const submitMemberAdd = useCallback(
    async (draft: MemberAddDraft): Promise<string | null> => {
      if (!sb || !treeId) return 'Thiếu dòng họ.'
      const payload: Record<string, unknown> = {
        family_tree_id: treeId,
        full_name: draft.full_name,
        gender: draft.gender,
        birth_date: draft.birth_date,
        death_date: draft.death_date,
        father_id: draft.father_id,
        mother_id: draft.mother_id,
        lineage_generation: draft.lineage_generation,
        notes: draft.notes,
      }
      if (supportsMemberPhoneColumn) payload.phone = draft.phone
      const { data, error } = await sb.from('family_tree_members').insert(payload).select('id').single()
      if (error) return error.message
      const nid = typeof (data as { id?: string } | null)?.id === 'string' ? (data as { id: string }).id : null
      void refreshMembers()
      if (nid) setSelectedId(nid)
      return null
    },
    [sb, treeId, refreshMembers, supportsMemberPhoneColumn],
  )

  const linkedMemberId = memberRows.find((m) => m.linked_profile_id === user?.id)?.id ?? null

  const chartMembers = useMemo(() => rowsToChartMembers(memberRows), [memberRows])

  const paddedWidth = Math.max(Math.floor((windowW - 32) / 16) * 16, 300)

  const layoutW = Math.max(chartArea?.width ?? paddedWidth, 300)

  const chartLayout = useMemo(
    () =>
      computeHierarchyLayout(chartMembers, memberRows, linkedMemberId ?? undefined, layoutW, MOBILE_TREE_LAYOUT_TUNING),
    [chartMembers, memberRows, linkedMemberId, layoutW],
  )

  const dataLoading = Boolean(treeId && busy && memberRows.length === 0 && !membersErr)
  const treeTitle = treeMeta?.name?.trim() || 'Không gian dòng họ'

  const gradientHero = useMemo(
    () => (p.scheme === 'dark' ? (['#1e1b33CC', p.canvas] as const) : (['#EEF8FF', p.canvas] as const)),
    [p.scheme, p.canvas],
  )

  const memberById = useMemo(() => new Map(memberRows.map((m) => [m.id, m])), [memberRows])

  const selectedRow = selectedId ? memberById.get(selectedId) ?? null : null

  const onSelectTreeMember = useCallback((id: string | null) => {
    setSelectedId(id)
    setPeekOpen(Boolean(id))
    setLinkMsg(null)
  }, [])

  const onClosePeek = useCallback(() => setPeekOpen(false), [])

  const onEditFromPeek = useCallback(() => {
    setPeekOpen(false)
    setLinkMsg(null)
    if (selectedRow) setEditingMember(selectedRow)
  }, [selectedRow])

  const onChartLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width <= 20 || height <= 20) return
    const bw = Math.floor(width / 16) * 16
    const bh = Math.floor(height / 16) * 16
    setChartArea((prev) => (prev?.width === bw && prev?.height === bh ? prev : { width: bw, height: bh }))
  }, [])

  if (!hasSupabaseCredentials() || !sb) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas, paddingTop: safeInsets.top }} edges={['left', 'right']}>
        <View style={[styles.center, { flex: 1 }]}>
          <FontAwesome name="plug" color={p.muted} size={44} />
          <Text style={{ marginTop: 14, fontFamily: Font.medium, color: p.muted, textAlign: 'center', paddingHorizontal: 24 }}>
            Cấu hình Supabase để xem phả đồ.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas, paddingTop: safeInsets.top }} edges={['left', 'right']}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={p.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!treeMembershipResolved) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.canvas, paddingTop: safeInsets.top }]} edges={['left', 'right']}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={p.accent} size="large" />
          <Text style={{ marginTop: 14, fontFamily: Font.medium, color: p.muted, textAlign: 'center', paddingHorizontal: 24 }}>
            Đang tải dòng họ của bạn…
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <>
      <SafeAreaView style={[styles.safe, { backgroundColor: p.canvas, paddingTop: safeInsets.top }]} edges={['left', 'right']}>
      <View style={styles.column}>
        {!treeId ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.onboardScroll}
          >
            <LinearGradient colors={gradientHero} style={[styles.hero, { borderColor: p.border }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={[styles.badge, { backgroundColor: p.accentMuted, alignSelf: 'flex-start' }]}>
                <FontAwesome name="sitemap" size={14} color={p.accent} />
                <Text style={[styles.badgeLbl, { color: p.accent, fontFamily: Font.semiBold }]}>Dòng họ</Text>
              </View>
              <Text style={[styles.heroTitle, { color: p.ink, fontFamily: Font.extraBold, marginTop: 12 }]}>Không gian dòng họ</Text>
              <Text style={[styles.heroSub, { color: p.muted, fontFamily: Font.regular }]}>
                Mỗi tài khoản chỉ có một dòng họ. Dán mã mời (UUID) từ chủ họ hoặc tạo dòng họ mới — bạn sẽ là chủ và nhận mã để mời người thân.
              </Text>
            </LinearGradient>

            <View style={[styles.onboardCard, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
              <FontAwesome name="key" size={18} color={p.accent} />
              <Text style={[styles.onboardTit, { color: p.ink, fontFamily: Font.bold }]}>Tham gia bằng mã mời</Text>
              <Text style={[styles.onboardHint, { color: p.muted, fontFamily: Font.regular }]}>
                Dán UUID chủ dòng họ gửi cho bạn.
              </Text>
              <TextInput
                value={inviteCode}
                onChangeText={(t) => {
                  setInviteCode(t)
                  setJoinBanner(null)
                }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                placeholderTextColor={p.muted}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!joinBusy}
                style={[
                  styles.onboardInput,
                  { borderColor: p.border, backgroundColor: p.canvasMuted, color: p.ink, fontFamily: Font.regular },
                ]}
              />
              <Pressable
                onPress={() => void submitJoinInvite()}
                disabled={joinBusy || !inviteCode.trim()}
                style={[
                  styles.onboardPrimaryBtn,
                  { backgroundColor: p.accent, opacity: joinBusy || !inviteCode.trim() ? 0.5 : 1 },
                ]}
              >
                {joinBusy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.onboardPrimaryTxt, { fontFamily: Font.bold }]}>Tham gia</Text>
                )}
              </Pressable>
              {joinBanner ? (
                <Text
                  style={[
                    styles.onboardMsg,
                    { fontFamily: Font.medium },
                    joinBanner.kind === 'err' ? { color: p.danger } : { color: p.success },
                  ]}
                >
                  {joinBanner.text}
                </Text>
              ) : null}
            </View>

            <Pressable
              onPress={() => {
                setCreateErr(null)
                setCreateOpen(true)
              }}
              style={[styles.onboardSecondaryBtn, { borderColor: p.accent }]}
            >
              <FontAwesome name="plus" size={18} color={p.accent} />
              <Text style={[styles.onboardSecondaryTxt, { color: p.accent, fontFamily: Font.bold }]}>Tạo dòng họ mới</Text>
            </Pressable>

            <Text style={[styles.onboardFine, { color: p.muted, fontFamily: Font.regular }]}>
              Nếu bạn đã thuộc một dòng họ trên web, đăng nhập cùng tài khoản — không cần tham gia lại.
            </Text>

            <View style={{ height: 20 }} />
          </ScrollView>
        ) : (
          <>
            <View style={styles.outerPad}>
              <LinearGradient colors={gradientHero} style={[styles.hero, { borderColor: p.border }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.heroRow}>
                  <View style={[styles.badge, { backgroundColor: p.accentMuted }]}>
                    <FontAwesome name="sitemap" size={14} color={p.accent} />
                    <Text style={[styles.badgeLbl, { color: p.accent, fontFamily: Font.semiBold }]}>Dòng họ</Text>
                  </View>
                  <Pressable onPress={() => void runPullRefresh()} hitSlop={10} accessibilityLabel="Làm mới">
                    <FontAwesome name="refresh" size={20} color={p.accent} />
                  </Pressable>
                </View>
                <Text style={[styles.heroTitle, { color: p.ink, fontFamily: Font.extraBold }]}>{treeTitle}</Text>
                {treeMetaLoading ? (
                  <ActivityIndicator color={p.accent} style={{ marginTop: 10 }} />
                ) : (
                  <Text style={[styles.heroSub, { color: p.muted, fontFamily: Font.regular }]}>
                    Tổng quan giới thiệu không gian; Phả hệ để duyệt sơ đồ; Thành viên để tìm tên và mở chi tiết.
                  </Text>
                )}
              </LinearGradient>

              <View style={[styles.segmentWrap, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1, gap: 8 }}>
                  {SEGMENTS.map((seg) => {
                    const on = segment === seg.id
                    return (
                      <Pressable
                        key={seg.id}
                        onPress={() => setSegment(seg.id)}
                        accessibilityState={{ selected: on }}
                        style={[
                          styles.segPill,
                          { borderColor: on ? `${p.accent}66` : p.border, backgroundColor: on ? p.accentMuted : 'transparent' },
                        ]}
                      >
                        <Text
                          style={{
                            fontFamily: on ? Font.semiBold : Font.medium,
                            fontSize: 14,
                            color: on ? p.accent : p.muted,
                          }}
                        >
                          {seg.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>

              {membersErr ? (
                <Text style={[styles.errBanner, { color: p.danger, fontFamily: Font.medium }]}>{membersErr}</Text>
              ) : null}
            </View>

            <View style={{ flex: 1, minHeight: 0 }}>
              {dataLoading ? (
                <TreesTabSkeleton />
              ) : segment === 'overview' ? (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.overviewScroll}
                  refreshControl={
                    <RefreshControl refreshing={pullRefreshing} onRefresh={() => void runPullRefresh()} tintColor={p.accent} />
                  }
                >
                  <Text style={[styles.intro, { color: p.muted, fontFamily: Font.regular }]}>
                    Trang nhà giữ <Text style={{ fontFamily: Font.semiBold, color: p.ink }}>bảng tin</Text>; tab này tập vào họ tên,
                    quê gốc và quan hệ thế hệ. Mọi thay đổi chỉnh trong một nơi sẽ phản hiện ở các màn khác của cùng tài khoản.
                  </Text>

                  <View style={styles.statRow}>
                    <View style={[styles.statTile, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
                      <Text style={[styles.statLabel, { color: p.muted, fontFamily: Font.medium }]}>Thành viên</Text>
                      <Text style={[styles.statValue, { color: p.ink, fontFamily: Font.semiBold }]}>{chartMembers.length}</Text>
                    </View>
                    <View style={[styles.statTile, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
                      <Text style={[styles.statLabel, { color: p.muted, fontFamily: Font.medium }]}>Quê / gốc</Text>
                      <Text style={[styles.statValue, { color: p.ink, fontFamily: Font.semiBold }]} numberOfLines={2}>
                        {treeMeta?.origin_place?.trim() || '—'}
                      </Text>
                    </View>
                    <View style={[styles.statTile, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
                      <Text style={[styles.statLabel, { color: p.muted, fontFamily: Font.medium }]}>Chi / nhánh</Text>
                      <Text style={[styles.statValue, { color: p.ink, fontFamily: Font.semiBold }]} numberOfLines={2}>
                        {treeMeta?.clan_name?.trim() || '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.storyCard, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <FontAwesome name="book" size={18} color={p.accent} />
                      <Text style={{ fontFamily: Font.semiBold, fontSize: 16, color: p.ink }}>Câu chuyện dòng họ</Text>
                    </View>
                    {treeMeta?.description?.trim() ? (
                      <Text style={{ marginTop: 12, fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: p.ink }}>
                        {treeMeta.description.trim()}
                      </Text>
                    ) : (
                      <Text style={{ marginTop: 12, fontFamily: Font.regular, fontSize: 14, lineHeight: 21, color: p.muted }}>
                        Chưa có mô tả — chủ hoặc biên tập có thể bổ sung trong phần quản trị không gian này.
                      </Text>
                    )}
                  </View>

                  <Text style={[styles.sectionKicker, { color: p.muted, fontFamily: Font.medium }]}>Tiếp theo</Text>
                  <Pressable
                    onPress={() => setSegment('chart')}
                    style={[styles.shortcut, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}
                  >
                    <FontAwesome name="share-alt" size={18} color={p.accent} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: Font.semiBold, fontSize: 16, color: p.ink }}>Xem phả hệ</Text>
                      <Text style={{ fontFamily: Font.regular, fontSize: 13, marginTop: 4, color: p.muted }}>
                        Thu phóng, kéo khung; chọn từng người để xem quan hệ và liên kết tài khoản.
                      </Text>
                    </View>
                    <FontAwesome name="chevron-right" color={p.muted} size={14} />
                  </Pressable>
                  <Pressable
                    onPress={() => setSegment('members')}
                    style={[styles.shortcut, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}
                  >
                    <FontAwesome name="users" size={18} color={p.accent} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: Font.semiBold, fontSize: 16, color: p.ink }}>Danh sách thành viên</Text>
                      <Text style={{ fontFamily: Font.regular, fontSize: 13, marginTop: 4, color: p.muted }}>
                        Tìm theo tên, mở chi tiết, chỉnh quan hệ khi được phép.
                      </Text>
                    </View>
                    <FontAwesome name="chevron-right" color={p.muted} size={14} />
                  </Pressable>
                </ScrollView>
              ) : segment === 'chart' ? (
                !membersErr && chartLayout.ok ? (
                  <View style={styles.chartColumn}>
                    <View style={[styles.outerPad, { flexShrink: 0 }]}>
                      <View style={[styles.metaBar, { backgroundColor: p.surfaceElevated, borderColor: p.border }]}>
                        <FontAwesome name="users" color={p.accent} size={18} />
                        <Text style={{ marginLeft: 10, fontFamily: Font.semiBold, color: p.ink, flex: 1 }}>
                          {chartMembers.length} người trong phạm vi được tải
                        </Text>
                      </View>
                      <Text style={[styles.help, { color: p.muted, fontFamily: Font.regular }]}>
                        {chartLayout.nodes.length <= 35
                          ? selectedId
                            ? 'Chạm lại ô đã chọn để đóng sheet và bỏ đánh dấu.'
                            : 'Chạm ô tên để xem chi tiết và đánh dấu — kéo sheet xuống hoặc chạm nền mờ để đóng.'
                          : 'Đông người: zoom out, kéo từng khu như duyệt bản đồ.'}{' '}
                        Hai ngón tay: kéo và chụm.
                      </Text>
                    </View>
                    <View style={[styles.chartFlex, { borderColor: p.border }]} onLayout={onChartLayout}>
                      <FamilyTreeInteractive
                        layout={chartLayout}
                        containerLayout={
                          chartArea
                            ? { ...chartArea, x: 0, y: 0 }
                            : { x: 0, y: 0, width: layoutW, height: 380 }
                        }
                        focusMemberId={linkedMemberId}
                        selectedMemberId={selectedId}
                        onSelectMember={onSelectTreeMember}
                        onRequestOpenFullscreen={() => setTreeChartFsOpen(true)}
                      />
                    </View>
                  </View>
                ) : !membersErr && !chartLayout.ok ? (
                  <View style={[styles.outerPad, { flex: 1 }]}>
                    <View style={[styles.emptyCard, { borderColor: p.border }]}>
                      <FontAwesome name="unlink" color={p.muted} size={28} />
                      <Text style={[styles.emptyTit, { marginTop: 10, color: p.ink, fontFamily: Font.bold }]}>Chưa dựng được sơ đồ</Text>
                      <Text style={[styles.emptyBody, { color: p.muted, fontFamily: Font.regular }]}>{chartLayout.message}</Text>
                    </View>
                  </View>
                ) : (
                  <View />
                )
              ) : !membersErr ? (
                <View style={styles.membersPane}>
                  <TreesMembersList
                    members={memberRows}
                    refreshing={pullRefreshing}
                    onRefresh={() => void runPullRefresh()}
                    linkedSelfMemberId={linkedMemberId}
                    onPressMember={(id) => {
                      setSelectedId(id)
                      setPeekOpen(true)
                      setLinkMsg(null)
                    }}
                  />
                </View>
              ) : (
                <View />
              )}
            </View>

            <View style={{ height: 8 }} />
          </>
        )}
      </View>

      {treeId &&
      !membersErr &&
      workspaceCaps?.canEditMembers &&
      (segment === 'chart' ? chartLayout.ok : segment === 'members') ? (
        <Pressable
          accessibilityLabel="Thêm thành viên"
          onPress={() => {
            setAddMemberOpen(true)
            setLinkMsg(null)
          }}
          style={[styles.fab, { backgroundColor: p.accent, bottom: 22, shadowColor: p.ink }]}
        >
          <FontAwesome name="user-plus" size={22} color="#FFFFFF" />
        </Pressable>
      ) : null}

      </SafeAreaView>

      <Modal
        visible={treeChartFsOpen && Boolean(treeId) && !membersErr && chartLayout.ok && Boolean(user?.id)}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setTreeChartFsOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas }} edges={['top', 'left', 'right', 'bottom']}>
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: Math.max(safeInsets.top, 10),
              paddingBottom: 10,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: p.border,
              backgroundColor: p.canvas,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontFamily: Font.bold, fontSize: 17, color: p.ink, flex: 1, paddingRight: 12 }} numberOfLines={1}>
                Phả đồ toàn màn hình
              </Text>
              <Pressable hitSlop={12} onPress={() => setTreeChartFsOpen(false)} accessibilityLabel="Đóng phả đồ">
                <FontAwesome name="times" size={24} color={p.muted} />
              </Pressable>
            </View>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: p.muted, lineHeight: 18 }}>
              Chạm ô để xem chi tiết. Chạm nền mờ hoặc x để đóng chi tiết. Kéo bằng một ngón, chụm bằng hai ngón.
            </Text>
          </View>
          <View
            style={{ flex: 1 }}
            onLayout={(e) => {
              const { width: fw, height: fh, x, y } = e.nativeEvent.layout
              setTreeChartFsLayout((prev) =>
                prev && prev.width === fw && prev.height === fh ? prev : { width: fw, height: fh, x, y },
              )
            }}
          >
            {!membersErr && chartLayout.ok ? (
              <FamilyTreeInteractive
                key="tree-fs"
                variant="fullscreen"
                layout={chartLayout}
                containerLayout={
                  treeChartFsLayout ?? {
                    width: windowW,
                    height: Math.max(440, windowH - 140),
                    x: 0,
                    y: 0,
                  }
                }
                focusMemberId={linkedMemberId}
                selectedMemberId={selectedId}
                onSelectMember={onSelectTreeMember}
              />
            ) : null}
          </View>
          <TreeMemberPeekModal
            embeddedInParent
            visible={peekOpen && selectedId != null}
            member={selectedRow}
            fatherName={
              selectedRow?.father_id ? memberById.get(selectedRow.father_id)?.full_name ?? null : null
            }
            motherName={
              selectedRow?.mother_id ? memberById.get(selectedRow.mother_id)?.full_name ?? null : null
            }
            spouseName={
              selectedRow?.spouse_id ? memberById.get(selectedRow.spouse_id)?.full_name ?? null : null
            }
            isLinkedSelf={Boolean(user.id && selectedRow?.linked_profile_id === user.id)}
            onClose={onClosePeek}
            canEditMembers={Boolean(workspaceCaps?.canEditMembers)}
            onPressEdit={onEditFromPeek}
            canUseClaim={Boolean(workspaceCaps?.canUseClaim)}
            userId={user.id}
            myLinkedMemberId={linkedMemberId}
            linkBusyId={linkBusyId}
            linkMsg={linkMsg}
            onClaim={claimMember}
            onUnlink={unlinkMember}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={createOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!createBusy) setCreateOpen(false)
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas, paddingTop: safeInsets.top }} edges={['left', 'right']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border }}>
              <Text style={{ fontFamily: Font.bold, fontSize: 18, color: p.ink }}>Tạo dòng họ</Text>
              <Pressable hitSlop={12} disabled={createBusy} onPress={() => setCreateOpen(false)} accessibilityLabel="Đóng">
                <FontAwesome name="times" size={22} color={p.muted} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              style={{ flex: 1 }}
            >
              <Text style={[styles.fieldLbl, { color: p.muted, fontFamily: Font.semiBold }]}>Tên dòng họ *</Text>
              <TextInput
                value={createName}
                onChangeText={setCreateName}
                placeholder="Ví dụ: Họ Nguyễn Chi Thanh Hoá"
                placeholderTextColor={p.muted}
                editable={!createBusy}
                style={[
                  styles.sheetInput,
                  { borderColor: p.border, backgroundColor: p.surfaceElevated, color: p.ink, fontFamily: Font.regular },
                ]}
              />
              <Text style={[styles.fieldLbl, { color: p.muted, fontFamily: Font.semiBold, marginTop: 14 }]}>Tên chi / nhánh</Text>
              <TextInput
                value={createClan}
                onChangeText={setCreateClan}
                editable={!createBusy}
                style={[
                  styles.sheetInput,
                  { borderColor: p.border, backgroundColor: p.surfaceElevated, color: p.ink, fontFamily: Font.regular },
                ]}
              />
              <Text style={[styles.fieldLbl, { color: p.muted, fontFamily: Font.semiBold, marginTop: 14 }]}>Quê / gốc</Text>
              <TextInput
                value={createOrigin}
                onChangeText={setCreateOrigin}
                editable={!createBusy}
                style={[
                  styles.sheetInput,
                  { borderColor: p.border, backgroundColor: p.surfaceElevated, color: p.ink, fontFamily: Font.regular },
                ]}
              />
              <Text style={[styles.fieldLbl, { color: p.muted, fontFamily: Font.semiBold, marginTop: 14 }]}>Giới thiệu ngắn</Text>
              <TextInput
                value={createDesc}
                onChangeText={setCreateDesc}
                editable={!createBusy}
                multiline
                maxLength={2000}
                style={[
                  styles.sheetArea,
                  { borderColor: p.border, backgroundColor: p.surfaceElevated, color: p.ink, fontFamily: Font.regular },
                ]}
              />
              {createErr ? (
                <Text style={[styles.sheetErr, { color: p.danger, fontFamily: Font.medium }]}>{createErr}</Text>
              ) : null}
              <Pressable
                onPress={() => void submitCreateTree()}
                disabled={createBusy}
                style={[styles.onboardPrimaryBtn, { marginTop: 22, backgroundColor: p.accent, opacity: createBusy ? 0.55 : 1 }]}
              >
                {createBusy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.onboardPrimaryTxt, { fontFamily: Font.bold }]}>Tạo dòng họ</Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <TreeMemberPeekModal
        visible={peekOpen && selectedId != null && !treeChartFsOpen}
        member={selectedRow}
        fatherName={
          selectedRow?.father_id ? memberById.get(selectedRow.father_id)?.full_name ?? null : null
        }
        motherName={
          selectedRow?.mother_id ? memberById.get(selectedRow.mother_id)?.full_name ?? null : null
        }
        spouseName={
          selectedRow?.spouse_id ? memberById.get(selectedRow.spouse_id)?.full_name ?? null : null
        }
        isLinkedSelf={Boolean(user.id && selectedRow?.linked_profile_id === user.id)}
        onClose={onClosePeek}
        canEditMembers={Boolean(workspaceCaps?.canEditMembers)}
        onPressEdit={onEditFromPeek}
        canUseClaim={Boolean(workspaceCaps?.canUseClaim)}
        userId={user.id}
        myLinkedMemberId={linkedMemberId}
        linkBusyId={linkBusyId}
        linkMsg={linkMsg}
        onClaim={claimMember}
        onUnlink={unlinkMember}
      />
      <TreeMemberEditModal
        visible={Boolean(editingMember)}
        member={editingMember}
        allMembers={memberRows}
        supportsPhoneColumn={supportsMemberPhoneColumn}
        onClose={() => setEditingMember(null)}
        onSubmit={submitMemberEdit}
      />
      <TreeMemberAddModal
        visible={addMemberOpen}
        peerMembers={memberRows}
        supportsPhoneColumn={supportsMemberPhoneColumn}
        onClose={() => setAddMemberOpen(false)}
        onSubmit={submitMemberAdd}
      />
    </>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  column: { flex: 1 },
  outerPad: { paddingHorizontal: 16, paddingBottom: 0 },
  onboardScroll: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 8 },
  onboardCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 8,
    alignItems: 'stretch',
  },
  onboardTit: { fontSize: 17, marginTop: 6 },
  onboardHint: { fontSize: 13, lineHeight: 19 },
  onboardInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    marginTop: 10,
  },
  onboardPrimaryBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  onboardPrimaryTxt: { color: '#FFFFFF', fontSize: 16 },
  onboardMsg: { fontSize: 14, marginTop: 6 },
  onboardSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 2,
    paddingVertical: 14,
  },
  onboardSecondaryTxt: { fontSize: 16 },
  onboardFine: { fontSize: 13, lineHeight: 20, marginTop: 14, paddingHorizontal: 4 },
  fieldLbl: { fontSize: 12, marginBottom: 6 },
  sheetInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
  },
  sheetArea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sheetErr: { fontSize: 14, marginTop: 10 },
  hero: {
    marginTop: 4,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    overflow: 'hidden',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeLbl: { fontSize: 12 },
  heroTitle: { fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  heroSub: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  chartFlex: {
    flex: 1,
    marginHorizontal: 16,
    minHeight: 380,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 8,
  },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  help: { fontSize: 13, marginTop: 4, marginBottom: 8 },
  emptyCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    marginTop: 8,
    alignItems: 'center',
  },
  emptyTit: { fontSize: 18, marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  err: { marginTop: 10, paddingHorizontal: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    zIndex: 30,
  },
  segmentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errBanner: { marginBottom: 6, paddingHorizontal: 2 },
  overviewScroll: { paddingBottom: 16, paddingHorizontal: 16 },
  intro: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statTile: {
    flex: 1,
    minWidth: 104,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 18, marginTop: 8 },
  storyCard: { padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 20 },
  sectionKicker: { fontSize: 12, letterSpacing: 0.6, marginBottom: 10, textTransform: 'uppercase' },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chartColumn: { flex: 1, minHeight: 0 },
  membersPane: { flex: 1, minHeight: 0, paddingHorizontal: 16 },
})
