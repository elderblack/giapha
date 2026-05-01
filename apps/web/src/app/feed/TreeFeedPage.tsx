import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import { role } from '../../design/roles'
import { TreePageIntro } from '../tree/TreeChrome'
import { TreeFeedSkeleton } from '../tree/TreeTabSkeletons'
import { useTreeWorkspace } from '../tree/treeWorkspaceContext'
import { getFamilyFeedMediaDisplayUrl } from './feedMediaDisplayUrl'
import { loadFeedTree, type FeedPostState, feedPostsFingerprint } from './feedQueries'
import { FeedComposerGate } from './FeedComposerGate'
import { publishFamilyFeedPost, type FeedPublishOnProgress } from './publishFeedPost'
import { FeedPostCard } from './FeedPostCard'

/** Cache trong phiên (ở lại khi đổi tab trong cùng dòng họ). */
const feedSessionByTree = new Map<string, FeedPostState[]>()

/** Tránh refetch ngay khi vừa tải xong (chuyển tab Trang nhà ↔ Dòng họ). */
const FEED_MOUNT_SWR_MS = 18_000
const feedLastFetchedAtMs = new Map<string, number>()

export function TreeFeedPage({ embedOnHome = false }: { embedOnHome?: boolean }) {
  const { tree, treeId, treeLoadErr } = useTreeWorkspace()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const [searchParams, setSearchParams] = useSearchParams()

  const [posts, setPosts] = useState<FeedPostState[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const highlightPostId = embedOnHome ? searchParams.get('post')?.trim() ?? '' : ''
  const highlightDoneRef = useRef<string | null>(null)

  useEffect(() => {
    if (!embedOnHome || !highlightPostId || posts === null) return
    const hasPost = posts.some((p) => p.id === highlightPostId)
    if (!hasPost) return
    if (highlightDoneRef.current === highlightPostId) return

    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(`feed-post-${highlightPostId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-abnb-primary', 'ring-offset-2', 'ring-offset-abnb-canvas', 'rounded-abnb-xl')
        window.setTimeout(() => {
          el.classList.remove(
            'ring-2',
            'ring-abnb-primary',
            'ring-offset-2',
            'ring-offset-abnb-canvas',
            'rounded-abnb-xl',
          )
        }, 2600)
      }
      highlightDoneRef.current = highlightPostId
      const next = new URLSearchParams(searchParams)
      next.delete('post')
      setSearchParams(next, { replace: true })
    })

    return () => window.cancelAnimationFrame(raf)
  }, [embedOnHome, highlightPostId, posts, searchParams, setSearchParams])

  useLayoutEffect(() => {
    highlightDoneRef.current = null
  }, [highlightPostId, treeId])

  const refresh = useCallback(async () => {
    if (!treeId || !sb) return
    setLoadErr(null)
    try {
      const next = await loadFeedTree(treeId)
      feedSessionByTree.set(treeId, next)
      feedLastFetchedAtMs.set(treeId, Date.now())
      setPosts((prev) => {
        if (prev != null && feedPostsFingerprint(prev) === feedPostsFingerprint(next)) return prev
        return next
      })
    } catch {
      setLoadErr('Không tải được bảng tin.')
      setPosts([])
    }
  }, [sb, treeId])

  /** Một handler ổn định cho mọi FeedPostCard — tránh rerender chỉ do inline arrow. */
  const handleFeedReload = useCallback(() => {
    void refresh()
  }, [refresh])

  const refreshDebounceMs = 380
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current != null) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      void refresh()
    }, refreshDebounceMs)
  }, [refresh])

  useEffect(() => () => {
    if (refreshTimerRef.current != null) clearTimeout(refreshTimerRef.current)
  }, [])

  useEffect(() => {
    if (!treeId || !sb) return
    const hit = feedSessionByTree.get(treeId)
    const last = feedLastFetchedAtMs.get(treeId) ?? 0
    const recentlyFetched = Date.now() - last < FEED_MOUNT_SWR_MS
    const skipNetwork = recentlyFetched && hit !== undefined

    queueMicrotask(() => {
      if (hit !== undefined) setPosts(hit)
      else setPosts(null)

      if (!skipNetwork) {
        void refresh()
      }
    })
  }, [treeId, sb, refresh])

  useEffect(() => {
    if (!posts?.length) return
    void (async () => {
      const urls: string[] = []
      for (const p of posts.slice(0, 8)) {
        const first = p.media[0]
        if (!first || first.media_kind !== 'image') continue
        const u = await getFamilyFeedMediaDisplayUrl(first.storage_path.trim())
        if (u) urls.push(u)
      }
      for (const u of urls) {
        const img = new Image()
        img.decoding = 'async'
        img.src = u
      }
    })()
  }, [posts])

  useEffect(() => {
    if (!sb || !treeId) return
    const name = `family-feed-${treeId}`
    const ch = sb
      .channel(name)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_feed_posts',
          filter: `family_tree_id=eq.${treeId}`,
        },
        () => {
          void scheduleRefresh()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_feed_post_reactions' },
        () => {
          void scheduleRefresh()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_feed_comment_reactions' },
        () => {
          void scheduleRefresh()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_feed_comments' },
        () => {
          void scheduleRefresh()
        },
      )

    return () => {
      sb.removeChannel(ch)
    }
  }, [sb, treeId, scheduleRefresh])

  async function publishPost(
    bodyDraft: string,
    files: File[],
    onProgress?: FeedPublishOnProgress,
  ): Promise<boolean> {
    if (!treeId || !uid) return false
    setBusy(true)
    try {
      const r = await publishFamilyFeedPost({
        treeId,
        authorId: uid,
        bodyDraft,
        files,
        onProgress,
      })
      if (r.ok === false) {
        window.alert(r.error ?? 'Không đăng được bài.')
        return false
      }
      await refresh()
      return true
    } finally {
      setBusy(false)
    }
  }

  const introBlock =
    embedOnHome ? null : (
      <TreePageIntro kicker="Bảng tin dòng họ" title="Tin tức & kỷ niệm">
        Bài viết chỉ hiển thị với thành viên cùng dòng họ; sắp xếp theo thời gian mới nhất.
      </TreePageIntro>
    )

  const showFooterExtras = !embedOnHome

  if (!sb) {
    return <p className="text-sm text-abnb-error">Không kết nối được. Vui lòng thử lại sau.</p>
  }

  if (tree === undefined) {
    return (
      <div className={embedOnHome ? 'w-full max-w-none' : 'mx-auto max-w-xl'}>
        <TreeFeedSkeleton />
      </div>
    )
  }

  if (!tree || treeLoadErr) {
    return (
      <p className={`${role.bodySm} text-abnb-error`}>
        {treeLoadErr ?? 'Không mở được dòng họ.'}
      </p>
    )
  }

  return (
    <div className={embedOnHome ? 'w-full max-w-none' : 'max-w-xl'}>
      {introBlock}

      <FeedComposerGate
        disabled={busy}
        onPublish={(b, f) => publishPost(b, f)}
        trees={[{ id: tree.id, name: tree.name }]}
        selectedTreeId={treeId}
        onSelectedTreeChange={() => {}}
        audienceMode="single"
      />

      {loadErr ? <p className="mt-4 text-sm text-abnb-error">{loadErr}</p> : null}

      {posts === null ? (
        <TreeFeedSkeleton />
      ) : posts.length === 0 ? (
        <p
          className={`${role.bodySm} mt-8 rounded-abnb-xl border border-dashed border-abnb-hairlineSoft/90 bg-abnb-canvas/50 px-5 py-8 text-center text-abnb-muted`}
        >
          Chưa có bài viết — hãy là người đầu tiên chia sẻ cùng cả họ.
        </p>
      ) : (
        <ul className="mt-8 space-y-6">
          {posts.map((p, idx) => (
            <li
              key={p.id}
              id={`feed-post-${p.id}`}
              className="feed-home-post-enter scroll-mt-28"
              style={{
                animationDelay: `${Math.min(idx * 52, 620)}ms`,
              }}
            >
              <FeedPostCard post={p} currentUserId={uid} onReload={handleFeedReload} />
            </li>
          ))}
        </ul>
      )}

      {showFooterExtras ? (
        <p className={`${role.caption} mt-10 flex flex-wrap items-center gap-x-3 gap-y-2`}>
          <span>Xem và quản lý kết nối (bạn bè, gợi ý).</span>
          <Link className={`${role.link} font-semibold`} to="/app/connections">
            Trang Kết nối
          </Link>
        </p>
      ) : null}
    </div>
  )
}
