import { Image } from 'react-native'

const DIMENSION_CACHE = new Map<string, { w: number; h: number }>()

const PORTRAIT_ASPECT_MIN = 1.12

/** Trùng logic web/useFeedImageLayout — ảnh dọc dùng hàng cao (strip đều cột). */
export type FeedMobileMosaicHint = 'portrait-row' | 'default'

export function probeImageDims(uri: string): Promise<{ w: number; h: number } | null> {
  const hit = DIMENSION_CACHE.get(uri)
  if (hit) return Promise.resolve(hit)
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (w, h) => {
        const d = { w: Math.max(1, w), h: Math.max(1, h) }
        DIMENSION_CACHE.set(uri, d)
        resolve(d)
      },
      () => resolve(null),
    )
  })
}

export async function detectAllPortraitUrls(urls: string[]): Promise<FeedMobileMosaicHint> {
  if (urls.length < 2) return 'default'
  const dims = await Promise.all(urls.map((u) => probeImageDims(u)))
  if (dims.some((d) => d == null)) return 'default'
  const allPortrait = dims.every((d) => d!.h / d!.w >= PORTRAIT_ASPECT_MIN)
  return allPortrait ? 'portrait-row' : 'default'
}
