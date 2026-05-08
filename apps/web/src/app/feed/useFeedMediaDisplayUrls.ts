import { useMemo } from 'react'

import type { FeedMediaRow, FeedPostState } from './feedQueries'
import { mediaUrlMapKey } from './feedQueries'
import { getSupabase } from '../../lib/supabase'

/** Map `bucket::path` → URL công khai (bucket public — cache trình duyệt ổn định). */
export function useAllPostsFeedMediaPublicUrls(
  posts: readonly FeedPostState[] | null | undefined,
): Record<string, string> {
  const flat = useMemo(() => (posts ?? []).flatMap((p) => p.media), [posts])
  return useFeedMediaPublicUrlMap(flat)
}

export function useFeedMediaPublicUrlMap(
  items: readonly FeedMediaRow[] | null | undefined,
): Record<string, string> {
  const sb = getSupabase()

  const sig = useMemo(() => {
    const rows = items ?? []
    return rows
      .map((m) =>
        [
          m.id,
          m.storage_bucket ?? '',
          m.storage_path,
          m.thumb_path ?? '',
          m.medium_path ?? '',
          m.poster_path ?? '',
        ].join('|'),
      )
      .join('\n')
  }, [items])

  return useMemo(() => {
    const map: Record<string, string> = {}
    if (!sb) return map
    const rows = items ?? []
    for (const m of rows) {
      const bucket = (m.storage_bucket ?? 'family-feed-media').trim()
      const paths = new Set<string>()
      for (const p of [m.storage_path, m.thumb_path, m.medium_path, m.poster_path]) {
        if (p?.trim()) paths.add(p.trim())
      }
      for (const p of paths) {
        const key = mediaUrlMapKey(bucket, p)
        if (map[key]) continue
        const u = sb.storage.from(bucket).getPublicUrl(p).data.publicUrl
        if (u) map[key] = u
      }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sig captures item paths
  }, [sb, sig])
}

/** @deprecated Dùng useFeedMediaPublicUrlMap — giữ tên để ít đổi import. */
export const useAllPostsFeedMediaDisplayUrls = useAllPostsFeedMediaPublicUrls
export const useFeedMediaDisplayUrls = useFeedMediaPublicUrlMap
