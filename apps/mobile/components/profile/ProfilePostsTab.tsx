import type { ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native'

import { FeedComposeModal, type FeedComposePublishResult } from '@/components/feed/FeedComposeModal'
import { FeedPostCardMobile } from '@/components/feed/FeedPostCardMobile'
import { Text } from '@/components/Themed'
import { usePalette } from '@/hooks/usePalette'
import { loadMyPostsPage, loadUserTreesForComposer, reloadFeedPostsByIds, type FeedPostState } from '@/lib/feed/feedQueries'
import { publishFamilyFeedPostMobile } from '@/lib/feed/publishFamilyFeedPost'
import { getSupabase } from '@/lib/supabase'
import { Font } from '@/theme/typography'

import { FeedProfileComposerRow } from './FeedProfileComposerRow'

const PAGE_SIZE = 12

type TreeOpt = { id: string; name: string }

export function ProfilePostsTab(props: {
  /** Chủ sở hữu bài đăng (hồ sơ đang xem). */
  profileUserId: string
  /** Người đang đăng nhập — reaction / xoá / đăng bài. */
  viewerUserId: string | undefined
  /** Ô đăng bài + chọn dòng họ (chỉ hồ sơ của chính mình). */
  showComposer?: boolean
  displayName: string
  avatarUrl: string | null
  initials: string
  ListHeaderComponent: ReactElement | null
}) {
  const p = usePalette()
  const sb = getSupabase()
  const {
    profileUserId,
    viewerUserId,
    showComposer = true,
    displayName,
    avatarUrl,
    initials,
    ListHeaderComponent,
  } = props

  const [posts, setPosts] = useState<FeedPostState[]>([])
  const [initialLoad, setInitialLoad] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const nextOffsetRef = useRef(0)
  const loadingRef = useRef(false)

  const [trees, setTrees] = useState<TreeOpt[]>([])
  const [treesLoading, setTreesLoading] = useState(true)
  const [selectedPostTreeId, setSelectedPostTreeId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)

  useEffect(() => {
    if (!showComposer || !sb || !viewerUserId) {
      setTrees([])
      setTreesLoading(false)
      return
    }
    let cancel = false
    setTreesLoading(true)
    void loadUserTreesForComposer(viewerUserId).then((list) => {
      if (cancel) return
      setTrees(list)
      setSelectedPostTreeId(list[0]?.id ?? null)
      setTreesLoading(false)
    })
    return () => {
      cancel = true
    }
  }, [sb, viewerUserId, showComposer])

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((x) => x.id !== postId))
  }, [])

  const refreshPost = useCallback(
    async (postId: string) => {
      const m = await reloadFeedPostsByIds([postId])
      const next = m.get(postId)
      if (!next) {
        removePost(postId)
        return
      }
      setPosts((prev) => prev.map((x) => (x.id === postId ? next : x)))
    },
    [removePost],
  )

  const loadBatch = useCallback(
    async (reset: boolean) => {
      if (!sb || loadingRef.current) return
      loadingRef.current = true
      const offset = reset ? 0 : nextOffsetRef.current
      if (reset) {
        setLoadErr(null)
        setInitialLoad(true)
      } else {
        setLoadingMore(true)
      }
      try {
        const batch = await loadMyPostsPage(profileUserId, offset, PAGE_SIZE)
        if (reset) {
          setPosts(batch)
          nextOffsetRef.current = batch.length
        } else {
          setPosts((prev) => [...prev, ...batch])
          nextOffsetRef.current = offset + batch.length
        }
        setHasMore(batch.length >= PAGE_SIZE)
      } catch {
        setLoadErr('Không tải được bài viết.')
        if (reset) setPosts([])
      } finally {
        loadingRef.current = false
        setInitialLoad(false)
        setLoadingMore(false)
      }
    },
    [sb, profileUserId],
  )

  useEffect(() => {
    nextOffsetRef.current = 0
    setPosts([])
    setHasMore(true)
    void loadBatch(true)
  }, [profileUserId, loadBatch])

  const publishFromProfile = useCallback(
    async (bodyDraft: string, assets: { uri: string; mimeType?: string | null }[]): Promise<FeedComposePublishResult> => {
      if (!viewerUserId || !selectedPostTreeId) return { ok: false, error: 'Chưa chọn dòng họ.' }
      setPublishBusy(true)
      try {
        const r = await publishFamilyFeedPostMobile({
          treeId: selectedPostTreeId,
          authorId: viewerUserId,
          bodyDraft,
          assets,
        })
        if (!r.ok) return { ok: false, error: r.error }
        await loadBatch(true)
        return { ok: true }
      } finally {
        setPublishBusy(false)
      }
    },
    [selectedPostTreeId, viewerUserId, loadBatch],
  )

  const feedComposerDisabled =
    !showComposer ||
    treesLoading ||
    publishBusy ||
    trees.length === 0 ||
    selectedPostTreeId == null

  const composerBlock = showComposer ? (
    <>
      <FeedProfileComposerRow
        disabled={feedComposerDisabled}
        onOpen={() => setComposeOpen(true)}
        avatarUrl={avatarUrl}
        initials={initials}
        displayName={displayName}
      />
      {loadErr ? (
        <Text style={[styles.err, { color: p.danger, fontFamily: Font.medium }]}>{loadErr}</Text>
      ) : null}
      {initialLoad ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={p.accent} />
        </View>
      ) : posts.length === 0 ? (
        <View style={[styles.emptyBox, { borderColor: p.border, backgroundColor: p.canvasMuted }]}>
          <Text style={[styles.emptyTxt, { color: p.muted, fontFamily: Font.regular }]}>
            {trees.length > 0
              ? 'Chưa có bài nào ở đây — dùng ô đăng bài phía trên hoặc mở Bản tin.'
              : 'Bạn chưa tham gia dòng họ nào — nhận lời mời hoặc tạo dòng họ để đăng bài lên bảng tin.'}
          </Text>
        </View>
      ) : null}
    </>
  ) : (
    <>
      {loadErr ? (
        <Text style={[styles.err, { color: p.danger, fontFamily: Font.medium }]}>{loadErr}</Text>
      ) : null}
      {initialLoad ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={p.accent} />
        </View>
      ) : posts.length === 0 ? (
        <View style={[styles.emptyBox, { borderColor: p.border, backgroundColor: p.canvasMuted }]}>
          <Text style={[styles.emptyTxt, { color: p.muted, fontFamily: Font.regular }]}>
            Chưa có bài đăng trong phạm vi bạn được xem, hoặc người này chưa đăng bài lên bảng tin dòng họ.
          </Text>
        </View>
      ) : null}
    </>
  )

  return (
    <>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {ListHeaderComponent}
            <View style={styles.listHeadPad}>{composerBlock}</View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.ph}>
            <FeedPostCardMobile
              post={item}
              currentUserId={viewerUserId}
              onReload={() => void refreshPost(item.id)}
            />
          </View>
        )}
        contentContainerStyle={[styles.listContent, { backgroundColor: p.canvas }]}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (!loadingRef.current && hasMore && !initialLoad && !loadingMore) {
            void loadBatch(false)
          }
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoad}>
              <ActivityIndicator color={p.accent} />
            </View>
          ) : !hasMore && posts.length > 0 ? (
            <Text style={[styles.endTxt, { color: p.muted, fontFamily: Font.regular }]}>
              {profileUserId === viewerUserId ? 'Đã hiển thị hết bài của bạn.' : 'Đã hiển thị hết bài trong phạm vi xem.'}
            </Text>
          ) : null
        }
        keyboardShouldPersistTaps="handled"
      />
      {showComposer ? (
        <FeedComposeModal
          visible={composeOpen}
          onClose={() => setComposeOpen(false)}
          busy={publishBusy}
          onPublish={(body, assets) => publishFromProfile(body, assets)}
          avatarUrl={avatarUrl}
          initials={initials}
          trees={trees.length > 0 ? trees : undefined}
          selectedTreeId={selectedPostTreeId}
          onTreeChange={setSelectedPostTreeId}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  listHeadPad: { paddingHorizontal: 12, paddingTop: 4 },
  listContent: { paddingBottom: 28 },
  ph: { paddingHorizontal: 12 },
  err: { marginBottom: 10, fontSize: 14 },
  loaderWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 28,
    marginBottom: 8,
  },
  emptyTxt: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  footerLoad: { paddingVertical: 24, alignItems: 'center' },
  endTxt: { textAlign: 'center', paddingVertical: 20, fontSize: 13 },
})
