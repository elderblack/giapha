import { getSupabase } from '@/lib/supabase'

type CacheEntry = { url: string; expMs: number }

const cache = new Map<string, CacheEntry>()
const TTL_SLACK_MS = 120_000

export async function getFamilyChatMediaDisplayUrl(storagePath: string): Promise<string | null> {
  const path = storagePath?.trim()
  if (!path) return null

  const now = Date.now()
  const hit = cache.get(path)
  if (hit != null && hit.expMs > now + TTL_SLACK_MS) return hit.url

  const sb = getSupabase()
  if (!sb) return null

  const { data: signed, error } = await sb.storage.from('family-chat-media').createSignedUrl(path, 86_400)
  const pub = sb.storage.from('family-chat-media').getPublicUrl(path).data.publicUrl ?? null

  let url: string | null = null
  let expMs = now + 3_600_000
  if (!error && signed?.signedUrl) {
    url = signed.signedUrl
    expMs = now + Math.floor(86_400 * 1000 * 0.85)
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
