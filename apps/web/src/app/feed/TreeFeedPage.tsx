import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import { role } from '../../design/roles'
import { TreePageIntro } from '../tree/TreeChrome'
import { useTreeWorkspace } from '../tree/treeWorkspaceContext'
import { loadFeedTree, type FeedPostState } from './feedQueries'
import { FeedComposerGate } from './FeedComposerGate'
import { publishFamilyFeedPost } from './publishFeedPost'
import { FeedPostCard } from './FeedPostCard'

export function TreeFeedPage({ embedOnHome = false }: { embedOnHome?: boolean }) {
  const { tree, treeId, treeLoadErr } = useTreeWorkspace()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id

  const [posts, setPosts] = useState<FeedPostState[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!treeId || !sb) return
    setLoadErr(null)
    try {
      const next = await loadFeedTree(treeId)
      setPosts(next)
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
    void refresh()
  }, [refresh])

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
        { event: '*', schema: 'public', table: 'family_feed_comments' },
        () => {
          void scheduleRefresh()
        },
      )
      .subscribe()

    return () => {
      sb.removeChannel(ch)
    }
  }, [sb, treeId, scheduleRefresh])

  async function publishPost(bodyDraft: string, files: File[]): Promise<boolean> {
    if (!treeId || !uid) return false
    setBusy(true)
    try {
      const r = await publishFamilyFeedPost({
        treeId,
        authorId: uid,
        bodyDraft,
        files,
      })
      if (!r.ok) return false
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
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
        <p className={role.caption}>Đang tải…</p>
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
        <div className="mt-8 flex justify-center py-14">
          <Loader2 className="h-7 w-7 animate-spin text-abnb-primary" />
        </div>
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
              className="feed-home-post-enter"
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
