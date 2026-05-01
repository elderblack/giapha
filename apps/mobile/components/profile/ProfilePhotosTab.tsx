import FontAwesome from '@expo/vector-icons/FontAwesome'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/Themed'
import { usePalette } from '@/hooks/usePalette'
import { loadMyPostsPage, type FeedPostState } from '@/lib/feed/feedQueries'
import { getFamilyFeedMediaDisplayUrl } from '@/lib/feed/feedMediaDisplayUrl'
import { Font } from '@/theme/typography'

const PAGE_SIZE = 15

type GridItem = {
  key: string
  postId: string
  url: string
  treeLabel: string
}

async function postsToImageItems(posts: FeedPostState[]): Promise<GridItem[]> {
  type Raw = { key: string; postId: string; storage_path: string; treeLabel: string }
  const raw: Raw[] = []
  for (const p of posts) {
    const label = p.tree_name?.trim() || 'Bảng tin dòng họ'
    const images = p.media.filter((m) => m.media_kind === 'image')
    for (const m of images) {
      const path = m.storage_path?.trim()
      if (!path) continue
      raw.push({
        key: `${p.id}-${m.id}`,
        postId: p.id,
        storage_path: path,
        treeLabel: label,
      })
    }
  }
  const settled = await Promise.all(
    raw.map(async (r) => {
      const url = await getFamilyFeedMediaDisplayUrl(r.storage_path)
      return url ? { ...r, url } : null
    }),
  )
  return settled.filter(Boolean) as GridItem[]
}

function groupByTree(items: GridItem[]): Map<string, GridItem[]> {
  const m = new Map<string, GridItem[]>()
  for (const it of items) {
    const arr = m.get(it.treeLabel) ?? []
    arr.push(it)
    m.set(it.treeLabel, arr)
  }
  return m
}

export function ProfilePhotosTab(props: {
  userId: string
  ListHeaderComponent: ReactElement | null
}) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const { width: winW, height: winH } = useWindowDimensions()
  const { userId, ListHeaderComponent } = props

  const [items, setItems] = useState<GridItem[]>([])
  const [initialLoad, setInitialLoad] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const nextOffsetRef = useRef(0)
  const loadingRef = useRef(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const gap = 3
  const pad = 12
  const cols = 3
  const cell = Math.floor((winW - pad * 2 - gap * (cols - 1)) / cols)

  const loadBatch = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) return
      loadingRef.current = true
      const offset = reset ? 0 : nextOffsetRef.current
      if (reset) {
        setLoadErr(null)
        setInitialLoad(true)
      } else {
        setLoadingMore(true)
      }
      try {
        const batch = await loadMyPostsPage(userId, offset, PAGE_SIZE)
        const chunk = await postsToImageItems(batch)
        if (reset) {
          setItems(chunk)
          nextOffsetRef.current = batch.length
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((x) => x.key))
            const next = chunk.filter((c) => !seen.has(c.key))
            return [...prev, ...next]
          })
          nextOffsetRef.current = offset + batch.length
        }
        setHasMore(batch.length >= PAGE_SIZE)
      } catch {
        setLoadErr('Không tải được ảnh.')
        if (reset) setItems([])
      } finally {
        loadingRef.current = false
        setInitialLoad(false)
        setLoadingMore(false)
      }
    },
    [userId],
  )

  useEffect(() => {
    nextOffsetRef.current = 0
    setItems([])
    setHasMore(true)
    void loadBatch(true)
  }, [userId, loadBatch])

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
      const threshold = 280
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold) {
        if (!loadingRef.current && hasMore && !initialLoad && !loadingMore) {
          void loadBatch(false)
        }
      }
    },
    [hasMore, initialLoad, loadingMore, loadBatch],
  )

  const byTree = groupByTree(items)
  const flat = items

  return (
    <>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={400}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24), backgroundColor: p.canvas }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {ListHeaderComponent}
        <View style={{ paddingHorizontal: pad, paddingTop: 8 }}>
          <Text style={[styles.intro, { color: p.muted, fontFamily: Font.regular }]}>
            Ảnh từ bài đăng bảng tin — gom theo dòng họ. Chỉ hiển thị nội dung bạn có quyền xem (RLS).
          </Text>
          {loadErr ? (
            <Text style={[styles.err, { color: p.danger, fontFamily: Font.medium }]}>{loadErr}</Text>
          ) : null}
          {initialLoad ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color={p.accent} />
            </View>
          ) : items.length === 0 ? (
            <View style={[styles.emptyBox, { borderColor: p.border, backgroundColor: p.canvasMuted }]}>
              <Text style={[styles.emptyTxt, { color: p.muted, fontFamily: Font.regular }]}>
                Chưa có ảnh trong bài đăng bảng tin. Đăng bài kèm ảnh ở tab Bài viết hoặc Bản tin.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 22 }}>
              {[...byTree.entries()].map(([treeName, imgs]) => (
                <View key={treeName}>
                  <View style={[styles.secHead, { borderBottomColor: p.border }]}>
                    <Text style={[styles.secTitle, { color: p.ink, fontFamily: Font.bold }]} numberOfLines={1}>
                      {treeName}
                    </Text>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: p.muted }}>{imgs.length} ảnh</Text>
                  </View>
                  <View style={[styles.grid, { gap }]}>
                    {imgs.map((im) => {
                      const idx = flat.findIndex((x) => x.key === im.key)
                      return (
                        <Pressable
                          key={im.key}
                          onPress={() => setLightboxIdx(idx >= 0 ? idx : null)}
                          style={[
                            styles.cell,
                            {
                              width: cell,
                              height: cell,
                              backgroundColor: p.canvasMuted,
                              borderColor: p.border,
                            },
                          ]}
                        >
                          <Image source={{ uri: im.url }} style={styles.cellImg} resizeMode="cover" />
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
          {loadingMore ? (
            <View style={styles.footerLoad}>
              <ActivityIndicator color={p.accent} />
            </View>
          ) : null}
          {!hasMore && items.length > 0 ? (
            <Text style={[styles.endTxt, { color: p.muted, fontFamily: Font.regular }]}>Đã hiển thị hết ảnh từ bài đăng.</Text>
          ) : null}
        </View>
      </ScrollView>

      {lightboxIdx != null && flat[lightboxIdx] ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightboxIdx(null)}>
          <View style={[styles.lbBackdrop, { paddingTop: insets.top }]}>
            <View style={styles.lbTop}>
              <Pressable
                onPress={() => setLightboxIdx(null)}
                style={[styles.lbClose, { backgroundColor: 'rgba(255,255,255,0.14)' }]}
                accessibilityLabel="Đóng"
              >
                <FontAwesome name="times" size={22} color="#FFF" />
              </Pressable>
            </View>
            <View style={styles.lbBody}>
              <Image
                source={{ uri: flat[lightboxIdx].url }}
                style={[styles.lbImg, { height: Math.min(winH * 0.58, 520) }]}
                resizeMode="contain"
              />
              <Text style={styles.lbCaption} numberOfLines={2}>
                {flat[lightboxIdx].treeLabel}
              </Text>
            </View>
            {flat.length > 1 ? (
              <View style={[styles.lbNav, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <Pressable
                  onPress={() => setLightboxIdx((i) => (i != null && i > 0 ? i - 1 : i))}
                  disabled={lightboxIdx <= 0}
                  style={[styles.lbNavBtn, { opacity: lightboxIdx <= 0 ? 0.35 : 1 }]}
                >
                  <Text style={styles.lbNavTxt}>Trước</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setLightboxIdx((i) => (i != null && i < flat.length - 1 ? i + 1 : i))
                  }
                  disabled={lightboxIdx >= flat.length - 1}
                  style={[styles.lbNavBtn, { opacity: lightboxIdx >= flat.length - 1 ? 0.35 : 1 }]}
                >
                  <Text style={styles.lbNavTxt}>Sau</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Modal>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 12 },
  err: { marginBottom: 10, fontSize: 14 },
  loaderWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 28,
  },
  emptyTxt: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  secHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  secTitle: { fontSize: 15, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { borderRadius: 10, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  cellImg: { width: '100%', height: '100%' },
  footerLoad: { paddingVertical: 24, alignItems: 'center' },
  endTxt: { textAlign: 'center', paddingVertical: 16, fontSize: 13 },
  lbBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)' },
  lbTop: { alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8 },
  lbClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbBody: { justifyContent: 'center', paddingHorizontal: 8, flex: 1 },
  lbImg: { width: '100%' },
  lbCaption: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  lbNav: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingTop: 8 },
  lbNavBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  lbNavTxt: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
})
