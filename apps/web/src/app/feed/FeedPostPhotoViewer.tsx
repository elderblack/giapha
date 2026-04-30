import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react'
import type { FeedAttachmentItem } from './FeedAttachmentGrid'
import { useMaxLg } from '../../hooks/useMaxLg'

type Props = {
  open: boolean
  onClose: () => void
  startIndex?: number
  items: FeedAttachmentItem[]
  sidebar: ReactNode
  /** Mobile: thanh Like / Bình luận nổi trên ảnh (bấm comment mở sheet). */
  mobileFloatingBar?: ReactNode
  /** Mobile: điều khiển sheet bình luận từ ngoài (đóng viewer cần reset). */
  mobileCommentsOpen?: boolean
  onMobileCommentsOpenChange?: (open: boolean) => void
}

/**
 * Overlay: desktop = ảnh trái + panel phải. Mobile = ảnh toàn màn hình + bar nổi; bình luận trong sheet.
 */
export function FeedPostPhotoViewer({
  open,
  onClose,
  startIndex = 0,
  items,
  sidebar,
  mobileFloatingBar,
  mobileCommentsOpen: commentsOpenControlled,
  onMobileCommentsOpenChange,
}: Props) {
  const maxLg = useMaxLg()
  const prevOverflow = useRef<string | null>(null)
  const [index, setIndex] = useState(() => clampIndex(startIndex, items.length))
  const [uncontrolledSheet, setUncontrolledSheet] = useState(false)
  const sheetOpen = commentsOpenControlled ?? uncontrolledSheet
  const setSheetOpen = onMobileCommentsOpenChange ?? setUncontrolledSheet

  useEffect(() => {
    if (!open || !items.length) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ chỉ số khi mở viewer / đổi startIndex
    setIndex(clampIndex(startIndex, items.length))
  }, [open, startIndex, items.length])

  useEffect(() => {
    if (!open) return
    prevOverflow.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (maxLg && sheetOpen) {
          setSheetOpen(false)
          return
        }
        onClose()
      }
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
  }, [open, onClose, items.length, maxLg, sheetOpen, setSheetOpen])

  useEffect(() => {
    if (!open && commentsOpenControlled == null) {
      queueMicrotask(() => setUncontrolledSheet(false))
    }
  }, [open, commentsOpenControlled])

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
        className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#000000] lg:min-h-0"
        aria-roledescription="carousel"
      >
        <div className="pointer-events-none absolute left-3 top-3 z-30 flex gap-2 sm:left-4 sm:top-4 lg:left-4 lg:top-4">
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

        <div
          className={`flex min-h-0 w-full flex-1 items-center justify-center bg-[#000000] px-2 pt-14 [-webkit-tap-highlight-color:transparent] sm:px-6 lg:pb-10 lg:pt-12 ${
            maxLg ? 'pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]' : 'pb-3'
          }`}
        >
          <ViewerStage key={current.key} item={current} fullBleed={maxLg} />
        </div>

        {maxLg && mobileFloatingBar ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 border-t border-white/[0.12] bg-gradient-to-t from-black/85 via-black/50 to-transparent pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-10">
            <div className="pointer-events-auto px-2">{mobileFloatingBar}</div>
          </div>
        ) : null}

        <p className="sr-only">
          Đính kèm {safeItems.length} mục, đang hiển thị {index + 1} của {safeItems.length}
        </p>
      </section>

      {!maxLg ? (
        <aside className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[#393a3f] bg-[#242526] text-[#e4e6eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:h-full lg:max-h-none lg:min-h-0 lg:w-[min(420px,_40vw)] lg:flex-none lg:shrink-0 lg:border-l lg:border-t-0">
          {sidebar}
        </aside>
      ) : null}

      {maxLg && sheetOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-[2px]"
            aria-label="Đóng bình luận"
            onClick={() => setSheetOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[125] flex max-h-[min(88dvh,820px)] flex-col rounded-t-[1.25rem] border-t border-[#393a3f] bg-[#242526] shadow-[0_-12px_48px_rgba(0,0,0,0.45)]">
            <div className="flex shrink-0 justify-center border-b border-white/[0.08] py-2 pt-2.5">
              <div className="h-1 w-11 rounded-full bg-white/28" aria-hidden />
            </div>
            <div className="min-h-0 min-h-[200px] flex-1 overflow-hidden">{sidebar}</div>
          </div>
        </>
      ) : null}
    </div>,
    document.body,
  )
}

function clampIndex(i: number, len: number) {
  if (len <= 0) return 0
  if (Number.isNaN(i) || !Number.isFinite(i)) return 0
  return Math.max(0, Math.min(i, len - 1))
}

function ViewerStage({ item, fullBleed }: { item: FeedAttachmentItem; fullBleed: boolean }) {
  const [imgBroken, setImgBroken] = useState(false)
  const [videoBroken, setVideoBroken] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

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

  const fit = fullBleed
    ? 'max-h-[min(calc(100dvh-5.25rem),920px)] max-w-[100vw] object-contain'
    : 'max-h-[min(38dvh,360px)] max-w-[100vw] object-contain sm:max-h-[min(46dvh,480px)] lg:max-h-[min(92dvh,_900px)] lg:max-w-[100vw]'

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
