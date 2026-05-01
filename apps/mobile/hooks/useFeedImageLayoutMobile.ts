import { useEffect, useMemo, useState } from 'react'

import { detectAllPortraitUrls, type FeedMobileMosaicHint } from '@/lib/feed/feedImageProbe'

/**
 * Probe kích thước ảnh từ xa (cache trong feedImageProbe) — chọn layout dọc giống web.
 * `layoutReady`: sau probe hoặc không cần probe (tránh nhảy layout khi chờ — optional consumer).
 */
export function useFeedImageLayoutMobile(imageUrls: string[]): {
  layoutHint: FeedMobileMosaicHint
  layoutReady: boolean
} {
  const sig = useMemo(() => imageUrls.join('\0'), [imageUrls])
  const [layoutHint, setLayoutHint] = useState<FeedMobileMosaicHint>('default')
  const [layoutReady, setLayoutReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let t: ReturnType<typeof setTimeout> | undefined

    if (imageUrls.length < 2) {
      setLayoutHint('default')
      setLayoutReady(true)
      return undefined
    }

    setLayoutReady(false)
    t = setTimeout(() => {
      if (!cancelled) {
        setLayoutHint('default')
        setLayoutReady(true)
      }
    }, 4000)

    void detectAllPortraitUrls(imageUrls).then((h) => {
      if (cancelled) return
      if (t !== undefined) clearTimeout(t)
      setLayoutHint(h)
      setLayoutReady(true)
    })

    return () => {
      cancelled = true
      if (t !== undefined) clearTimeout(t)
    }
  }, [sig])

  return { layoutHint, layoutReady }
}
