import { Image } from 'react-native'

import type { FeedPostState } from '@/lib/feed/feedQueries'
import { getFeedMediaPublicUrl } from '@/lib/feed/feedQueries'

/** Giới hạn kích prefetch mỗi lần bảng tin cập nhật (tránh bão mạng). */
const CAP_IMAGES = 80
const CAP_VIDEOS = 14
/** Tiêu đề HTTP Range nhỏ — warm TLS + CDN, khớp với ô poster. */
const VIDEO_RANGE = 'bytes=0-98303'

async function warmVideoBootstrap(url: string): Promise<void> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 14000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: VIDEO_RANGE },
      signal: ac.signal,
    })
    await res.blob()
  } catch {
    /* bỏ qua — không chặn feed */
  } finally {
    clearTimeout(t)
  }
}

/** Warm song song từng cặp URL (Range nhỏ). */
export function scheduleWarmVideoUrls(urls: readonly string[]): void {
  const unique = [...new Set(urls)].filter(Boolean)
  if (!unique.length) return
  void (async () => {
    for (let i = 0; i < unique.length; i += 2) {
      const batch = unique.slice(i, i + 2)
      await Promise.all(batch.map((u) => warmVideoBootstrap(u)))
    }
  })()
}

/**
 * Prefetch ảnh + warm một đoạn đầu file video để tái vào tab / cuộn tới không flash.
 */
export function prefetchFeedTreeMedia(posts: FeedPostState[] | null | undefined): void {
  if (!posts?.length) return

  const imgs: string[] = []
  const vids: string[] = []
  const seenImg = new Set<string>()
  const seenVid = new Set<string>()

  outer: for (const post of posts) {
    const sorted = [...post.media].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    for (const m of sorted) {
      const url = getFeedMediaPublicUrl(m.storage_path)
      if (!url) continue
      if (m.media_kind === 'image') {
        if (imgs.length >= CAP_IMAGES) continue
        if (seenImg.has(url)) continue
        seenImg.add(url)
        imgs.push(url)
      } else {
        if (vids.length >= CAP_VIDEOS) continue
        if (seenVid.has(url)) continue
        seenVid.add(url)
        vids.push(url)
      }
      if (imgs.length >= CAP_IMAGES && vids.length >= CAP_VIDEOS) break outer
    }
  }

  for (const u of imgs) void Image.prefetch(u).catch(() => {})

  scheduleWarmVideoUrls(vids)
}

export function prefetchFeedLightboxSlides(
  slides: ReadonlyArray<{ uri: string; kind: 'image' | 'video' }>,
): void {
  const vids: string[] = []
  for (const s of slides) {
    if (!s.uri) continue
    if (s.kind === 'image') void Image.prefetch(s.uri).catch(() => {})
    else vids.push(s.uri)
  }
  scheduleWarmVideoUrls(vids)
}
