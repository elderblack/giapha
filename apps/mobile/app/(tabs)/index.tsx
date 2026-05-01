import FontAwesome from '@expo/vector-icons/FontAwesome'
import type { ImagePickerAsset } from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useIsFocused } from '@react-navigation/native'

import { logoMarkAsset } from '@/constants/brand'
import { FeedComposeModal } from '@/components/feed/FeedComposeModal'
import { FeedPostCardMobile, type FeedCardViewportPayload } from '@/components/feed/FeedPostCardMobile'
import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { feedPostsFingerprint, loadFeedTree, type FeedPostState } from '@/lib/feed/feedQueries'
import { prefetchFeedTreeMedia } from '@/lib/feed/prefetchFeedMedia'
import { publishFamilyFeedPostMobile } from '@/lib/feed/publishFamilyFeedPost'
import { getUserFamilyTreeId } from '@/lib/familyTreeMembership'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { Font } from '@/theme/typography'

type ProfileLite = {
  full_name: string | null
  avatar_url: string | null
}

const FB_STORIES = [{ id: '1', label: 'Kỷ niệm họ' }, { id: '2', label: 'Giỗ cúng' }, { id: '3', label: 'Họp họ' }]

export default function HomeScreen() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  const router = useRouter()
  const { user } = useAuth()
  const sb = getSupabase()
  const [profile, setProfile] = useState<ProfileLite | null>(null)
  const [treeId, setTreeId] = useState<string | null | undefined>(undefined)
  const [treeName, setTreeName] = useState<string | null>(null)
  const [metaErr, setMetaErr] = useState<string | null>(null)
  const [posts, setPosts] = useState<FeedPostState[] | null>(null)
  const [feedLoading, setFeedLoading] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeLibrary, setComposeLibrary] = useState<'all' | 'video' | null>(null)
  const [publishBusy, setPublishBusy] = useState(false)

  const scrollYRef = useRef(0)
  const viewportHRef = useRef(520)
  const feedCardBoundsRef = useRef(new Map<string, { top: number; bottom: number }>())
  const rafFeedAutoplayRef = useRef<number | null>(null)
  const [feedAutoplayPostId, setFeedAutoplayPostId] = useState<string | null>(null)

  const pickFeedAutoplayPost = useCallback(() => {
    const vy = scrollYRef.current
    const vh = viewportHRef.current
    if (vh < 80) return
    const visTop = vy
    const visBot = vy + vh
    const focusMid = vy + vh * 0.52
    let bestId: string | null = null
    let bestScore = -Infinity
    for (const [id, b] of feedCardBoundsRef.current) {
      const h = b.bottom - b.top
      if (h < 20) continue
      const overlap = Math.min(b.bottom, visBot) - Math.max(b.top, visTop)
      if (overlap < Math.min(h * 0.32, 100)) continue
      const center = b.top + h * 0.5
      const score = overlap * 2 - Math.abs(center - focusMid)
      if (score > bestScore) {
        bestScore = score
        bestId = id
      }
    }
    setFeedAutoplayPostId((prev) => (prev === bestId ? prev : bestId))
  }, [])

  const scheduleFeedAutoplayPick = useCallback(() => {
    if (rafFeedAutoplayRef.current != null) return
    rafFeedAutoplayRef.current = requestAnimationFrame(() => {
      rafFeedAutoplayRef.current = null
      pickFeedAutoplayPost()
    })
  }, [pickFeedAutoplayPost])

  useEffect(() => () => {
    if (rafFeedAutoplayRef.current != null) cancelAnimationFrame(rafFeedAutoplayRef.current)
  }, [])

  useEffect(() => {
    if (posts == null) {
      feedCardBoundsRef.current.clear()
      setFeedAutoplayPostId(null)
      return
    }
    scheduleFeedAutoplayPick()
  }, [posts, scheduleFeedAutoplayPick])

  const onFeedCardViewport = useCallback(
    (p: FeedCardViewportPayload) => {
      if (!p.hasEmbedVideo) {
        feedCardBoundsRef.current.delete(p.postId)
      } else {
        feedCardBoundsRef.current.set(p.postId, { top: p.contentTop, bottom: p.contentBottom })
      }
      scheduleFeedAutoplayPick()
    },
    [scheduleFeedAutoplayPick],
  )

  const onFeedCardUnmountViewport = useCallback(
    (id: string) => {
      feedCardBoundsRef.current.delete(id)
      scheduleFeedAutoplayPick()
    },
    [scheduleFeedAutoplayPick],
  )

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefreshDebounced = useCallback((fn: () => void, ms = 380) => {
    if (refreshTimerRef.current != null) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      fn()
    }, ms)
  }, [])

  useEffect(() => () => {
    if (refreshTimerRef.current != null) clearTimeout(refreshTimerRef.current)
  }, [])

  const initials = useMemo(() => {
    const n = profile?.full_name?.trim() ?? user?.email ?? '?'
    const parts = n.split(/\s+/)
    const a = parts[0]?.[0]
    const b = parts[parts.length - 1]?.[0]
    if (parts.length > 1 && a && b) return (a + b).toUpperCase()
    return (n[0] ?? '?').toUpperCase()
  }, [profile?.full_name, user?.email])

  const refreshMeta = useCallback(async () => {
    if (!sb || !user?.id) {
      setTreeId(null)
      setTreeName(null)
      setProfile(null)
      setMetaErr(null)
      return
    }
    setMetaErr(null)
    const [profRes, tid] = await Promise.all([
      sb.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
      getUserFamilyTreeId(sb, user.id),
    ])
    if (profRes.error) {
      setMetaErr(profRes.error.message)
      setProfile(null)
    } else {
      setProfile((profRes.data as ProfileLite) ?? null)
    }
    setTreeId(tid)

    if (tid) {
      const { data: tr } = await sb.from('family_trees').select('name').eq('id', tid).maybeSingle()
      setTreeName(typeof tr?.name === 'string' && tr.name.trim() ? tr.name.trim() : 'Dòng họ')
    } else {
      setTreeName(null)
    }
  }, [sb, user?.id])

  const refreshFeed = useCallback(async (opts?: { force?: boolean }) => {
    if (!sb || !treeId) {
      setPosts(treeId === null ? [] : null)
      return
    }
    setFeedLoading(true)
    try {
      const next = await loadFeedTree(treeId)
      setPosts((prev) => {
        if (
          !opts?.force &&
          prev != null &&
          feedPostsFingerprint(prev) === feedPostsFingerprint(next)
        ) {
          return prev
        }
        return next
      })
    } catch {
      setPosts([])
    } finally {
      setFeedLoading(false)
    }
  }, [sb, treeId])

  useEffect(() => {
    void refreshMeta()
  }, [refreshMeta])

  useEffect(() => {
    void refreshFeed()
  }, [refreshFeed])

  useEffect(() => {
    if (!posts?.length) return
    const id = requestAnimationFrame(() => prefetchFeedTreeMedia(posts))
    return () => cancelAnimationFrame(id)
  }, [posts])

  useFocusEffect(
    useCallback(() => {
      if (!posts?.length) return
      const id = requestAnimationFrame(() => prefetchFeedTreeMedia(posts))
      return () => cancelAnimationFrame(id)
    }, [posts]),
  )

  const handleFeedReload = useCallback(() => {
    void refreshFeed()
  }, [refreshFeed])

  /** Realtime: cập nhật khi có dữ liệu mới trên Supabase (cả thiết bị khác). */
  useEffect(() => {
    if (!sb || !treeId || !hasSupabaseCredentials()) return
    const name = `family-feed-mobile-${treeId}`
    const ch = sb
      .channel(name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_feed_posts', filter: `family_tree_id=eq.${treeId}` },
        () => scheduleRefreshDebounced(handleFeedReload),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_feed_post_reactions' },
        () => scheduleRefreshDebounced(handleFeedReload),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_feed_comment_reactions' },
        () => scheduleRefreshDebounced(handleFeedReload),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_feed_comments' },
        () => scheduleRefreshDebounced(handleFeedReload),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_feed_post_media' },
        () => scheduleRefreshDebounced(handleFeedReload),
      )
      .subscribe()

    return () => {
      void sb.removeChannel(ch)
    }
  }, [sb, treeId, handleFeedReload, scheduleRefreshDebounced])

  async function publishFromModal(bodyDraft: string, assets: ImagePickerAsset[]) {
    if (!treeId || !user?.id) return { ok: false as const, error: 'Chưa có dòng họ hoặc chưa đăng nhập.' }
    setPublishBusy(true)
    try {
      if (__DEV__) {
        console.log('[home-feed] publishFromModal → publishFamilyFeedPostMobile', {
          treeId,
          assets: assets.length,
        })
      }
      const r = await publishFamilyFeedPostMobile({
        treeId,
        authorId: user.id,
        bodyDraft,
        assets,
      })
      if (__DEV__) console.log('[home-feed] publish result', r)
      if (!r.ok) return { ok: false as const, error: r.error }
      await refreshFeed({ force: true })
      return { ok: true as const }
    } finally {
      setPublishBusy(false)
    }
  }

  if (!hasSupabaseCredentials()) {
    return (
      <View style={[styles.center, { backgroundColor: p.canvas, paddingTop: Math.max(insets.top, 8) }]}>
        <FontAwesome name="plug" size={40} color={p.muted} />
        <Text style={{ marginTop: 12, fontFamily: Font.bold, fontSize: 20, color: p.ink }}>Chưa cấu hình Supabase</Text>
        <Text style={{ marginTop: 8, fontFamily: Font.regular, color: p.muted, textAlign: 'center', paddingHorizontal: 32 }}>
          Thêm biến môi trường vào apps/mobile/.env và khởi động lại Expo.
        </Text>
      </View>
    )
  }

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: p.canvas, paddingTop: Math.max(insets.top, 8) }]}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.canvas }]} edges={['left', 'right']}>
      {isFocused ? (
        <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} backgroundColor={p.surfaceElevated} />
      ) : null}
      <View style={{ backgroundColor: p.surfaceElevated, paddingTop: insets.top }}>
        {/* Thanh đầu phong cách FB: logo, ô tìm, biểu tượng nhanh — nền khớp status bar */}
        <View style={[styles.fbHeader, { backgroundColor: p.surfaceElevated, borderBottomColor: p.border }]}>
          <View style={[styles.brandMark, { overflow: 'hidden', backgroundColor: p.canvasMuted }]}>
            <Image source={logoMarkAsset} style={{ width: 38, height: 38 }} resizeMode="cover" />
          </View>
          <View style={[styles.fbSearchFake, { backgroundColor: p.canvasMuted }]}>
            <FontAwesome name="search" size={15} color={p.muted} />
            <Text style={[styles.fbSearchLbl, { color: p.muted, fontFamily: Font.medium }]}>Tìm trên Gia Phả…</Text>
          </View>
          <View style={styles.fbIconRow}>
            <Pressable accessibilityLabel="Tin nhắn" hitSlop={8} style={styles.roundIconBtn} onPress={() => router.push('/chat')}>
              <FontAwesome name="comment-o" size={21} color={p.accent} />
            </Pressable>
            <Pressable accessibilityLabel="Thông báo" hitSlop={8} style={styles.roundIconBtn} onPress={() => router.push('/notifications')}>
              <FontAwesome name="bell-o" size={21} color={p.accent} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        scrollEventThrottle={16}
        onLayout={(e) => {
          viewportHRef.current = e.nativeEvent.layout.height
          scheduleFeedAutoplayPick()
        }}
        onContentSizeChange={() => scheduleFeedAutoplayPick()}
        onScroll={(ev) => {
          scrollYRef.current = ev.nativeEvent.contentOffset.y
          scheduleFeedAutoplayPick()
        }}
        onMomentumScrollEnd={() => scheduleFeedAutoplayPick()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedScrollPad}
        refreshControl={<RefreshControl refreshing={feedLoading} onRefresh={() => void refreshFeed()} tintColor={p.accent} />}
      >
        {metaErr ? (
          <View style={[styles.warnBox, { borderColor: p.border, backgroundColor: p.accentMuted }]}>
            <Text style={[styles.warnTxt, { color: p.danger, fontFamily: Font.medium }]}>{metaErr}</Text>
          </View>
        ) : null}

        {treeId === undefined ? (
          <View style={[styles.bannerLoad, { backgroundColor: p.surfaceElevated }]}>
            <ActivityIndicator color={p.accent} />
            <Text style={{ marginLeft: 10, fontFamily: Font.medium, color: p.muted }}>Đang nối dòng họ của bạn…</Text>
          </View>
        ) : treeId ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 6 }}>
              <Text style={[styles.fbSubline, { color: p.muted, fontFamily: Font.medium, marginBottom: 0, paddingHorizontal: 0, flex: 1 }]}>
                Bảng tin · {treeName ?? 'Dòng họ'}
              </Text>
              <Pressable
                onPress={() => router.push('/feed/reels')}
                hitSlop={8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
              >
                <FontAwesome name="play-circle" size={16} color={p.accent} />
                <Text style={{ fontFamily: Font.semiBold, fontSize: 13, color: p.accent }}>Lướt clip</Text>
              </Pressable>
            </View>

            {/* Dải ô tròn (stub) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thêm tin hoặc đăng bài"
                onPress={() => {
                  setComposeLibrary(null)
                  setComposeOpen(true)
                }}
                style={({ pressed }) => [styles.storyCircle, styles.storyCircleAdd, { borderColor: p.accent, opacity: pressed ? 0.85 : 1 }]}
              >
                <FontAwesome name="plus" color={p.accent} size={28} />
                <Text style={[styles.storyLbl, { color: p.accent, fontFamily: Font.semiBold }]}>Tin họ</Text>
              </Pressable>
              {FB_STORIES.map((s, i) => (
                <View key={s.id} style={styles.storyItem}>
                  <LinearGradient colors={i % 2 ? ['#6366F1', '#9333EA'] : ['#0EA5E9', '#10B981']} style={styles.storyRing}>
                    <View style={[styles.storyAvatarInner, { backgroundColor: p.surface }]}>
                      <FontAwesome name="users" color={p.muted} size={22} />
                    </View>
                  </LinearGradient>
                  <Text numberOfLines={1} style={[styles.storyLbl, { color: p.muted, fontFamily: Font.medium }]}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {/* Composer dạng ô Facebook */}
            <View style={[styles.compRow, { backgroundColor: p.surfaceElevated }]}>
              <View style={[styles.compAvatarWrap, { borderColor: p.border }]}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.compAvatarImg} />
                ) : (
                  <LinearGradient colors={[p.accent, '#DD2476']} style={styles.compAvatarImg} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}>
                    <Text style={{ fontFamily: Font.bold, color: '#FFF', fontSize: 16 }}>{initials}</Text>
                  </LinearGradient>
                )}
              </View>
              <Pressable onPress={() => { setComposeLibrary(null); setComposeOpen(true) }} style={[styles.compInputFake, { backgroundColor: p.canvasMuted }]}>
                <Text style={{ fontFamily: Font.medium, fontSize: 15, color: p.muted }}>Bạn đang nghĩ gì…?</Text>
              </Pressable>
              <Pressable onPress={() => { setComposeLibrary(null); setComposeOpen(true) }} style={[styles.compMediaBtn, { backgroundColor: p.canvasMuted }]}>
                <FontAwesome name="image" color={p.accent} size={22} />
              </Pressable>
            </View>

            <View style={[styles.quickRow, { marginHorizontal: 12, paddingVertical: 0, marginBottom: 8, backgroundColor: p.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border }]}>
              <Pressable
                onPress={() => {
                  setComposeLibrary(null)
                  setComposeOpen(true)
                }}
                accessibilityLabel="Đăng ảnh"
                style={[styles.quickCell, { flex: 1 }]}
              >
                <FontAwesome name="camera" color={p.accent} size={17} />
                <Text style={{ marginLeft: 8, fontFamily: Font.medium, fontSize: 14, color: p.inkMuted }} numberOfLines={1}>
                  Ảnh
                </Text>
              </Pressable>
              <View style={[styles.quickSep, { backgroundColor: p.border }]} />
              <Pressable
                onPress={() => {
                  setComposeLibrary('video')
                  setComposeOpen(true)
                }}
                accessibilityLabel="Đăng video"
                style={[styles.quickCell, { flex: 1 }]}
              >
                <FontAwesome name="video-camera" color={p.accent} size={17} />
                <Text style={{ marginLeft: 8, fontFamily: Font.medium, fontSize: 14, color: p.inkMuted }} numberOfLines={1}>
                  Clip
                </Text>
              </Pressable>
              <View style={[styles.quickSep, { backgroundColor: p.border }]} />
              <Pressable
                onPress={() => Alert.alert('Vị trí', 'Định vị và gắn địa điểm sẽ được bổ sung ở bản tiếp theo.')}
                style={[styles.quickCell, { flex: 1 }]}
              >
                <FontAwesome name="map-marker" color={p.accent} size={18} />
                <Text style={{ marginLeft: 6, fontFamily: Font.medium, fontSize: 14, color: p.inkMuted }} numberOfLines={1}>
                  Check-in
                </Text>
              </Pressable>
            </View>

            {feedLoading && posts === null ? (
              <View style={[styles.bannerLoad, { marginTop: 16, justifyContent: 'center' }]}>
                <ActivityIndicator color={p.accent} />
                <Text style={{ marginLeft: 10, fontFamily: Font.medium, color: p.muted }}>Đang tải bảng tin…</Text>
              </View>
            ) : posts?.length === 0 ? (
              <Text style={[styles.emptyFeed, { color: p.muted, fontFamily: Font.regular }]}>
                Chưa có bài viết trong dòng họ — hãy viết bài từ ô “Bạn đang nghĩ gì…” ở trên.
              </Text>
            ) : posts?.length ? (
              <>
                <View style={[styles.fbDividerFull, { backgroundColor: p.border }]} />
                {posts.map((post) => (
                  <FeedPostCardMobile
                    key={post.id}
                    post={post}
                    currentUserId={user.id}
                    onReload={handleFeedReload}
                    winnerPostId={feedAutoplayPostId}
                    onReportViewport={onFeedCardViewport}
                    onViewportUnmount={onFeedCardUnmountViewport}
                  />
                ))}
              </>
            ) : (
              <Text style={[styles.emptyFeed, { color: p.muted, fontFamily: Font.regular }]}>Đang cập nhật bảng tin…</Text>
            )}
          </>
        ) : (
          <View style={[styles.noTreeCard, { backgroundColor: p.surfaceElevated, borderColor: p.border }]}>
            <FontAwesome name="link" color={p.accent} size={34} />
            <Text style={{ marginTop: 12, fontFamily: Font.bold, fontSize: 18, color: p.ink }}>Chưa có dòng họ để xem bảng tin</Text>
            <Text style={{ marginTop: 8, fontFamily: Font.regular, lineHeight: 22, color: p.muted, textAlign: 'center', paddingHorizontal: 8 }}>
              Khi được mời vào một cây Gia Phả, bảng tin sẽ xuất hiện tại đây cho cùng tài khoản.
            </Text>
          </View>
        )}

      </ScrollView>

      <FeedComposeModal
        visible={composeOpen}
        onClose={() => {
          setComposeLibrary(null)
          setComposeOpen(false)
        }}
        busy={publishBusy}
        onPublish={(b, assets) => publishFromModal(b, assets)}
        avatarUrl={profile?.avatar_url ?? null}
        initials={initials}
        initialLibrary={composeLibrary}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  fbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbSearchFake: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
  },
  fbSearchLbl: { fontSize: 14 },
  fbIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roundIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  feedScrollPad: { paddingTop: 2, paddingBottom: 12, width: '100%', paddingHorizontal: 0 },
  fbSubline: { fontSize: 13, paddingHorizontal: 14, marginBottom: 6 },
  storiesRow: { paddingHorizontal: 12, gap: 10, paddingBottom: 8 },
  storyCircleAdd: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  storyItem: { width: 68, alignItems: 'center' },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarInner: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  storyCircle: { alignItems: 'center' },
  storyLbl: { fontSize: 11, marginTop: 2, width: '100%', textAlign: 'center' },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    gap: 10,
    marginBottom: 6,
  },
  compAvatarWrap: { borderRadius: 20, overflow: 'hidden', width: 40, height: 40, borderWidth: StyleSheet.hairlineWidth },
  compAvatarImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  compInputFake: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  compMediaBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  quickRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, overflow: 'hidden' },
  quickCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  quickSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  fbDividerFull: { height: 6, alignSelf: 'stretch', opacity: 0.45, marginTop: 2, marginHorizontal: 12 },
  emptyFeed: { marginHorizontal: 16, marginTop: 24, fontSize: 15, textAlign: 'center', lineHeight: 23 },
  warnBox: { marginHorizontal: 12, padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth },
  warnTxt: { fontSize: 13 },
  bannerLoad: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, padding: 16, borderRadius: 14 },
  noTreeCard: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 22,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
})
