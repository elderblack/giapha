import { useCallback, useState, type ReactNode } from 'react'
import { ImageOff, Maximize2, X } from 'lucide-react'
import { useFeedImageLayout } from './useFeedImageLayout'

/** Một ô media (ảnh trong bài hoặc preview blob URL khi đăng). */
export type FeedAttachmentItem = {
  key: string
  url: string
  kind: 'image' | 'video'
}

/** Ảnh trong mosaic không tải — dùng chung cho ô cover và khung đơn. */
function BrokenImagePlaceholder({ minHeight }: { minHeight?: string }) {
  const mh = minHeight ?? 'min-h-[120px]'
  return (
    <div
      role="img"
      aria-label="Không tải được ảnh"
      className={`flex h-full w-full ${mh} flex-col items-center justify-center gap-2 bg-neutral-950/40 px-2 text-center`}
    >
      <ImageOff className="h-8 w-8 text-neutral-400" strokeWidth={1.75} aria-hidden />
      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Không hiển thị</span>
    </div>
  )
}

function VideoBrokenPlaceholder({ minHeight }: { minHeight?: string }) {
  const mh = minHeight ?? 'min-h-[160px]'
  return (
    <div
      role="img"
      aria-label="Không phát được video"
      className={`flex h-full w-full ${mh} flex-col items-center justify-center gap-2 bg-neutral-950/40 px-2 text-center`}
    >
      <ImageOff className="h-8 w-8 text-neutral-400" strokeWidth={1.75} aria-hidden />
      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Không phát được</span>
    </div>
  )
}

function RemoveChip({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="absolute right-1.5 top-1.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-abnb-surfaceCard/95 text-abnb-body shadow-abnb ring-1 ring-abnb-hairlineSoft transition hover:bg-abnb-surfaceSoft"
      aria-label={label}
    >
      <X className="h-4 w-4" strokeWidth={2} />
    </button>
  )
}

function TileShell({
  children,
  onRemove,
  removeLabel,
}: {
  children: ReactNode
  onRemove?: () => void
  removeLabel: string
}) {
  return (
    <div className="relative">
      {onRemove ? <RemoveChip onClick={onRemove} label={removeLabel} /> : null}
      {children}
    </div>
  )
}

/** 
 * Composer & feed ô đa-phương tiện — mặc định cover; `contain` khi cần giữ trọn ảnh trong composer.
 */
function MediaTileCover({
  item,
  className,
  photoFit = 'cover',
}: {
  item: FeedAttachmentItem
  className?: string
  photoFit?: 'cover' | 'contain'
}) {
  const [imgBroken, setImgBroken] = useState(false)
  const [videoBroken, setVideoBroken] = useState(false)

  const onImgError = useCallback(() => setImgBroken(true), [])

  const base =
    'h-full min-h-0 w-full [-webkit-touch-callout:none] [touch-action:manipulation] select-none [&_::-webkit-media-controls]:pointer-events-auto'

  const object =
    photoFit === 'contain' ? 'object-contain object-center' : 'object-cover object-center'
  const fit = `${base} ${object} ${className ?? ''}`

  if (item.kind === 'video') {
    if (videoBroken) return <VideoBrokenPlaceholder />
    return (
      <video
        src={item.url}
        controls
        playsInline
        preload="metadata"
        className={fit}
        onError={() => setVideoBroken(true)}
      />
    )
  }

  if (imgBroken) return <BrokenImagePlaceholder />

  return (
    <img
      src={item.url}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      sizes="(max-width:1023px) 28vw, 22vw"
      onError={onImgError}
      className={fit}
    />
  )
}

/** Chiều cao cụm đa ảnh trên bảng tin (strip 1×4 & lưới 2×2 desktop). */
const FEED_CLUSTER_HEIGHT =
  'h-[min(125vw,_480px)] max-h-[min(78vh,_560px)] min-h-[188px] w-full sm:min-h-[200px] sm:h-[min(440px,_68vh)] sm:max-h-[72vh]'

/**
 * Một hàng N cột khi đã phát hiện toàn ảnh dọc (kiểu Facebook — ô cao, object-cover).
 * Cao hơn FEED_CLUSTER_HEIGHT để screenshot dạng máy không bị ép vuông quá ngắn.
 */
const FEED_PORTRAIT_ROW_HEIGHT =
  'h-[min(96vw,_600px)] max-h-[min(84vh,_640px)] min-h-[min(260px,_70vw)] w-full sm:h-[min(78vw,_580px)] sm:max-h-[min(82vh,_640px)]'

function GridCellShell({
  children,
  overlay,
  expandControl,
}: {
  children: ReactNode
  overlay?: ReactNode
  /** Nút mở xem trong bài — ảnh: ô invisible; video: nút góc. */
  expandControl?: ReactNode
}) {
  return (
    <div className="relative isolate min-h-0 min-w-0 overflow-hidden bg-black">
      {children}
      {expandControl}
      {overlay}
    </div>
  )
}

/** Bảng tin: mở theatre / lightbox kiểu Facebook (ảnh nhấp ô / video nút ·). */
function FeedThumbnailExpandCtl({
  item,
  idx,
  onMediaOpen,
}: {
  item: FeedAttachmentItem
  idx: number
  onMediaOpen?: (index: number) => void
}): ReactNode {
  if (!onMediaOpen) return null
  if (item.kind === 'video') {
    return (
      <button
        type="button"
        className="absolute bottom-2 right-2 z-[25] inline-flex touch-manipulation items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm hover:bg-black/88"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onMediaOpen(idx)
        }}
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden />
        Xem lớn
      </button>
    )
  }
  return (
    <button
      type="button"
      className="absolute inset-0 z-[5] cursor-zoom-in border-0 bg-transparent p-0"
      aria-label={`Mở xem media ${idx + 1}`}
      onClick={() => onMediaOpen(idx)}
    />
  )
}

/**
 * Strip ngang — 2–4 ô; ảnh `cover` căn ô (mixed layout / chờ probe).
 */
function FeedHeroStrip({
  items,
  moreOverlay,
  onMediaOpen,
}: {
  items: FeedAttachmentItem[]
  moreOverlay?: ReactNode
  onMediaOpen?: (index: number) => void
}) {
  const cols = Math.min(4, Math.max(2, items.length)) as 2 | 3 | 4
  const gridCols = cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4'

  return (
    <div
      className={`grid ${gridCols} ${FEED_CLUSTER_HEIGHT} w-full gap-px overflow-hidden rounded-abnb-xl bg-black`}
      role="group"
      aria-label={`Đính kèm ${items.length} ảnh hoặc video`}
    >
      {items.map((it, idx) => (
        <GridCellShell
          key={it.key}
          expandControl={<FeedThumbnailExpandCtl item={it} idx={idx} onMediaOpen={onMediaOpen} />}
          overlay={moreOverlay != null && idx === items.length - 1 ? moreOverlay : undefined}
        >
          <MediaTileCover item={it} />
        </GridCellShell>
      ))}
    </div>
  )
}

/** Một hàng toàn ảnh dọc: N cột bằng nhau (2–4), cao như FB, cover trong ô — không cố 2×2 vuông. */
function FeedPortraitRow({
  items,
  moreOverlay,
  onMediaOpen,
}: {
  items: FeedAttachmentItem[]
  moreOverlay?: ReactNode
  onMediaOpen?: (index: number) => void
}) {
  const n = items.length
  const cols = n <= 2 ? 'grid-cols-2' : n === 3 ? 'grid-cols-3' : 'grid-cols-4'

  return (
    <div
      className={`grid ${cols} ${FEED_PORTRAIT_ROW_HEIGHT} w-full gap-px overflow-hidden rounded-abnb-xl bg-black`}
      role="group"
      aria-label={`Đính kèm ${items.length} ảnh dọc`}
    >
      {items.map((it, idx) => (
        <GridCellShell
          key={it.key}
          expandControl={<FeedThumbnailExpandCtl item={it} idx={idx} onMediaOpen={onMediaOpen} />}
          overlay={moreOverlay != null && idx === items.length - 1 ? moreOverlay : undefined}
        >
          <MediaTileCover item={it} />
        </GridCellShell>
      ))}
    </div>
  )
}

/** 4 ô: desktop rộng dùng lưới 2×2 (chuẩn FB web); strip ẩn từ `lg`. */
function FeedQuadResponsive({
  items,
  moreOverlay,
  onMediaOpen,
}: {
  items: FeedAttachmentItem[]
  moreOverlay?: ReactNode
  onMediaOpen?: (index: number) => void
}) {
  if (items.length !== 4) return null

  return (
    <div
      className={`hidden w-full gap-px overflow-hidden rounded-abnb-xl bg-black lg:grid lg:grid-cols-2 lg:grid-rows-2 lg:[grid-auto-rows:1fr] ${FEED_CLUSTER_HEIGHT}`}
      role="group"
      aria-label="Đính kèm 4 ảnh hoặc video"
    >
      {items.map((it, idx) => (
        <GridCellShell
          key={it.key}
          expandControl={<FeedThumbnailExpandCtl item={it} idx={idx} onMediaOpen={onMediaOpen} />}
          overlay={moreOverlay != null && idx === 3 ? moreOverlay : undefined}
        >
          <MediaTileCover item={it} />
        </GridCellShell>
      ))}
    </div>
  )
}

/** Bảng tin: strip (mọi breakpoint) hoặc strip + ô 4 trên desktop khi đúng 4 ô hiển thị. */
function FeedMediaCluster({
  items,
  moreOverlay,
  onMediaOpen,
}: {
  items: FeedAttachmentItem[]
  moreOverlay?: ReactNode
  onMediaOpen?: (index: number) => void
}) {
  const showQuadDesktop = items.length === 4

  return (
    <>
      {showQuadDesktop ? (
        <>
          <div className="lg:hidden">
            <FeedHeroStrip items={items} moreOverlay={moreOverlay} onMediaOpen={onMediaOpen} />
          </div>
          <FeedQuadResponsive items={items} moreOverlay={moreOverlay} onMediaOpen={onMediaOpen} />
        </>
      ) : (
        <FeedHeroStrip items={items} moreOverlay={moreOverlay} onMediaOpen={onMediaOpen} />
      )}
    </>
  )
}

/** Khung mosaic trong composer (gọn, 2×2 / 1+2). */
const MOSAIC_SHELL_COMPOSER =
  'h-[min(54vw,_260px)] max-h-[min(46vh,_300px)] min-h-[180px] w-full sm:h-[clamp(188px,_48vw,_280px)]'

/** Composer trong modal — bố cục ô lớn + lưới. */
function ComposerMosaic({ items }: { items: FeedAttachmentItem[] }) {
  const n = items.length
  const showMoreBadge = n > 4
  const moreCount = Math.max(0, n - 4)
  const mosaicItems = showMoreBadge ? items.slice(0, 4) : items

  const overlay =
    showMoreBadge && moreCount > 0 ? (
      <span className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center bg-black/50 text-[1.625rem] font-bold text-white backdrop-blur-[1px]">
        +{moreCount}
      </span>
    ) : null

  const seam = 'gap-0 bg-black/[0.08] dark:bg-black/35'
  const shell = `${MOSAIC_SHELL_COMPOSER} overflow-hidden rounded-abnb-lg ${seam}`

  function cell(it: FeedAttachmentItem, overlayChild?: ReactNode) {
    return (
      <div key={it.key} className="relative min-h-0 min-w-0 overflow-hidden bg-neutral-950/10">
        <MediaTileCover item={it} />
        {overlayChild}
      </div>
    )
  }

  /** 5+ file: chỉ đọc trong composer — vẫn 2×2 + +N như FB. */
  if (mosaicItems.length === 1) {
    const it = mosaicItems[0]
    return (
      <div className={`${shell} relative flex items-center justify-center`}>
        <div className="flex h-full w-full items-center justify-center px-2 py-2">
          <MediaTileCover item={it} photoFit="contain" className="max-h-full max-w-full" />
        </div>
      </div>
    )
  }

  if (mosaicItems.length === 2) {
    return (
      <div className={`${shell} grid grid-cols-2 gap-0`}>
        {mosaicItems.map((it) => cell(it))}
      </div>
    )
  }

  if (mosaicItems.length === 3) {
    const [a, b, c] = mosaicItems
    return (
      <div className={`${shell} grid grid-cols-2 grid-rows-2 gap-0`}>
        <div key={a.key} className="relative row-span-2 min-h-0 overflow-hidden">
          <MediaTileCover item={a} />
        </div>
        {cell(b)}
        {cell(c)}
      </div>
    )
  }

  return (
    <div className={`${shell} grid grid-cols-2 grid-rows-2 gap-0`}>
      {mosaicItems.map((it, i) => cell(it, showMoreBadge && i === 3 ? overlay : undefined))}
    </div>
  )
}

const EMPTY_PROBE: FeedAttachmentItem[] = []

function AttachmentMosaic({
  items,
  purpose,
  onMediaOpen,
}: {
  items: FeedAttachmentItem[]
  purpose: 'composer' | 'feed'
  onMediaOpen?: (index: number) => void
}) {
  const n = items.length
  const showMoreBadge = n > 4
  const moreCount = Math.max(0, n - 4)
  const mosaicItems = showMoreBadge ? items.slice(0, 4) : items

  const probeSource = purpose === 'feed' && mosaicItems.length >= 2 ? mosaicItems : EMPTY_PROBE
  const { layoutHint, layoutReady } = useFeedImageLayout(probeSource)

  const overlayPlus =
    showMoreBadge && moreCount > 0 ? (
      <span className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center bg-black/52 text-[1.75rem] font-bold tracking-wide text-white shadow-inner backdrop-blur-[2px]">
        +{moreCount}
      </span>
    ) : undefined

  if (purpose === 'feed') {
    if (mosaicItems.length >= 2) {
      const portraitRow = layoutReady && layoutHint === 'portrait-row'
      if (portraitRow) {
        return (
          <FeedPortraitRow
            items={mosaicItems}
            moreOverlay={showMoreBadge ? overlayPlus : undefined}
            onMediaOpen={onMediaOpen}
          />
        )
      }
      /**
       * Mặc định: 2–3 strip; 4 ảnh strip (<lg) + 2×2 (lg+). Cover trong ô.
       */
      return (
        <FeedMediaCluster
          items={mosaicItems}
          moreOverlay={showMoreBadge ? overlayPlus : undefined}
          onMediaOpen={onMediaOpen}
        />
      )
    }
    return null
  }

  return <ComposerMosaic items={items} />
}

type Props = {
  items: FeedAttachmentItem[]
  onRemoveAt?: (index: number) => void
  compact?: boolean
  /** Bảng tin: nhấp ảnh / video để mở xem toàn màn hình (composer không truyền). */
  onMediaOpen?: (index: number) => void
}

/** Feed: một ảnh/video duy nhất — contain, placeholder khi không tải / không phát được. */
function SingleFeedHeroMedia({ item }: { item: FeedAttachmentItem }) {
  const [imgBroken, setImgBroken] = useState(false)
  const [videoBroken, setVideoBroken] = useState(false)
  const onImgError = useCallback(() => setImgBroken(true), [])

  const fit =
    'h-auto max-h-[min(88vh,_800px)] w-full max-w-full object-contain'

  if (item.kind === 'video') {
    if (videoBroken) return <VideoBrokenPlaceholder minHeight="min-h-[200px]" />
    return (
      <video
        src={item.url}
        controls
        playsInline
        preload="metadata"
        className={fit}
        onError={() => setVideoBroken(true)}
      />
    )
  }

  if (imgBroken) return <BrokenImagePlaceholder minHeight="min-h-[200px]" />

  return (
    <img
      src={item.url}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      sizes="(max-width: 720px) 100vw, 720px"
      onError={onImgError}
      className={fit}
    />
  )
}

/**
 * Composer: ô cover trong modal (2 ảnh / 1+2 / 2×2 / 5+ với +N).
 * Feed: 1 ảnh contain; đa ảnh strip + đủ breakpoint (ảnh lỗi có placeholder).
 */
export function FeedAttachmentGrid({ items, onRemoveAt, compact, onMediaOpen }: Props) {
  if (!items.length) return null

  if (!compact && items.length === 1) {
    const it = items[0]
    return (
      <TileShell onRemove={onRemoveAt ? () => onRemoveAt(0) : undefined} removeLabel="Gỡ tệp đính kèm">
        <div className="relative flex w-full justify-center overflow-hidden rounded-abnb-lg bg-black">
          <div className="flex max-h-[min(88vh,_800px)] w-full max-w-full flex-col items-center justify-center px-1 py-0 sm:px-2">
            <SingleFeedHeroMedia item={it} />
          </div>
          {onMediaOpen ? <FeedThumbnailExpandCtl item={it} idx={0} onMediaOpen={onMediaOpen} /> : null}
        </div>
      </TileShell>
    )
  }

  if (compact) {
    return <AttachmentMosaic purpose="composer" items={items} />
  }

  return <AttachmentMosaic purpose="feed" items={items} onMediaOpen={onMediaOpen} />
}
