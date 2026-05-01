import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { role } from '../../design/roles'
import { getFamilyFeedMediaDisplayUrl } from '../feed/feedMediaDisplayUrl'
import { loadMyPostsPage, type FeedPostState } from '../feed/feedQueries'

const PAGE_SIZE = 15

type GridItem = {
  key: string
  postId: string
  storagePath: string
  url: string
  treeLabel: string
  createdAt: string
}

async function postsToImageItems(posts: FeedPostState[]): Promise<GridItem[]> {
  type Raw = Omit<GridItem, 'url'>
  const raw: Raw[] = []
  for (const p of posts) {
    const label = p.tree_name?.trim() || 'Bảng tin dòng họ'
    const images = p.media.filter((m) => m.media_kind === 'image')
    for (const m of images) {
      const storagePath = m.storage_path.trim()
      if (!storagePath) continue
      raw.push({
        key: `${p.id}-${m.id}`,
        postId: p.id,
        storagePath,
        treeLabel: label,
        createdAt: p.created_at,
      })
    }
  }
  const rows = await Promise.all(
    raw.map(async (r) => {
      const url = await getFamilyFeedMediaDisplayUrl(r.storagePath)
      return url ? { ...r, url } : null
    }),
  )
  return rows.filter(Boolean) as GridItem[]
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

export function ProfilePhotosTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<GridItem[]>([])
  const [initialLoad, setInitialLoad] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const nextOffsetRef = useRef(0)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)

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
      { root: null, rootMargin: '200px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [initialLoad, hasMore, loadingMore, loadBatch])

  const byTree = groupByTree(items)
  const flatForLightbox = items

  return (
    <div className="min-w-0">
      <header className="mb-5">
        <p className={`${role.bodySm} m-0 text-abnb-muted`}>
          Ảnh từ bài đăng bảng tin — gom theo dòng họ. Chỉ hiển thị nội dung bạn và người xem{' '}
          <span className="font-medium text-abnb-body">cùng được quyền xem</span> theo dòng họ (RLS).
        </p>
      </header>

      {loadErr ? <p className="mb-4 text-sm text-abnb-error">{loadErr}</p> : null}

      {initialLoad ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
        </div>
      ) : items.length === 0 ? (
        <p
          className={`${role.bodySm} rounded-abnb-xl border border-dashed border-abnb-hairlineSoft/90 bg-abnb-canvas/50 px-5 py-10 text-center text-abnb-muted`}
        >
          Chưa có ảnh trong bài đăng bảng tin (ảnh JPEG/PNG/WebP/GIF). Đăng bài kèm ảnh ở Trang nhà hoặc ô đăng
          bài bên tab Bài viết.
        </p>
      ) : (
        <div className="space-y-10">
          {[...byTree.entries()].map(([treeName, imgs]) => (
            <section key={treeName} aria-label={`Album · ${treeName}`}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-abnb-hairlineSoft/80 pb-3">
                <h3 className="m-0 text-[15px] font-bold tracking-tight text-abnb-ink">{treeName}</h3>
                <span className={`${role.caption} text-abnb-muted`}>{imgs.length} ảnh</span>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
                {imgs.map((im) => {
                  const idx = flatForLightbox.findIndex((x) => x.key === im.key)
                  return (
                    <li key={im.key}>
                      <button
                        type="button"
                        onClick={() => setLightbox(idx >= 0 ? idx : null)}
                        className="group relative aspect-square w-full overflow-hidden rounded-abnb-lg bg-abnb-surfaceSoft ring-1 ring-abnb-hairlineSoft/85 transition hover:ring-2 hover:ring-abnb-primary/35"
                      >
                        <img
                          src={im.url}
                          alt=""
                          className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.01]"
                          loading="lazy"
                        />
                        <span className="sr-only">Phóng to</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {hasMore && !initialLoad && items.length > 0 ? (
        <div ref={sentinelRef} className="flex min-h-[3rem] items-center justify-center py-8" aria-hidden>
          {loadingMore ? <Loader2 className="h-7 w-7 animate-spin text-abnb-primary" /> : null}
        </div>
      ) : null}

      {!hasMore && items.length > 0 ? (
        <p className={`${role.caption} py-8 text-center text-abnb-muted`}>Đã hiển thị hết ảnh từ bài đăng.</p>
      ) : null}

      {lightbox != null && flatForLightbox[lightbox] ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/88 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh"
        >
          <div className="flex shrink-0 justify-end">
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/18"
              aria-label="Đóng"
            >
              <X className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center pb-14 pt-4">
            <img
              src={flatForLightbox[lightbox].url}
              alt=""
              className="max-h-[min(78vh,900px)] max-w-full object-contain"
            />
            <p className={`mt-5 max-w-lg text-center text-[13px] text-white/80`}>
              {flatForLightbox[lightbox].treeLabel}
            </p>
          </div>
          {flatForLightbox.length > 1 ? (
            <div className="pointer-events-none fixed bottom-8 left-0 right-0 flex justify-center gap-8">
              <button
                type="button"
                className="pointer-events-auto rounded-full bg-white/95 px-5 py-2.5 text-[14px] font-semibold text-abnb-ink shadow-lg ring-1 ring-black/10 disabled:opacity-35"
                disabled={lightbox <= 0}
                onClick={() => setLightbox((i) => (i != null && i > 0 ? i - 1 : i))}
              >
                Trước
              </button>
              <button
                type="button"
                className="pointer-events-auto rounded-full bg-white/95 px-5 py-2.5 text-[14px] font-semibold text-abnb-ink shadow-lg ring-1 ring-black/10 disabled:opacity-35"
                disabled={lightbox >= flatForLightbox.length - 1}
                onClick={() =>
                  setLightbox((i) =>
                    i != null && i < flatForLightbox.length - 1 ? i + 1 : i,
                  )
                }
              >
                Sau
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
