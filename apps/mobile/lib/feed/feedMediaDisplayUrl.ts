import { getSupabase } from '@/lib/supabase'

type CacheEntry = { url: string; expMs: number }

const cache = new Map<string, CacheEntry>()
const TTL_SLACK_MS = 120_000

/** URL có quyền đọc (signed) hoặc public — Storage RLS thường chặn GET ẩn danh vào `/object/public/`. */
export async function getFamilyFeedMediaDisplayUrl(storagePath: string): Promise<string | null> {
  const path = storagePath?.trim()
  if (!path) return null

  const now = Date.now()
  const hit = cache.get(path)
  if (hit != null && hit.expMs > now + TTL_SLACK_MS) return hit.url

  const sb = getSupabase()
  if (!sb) return null

  const { data: signed, error } = await sb.storage.from('family-feed-media').createSignedUrl(path, 86_400)
  const pub = sb.storage.from('family-feed-media').getPublicUrl(path).data.publicUrl ?? null

  let url: string | null = null
  let expMs = now + 3_600_000
  if (!error && signed?.signedUrl) {
    url = signed.signedUrl
    expMs = now + Math.floor(86_400 * 1000 * 0.85) // TTL 24h, refresh cache trước khi hết
  } else if (pub) {
    url = pub
    expMs = now + 3_600_000
  }

  if (url) {
    cache.set(path, { url, expMs })
    return url
  }
  return null
}

export function prefetchFamilyFeedMediaDisplayUrls(paths: readonly string[]): void {
  const unique = [...new Set(paths.map((x) => x.trim()).filter(Boolean))]
  if (!unique.length) return
  void Promise.all(unique.map((p) => getFamilyFeedMediaDisplayUrl(p)))
}
