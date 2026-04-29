import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react'
import type { FeedAttachmentItem } from './FeedAttachmentGrid'

type Props = {
  open: boolean
  onClose: () => void
  /** Chỉ số trong `items` của media đang xem — đổi khi mở từ lưới ảnh. */
  startIndex?: number
  items: FeedAttachmentItem[]
  /** Cột phải: tiêu đề bài, cảm xúc, bình luận (Facebook-style). */
  sidebar: ReactNode
}

/**
 * Overlay toàn khung nhìn kiểu Facebook: trái nền đen + ảnh/video căn giữa (contain), phải panel nội dung.
 */
export function FeedPostPhotoViewer({
  open,
  onClose,
  startIndex = 0,
  items,
  sidebar,
}: Props) {
  const prevOverflow = useRef<string | null>(null)
  const [index, setIndex] = useState(() => clampIndex(startIndex, items.length))

  useEffect(() => {
    if (!open || !items.length) return
    setIndex(clampIndex(startIndex, items.length))
  }, [open, startIndex, items.length])

  useEffect(() => {
    if (!open) return
    prevOverflow.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && items.length > 1) {
        setIndex((i) => (i + items.length - 1) % items.length)
      }
      if (e.key === 'ArrowRight' && items.length > 1) {
        setIndex((i) => (i + 1) % items.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow.current ?? ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, items.length])

  const prev = useCallback(() => {
    setIndex((i) => (i + items.length - 1) % items.length)
  }, [items.length])

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % items.length)
  }, [items.length])

  if (!open || !items.length) return null

  const safeItems = items
  const current = safeItems[index]

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex h-[100dvh] max-h-[100dvh] flex-col bg-[#000000] lg:flex-row"
      role="presentation"
      aria-modal="true"
    >
      <section
        className="relative flex min-h-[45vh] flex-1 min-w-0 flex-col bg-[#000000] lg:min-h-0"
        aria-roledescription="carousel"
      >
        <div className="pointer-events-none absolute left-3 top-3 z-30 flex gap-2 sm:left-4 sm:top-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white shadow-lg ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-white/18"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {safeItems.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              className="absolute left-1 top-1/2 z-20 flex -translate-y-1/2 rounded-full bg-white/12 p-2 text-white ring-1 ring-white/22 backdrop-blur-sm transition hover:bg-white/22 sm:left-3 sm:p-2.5"
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="h-8 w-8" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              className="absolute right-1 top-1/2 z-20 flex -translate-y-1/2 rounded-full bg-white/12 p-2 text-white ring-1 ring-white/22 backdrop-blur-sm transition hover:bg-white/22 sm:right-3 sm:p-2.5"
              aria-label="Ảnh sau"
            >
              <ChevronRight className="h-8 w-8" aria-hidden />
            </button>
          </>
        ) : null}

        <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-[#000000] px-2 pb-safe pt-14 sm:px-6 lg:pb-10 lg:pt-12">
          <ViewerStage item={current} />
        </div>

        <p className="sr-only">
          Đính kèm {safeItems.length} mục, đang hiển thị {index + 1} của {safeItems.length}
        </p>
      </section>

      <aside
        className="flex max-h-[min(52vh,_480px)] w-full shrink-0 flex-col overflow-hidden border-l border-[#393a3f] bg-[#242526] text-[#e4e6eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:max-h-none lg:h-full lg:w-[min(420px,_40vw)]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">{sidebar}</div>
      </aside>
    </div>,
    document.body,
  )
}

function clampIndex(i: number, len: number) {
  if (len <= 0) return 0
  if (Number.isNaN(i) || !Number.isFinite(i)) return 0
  return Math.max(0, Math.min(i, len - 1))
}

function ViewerStage({ item }: { item: FeedAttachmentItem }) {
  const [imgBroken, setImgBroken] = useState(false)
  const [videoBroken, setVideoBroken] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setImgBroken(false)
    setVideoBroken(false)
  }, [item.key, item.url])

  useEffect(() => {
    if (item.kind !== 'video') return
    const v = videoRef.current
    if (!v) return
    v.muted = true
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return () => {
        v.pause()
      }
    }
    void v.play().catch(() => {})
    return () => {
      v.pause()
    }
  }, [item.kind, item.key, item.url])

  const fit =
    'max-h-[calc(100dvh-8rem)] max-w-[100vw] object-contain sm:max-h-[min(92dvh,_900px)] lg:max-h-[min(94dvh,_900px)]'

  if (!item.url) return <BrokenBadge />

  if (item.kind === 'video') {
    if (videoBroken) return <BrokenBadge label="Không phát được" />
    return (
      <video
        ref={videoRef}
        key={item.url}
        src={item.url}
        controls
        muted
        playsInline
        preload="metadata"
        className={fit}
        onError={() => setVideoBroken(true)}
      />
    )
  }

  if (imgBroken) return <BrokenBadge />

  return (
    <img
      key={item.url}
      src={item.url}
      alt=""
      draggable={false}
      decoding="async"
      sizes="100vw"
      className={fit}
      onError={() => setImgBroken(true)}
    />
  )
}

function BrokenBadge({ label = 'Không hiển thị' }: { label?: string }) {
  return (
    <div className="flex max-w-md flex-col items-center justify-center gap-3 px-6 text-center text-neutral-400">
      <ImageOff className="h-14 w-14 opacity-80" strokeWidth={1.5} aria-hidden />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  )
}
