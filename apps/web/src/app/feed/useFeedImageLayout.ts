import { useEffect, useMemo, useState } from 'react'

/** Trùng FeedAttachmentItem — không import từ FeedAttachmentGrid (tránh vòng). */
type LayoutProbeItem = { key: string; url: string; kind: 'image' | 'video' }

/** Tỉ lệ cao/rộng ≥ ngưỡng này → coi là ảnh dọc (điện thoại / story). */
const PORTRAIT_ASPECT_MIN = 1.12

/** Tránh probe lặp URL khi scroll / remount các bài chứa cùng ảnh. */
const DIMENSION_CACHE = new Map<string, { w: number; h: number }>()

export type FeedMosaicLayoutHint = 'portrait-row' | 'default'

function loadDimsCached(url: string) {
  return new Promise<{ w: number; h: number } | null>((resolve) => {
    const hit = DIMENSION_CACHE.get(url)
    if (hit) {
      resolve(hit)
      return
    }
    const im = new Image()
    im.onload = () => {
      const d = { w: im.naturalWidth || 1, h: im.naturalHeight || 1 }
      DIMENSION_CACHE.set(url, d)
      resolve(d)
    }
    im.onerror = () => resolve(null)
    im.src = url
  })
}

function scheduleProbe(run: () => void) {
  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(run, { timeout: 2200 })
    return () => cancelIdleCallback(id)
  }
  const t = window.setTimeout(run, 0)
  return () => clearTimeout(t)
}

/**
 * Đọc kích thước ảnh để chọn mosaic; cache + chờ idle tránh chen main thread khi vào feed.
 */
export function useFeedImageLayout(items: LayoutProbeItem[]): {
  layoutHint: FeedMosaicLayoutHint
  layoutReady: boolean
} {
  const signature = useMemo(() => items.map((i) => `${i.key}:${i.url}`).join('|'), [items])

  const [layoutHint, setLayoutHint] = useState<FeedMosaicLayoutHint>('default')
  const [layoutReady, setLayoutReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let cleanupIdle: (() => void) | undefined

    if (items.length < 2) {
      setLayoutHint('default')
      setLayoutReady(true)
      return
    }

    const allImage = items.every((i) => i.kind === 'image' && i.url)
    if (!allImage) {
      setLayoutHint('default')
      setLayoutReady(true)
      return
    }

    setLayoutReady(false)

    let fallbackTimeout: ReturnType<typeof window.setTimeout> | undefined

    const runProbe = () => {
      if (cancelled) return

      fallbackTimeout = window.setTimeout(() => {
        if (!cancelled) {
          setLayoutHint('default')
          setLayoutReady(true)
        }
      }, 4000)

      void Promise.all(items.map((i) => loadDimsCached(i.url))).then((dims) => {
        if (cancelled) return
        if (fallbackTimeout !== undefined) window.clearTimeout(fallbackTimeout)
        if (dims.some((d) => d == null)) {
          setLayoutHint('default')
          setLayoutReady(true)
          return
        }
        const allPortrait = dims.every((d) => d != null && d!.h / d!.w >= PORTRAIT_ASPECT_MIN)
        setLayoutHint(allPortrait ? 'portrait-row' : 'default')
        setLayoutReady(true)
      })
    }

    cleanupIdle = scheduleProbe(runProbe)

    return () => {
      cancelled = true
      if (fallbackTimeout !== undefined) window.clearTimeout(fallbackTimeout)
      cleanupIdle?.()
    }
  }, [signature])

  return { layoutHint, layoutReady }
}
