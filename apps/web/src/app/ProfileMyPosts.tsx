import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getSupabase } from '../lib/supabase'
import { role } from '../design/roles'
import { FeedPostCard } from './feed/FeedPostCard'
import { loadMyPostsPage, loadUserTreesForComposer, reloadFeedPostsByIds, type FeedPostState } from './feed/feedQueries'
import { readStoredProfileTreeId } from './feed/FeedComposer'
import { FeedComposerGate } from './feed/FeedComposerGate'
import { publishFamilyFeedPost } from './feed/publishFeedPost'

const PAGE_SIZE = 12

export function ProfileMyPosts({
  userId,
  slim,
  composer,
}: {
  userId: string
  slim?: boolean
  /** Ô đăng bài giống Trang nhà + chọn dòng họ nhận bài (`family_tree_id`). */
  composer?: boolean
}) {
  const sb = getSupabase()
  const [posts, setPosts] = useState<FeedPostState[]>([])
  const [initialLoad, setInitialLoad] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const nextOffsetRef = useRef(0)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const [treesForComposer, setTreesForComposer] = useState<{ id: string; name: string }[]>([])
  const [profileTreesLoading, setProfileTreesLoading] = useState(false)
  const [selectedPostTreeId, setSelectedPostTreeId] = useState<string | null>(null)
  const [publishBusy, setPublishBusy] = useState(false)

  useEffect(() => {
    if (!composer || !sb || !userId) return
    let cancelled = false
    setProfileTreesLoading(true)
    void loadUserTreesForComposer(userId).then((list) => {
      if (cancelled) return
      setTreesForComposer(list)
      const stored = readStoredProfileTreeId()
      const id = stored && list.some((t) => t.id === stored) ? stored : list[0]?.id ?? null
      setSelectedPostTreeId(id)
      setProfileTreesLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [composer, sb, userId])

  const removePost = useCallback((postId: string) => {
    setPosts((prev: FeedPostState[]) => prev.filter((p) => p.id !== postId))
  }, [])

  const refreshPost = useCallback(
    async (postId: string) => {
      const m = await reloadFeedPostsByIds([postId])
      const next = m.get(postId)
      if (!next) {
        removePost(postId)
        return
      }
      setPosts((prev: FeedPostState[]) => prev.map((p) => (p.id === postId ? next : p)))
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
        const batch = await loadMyPostsPage(userId, offset, PAGE_SIZE)
        if (reset) {
          setPosts(batch)
          nextOffsetRef.current = batch.length
        } else {
          setPosts((prev: FeedPostState[]) => [...prev, ...batch])
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
    [sb, userId],
  )

  const publishFromProfile = useCallback(
    async (bodyDraft: string, files: File[]): Promise<boolean> => {
      if (!selectedPostTreeId) return false
      setPublishBusy(true)
      try {
        const r = await publishFamilyFeedPost({
          treeId: selectedPostTreeId,
          authorId: userId,
          bodyDraft,
          files,
        })
        if (!r.ok) return false
        await loadBatch(true)
        return true
      } finally {
        setPublishBusy(false)
      }
    },
    [selectedPostTreeId, userId, loadBatch],
  )

  useEffect(() => {
    nextOffsetRef.current = 0
    setPosts([])
    setHasMore(true)
    void loadBatch(true)
  }, [userId, loadBatch])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || initialLoad || !hasMore) return

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting)
        if (hit && !loadingRef.current && hasMore && !loadingMore) {
          void loadBatch(false)
        }
      },
      { root: null, rootMargin: '240px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [initialLoad, hasMore, loadingMore, loadBatch])

  if (!sb) {
    return <p className={`${role.bodySm} text-abnb-error`}>Không kết nối được.</p>
  }

  const feedComposerDisabled =
    profileTreesLoading || publishBusy || treesForComposer.length === 0 || selectedPostTreeId == null

  return (
    <section aria-label="Bài đã đăng" className="min-w-0">
      {composer ? (
        <div className="mb-6">
          <FeedComposerGate
            disabled={feedComposerDisabled}
            onPublish={publishFromProfile}
            trees={treesForComposer}
            selectedTreeId={selectedPostTreeId}
            onSelectedTreeChange={setSelectedPostTreeId}
            audienceMode={treesForComposer.length > 1 ? 'choose' : 'single'}
          />
        </div>
      ) : null}

      {slim ? (
        <header className="mb-6">
          <p className={`${role.bodySm} m-0 text-abnb-muted`}>
            Bài đăng trong các dòng họ bạn tham gia — kéo xuống để tải thêm.
          </p>
        </header>
      ) : (
        <header className="mb-6 flex flex-col gap-1 border-b border-abnb-hairlineSoft/80 pb-5">
          <h2 className={`${role.headingSection} text-[1.125rem]`}>Bài viết của bạn</h2>
          <p className={`${role.bodySm} text-abnb-muted`}>
            Các dòng chia sẻ bạn đã đăng trong dòng họ (theo phạm vi bạn được mời). Kéo xuống để tải thêm.
          </p>
        </header>
      )}

      {loadErr ? <p className="mb-4 text-sm text-abnb-error">{loadErr}</p> : null}

      {initialLoad ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
        </div>
      ) : posts.length === 0 ? (
        <p
          className={`${role.bodySm} rounded-abnb-xl border border-dashed border-abnb-hairlineSoft/90 bg-abnb-canvas/50 px-5 py-10 text-center text-abnb-muted`}
        >
          {composer && treesForComposer.length > 0 ? (
            <>Chưa có bài nào ở đây — dùng ô đăng bài phía trên hoặc mở Trang nhà của dòng họ.</>
          ) : composer && treesForComposer.length === 0 ? (
            <>Bạn chưa tham gia dòng họ nào — nhận lời mời hoặc tạo dòng họ để đăng bài lên bảng tin.</>
          ) : (
            <>
              Bạn chưa đăng bài trong bảng tin dòng họ. Mở{' '}
              <Link className={`${role.link} font-semibold`} to="/app/home">
                Trang nhà
              </Link>{' '}
              của một dòng họ để chia sẻ.
            </>
          )}
        </p>
      ) : (
        <ul className="space-y-6">
          {posts.map((p: FeedPostState) => (
            <li key={p.id}>
              <FeedPostCard
                post={p}
                currentUserId={userId}
                showTreeLink
                onDeleted={() => removePost(p.id)}
                onReload={() => void refreshPost(p.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {hasMore && !initialLoad && posts.length > 0 ? (
        <div ref={sentinelRef} className="flex min-h-[3rem] items-center justify-center py-8" aria-hidden>
          {loadingMore ? <Loader2 className="h-7 w-7 animate-spin text-abnb-primary" /> : null}
        </div>
      ) : null}

      {!hasMore && posts.length > 0 ? (
        <p className={`${role.caption} py-10 text-center text-abnb-muted`}>Đã hiển thị hết bài của bạn.</p>
      ) : null}
    </section>
  )
}
