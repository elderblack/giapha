import { getSupabase } from '@/lib/supabase'

/** Bucket feed công khai — URL ổn định (không signed) để cache tốt hơn. */
export async function getFamilyFeedMediaDisplayUrl(storagePath: string): Promise<string | null> {
  const path = storagePath?.trim()
  if (!path) return null
  const sb = getSupabase()
  if (!sb) return null
  return sb.storage.from('family-feed-media').getPublicUrl(path).data.publicUrl ?? null
}

export function prefetchFamilyFeedMediaDisplayUrls(paths: readonly string[]): void {
  const unique = [...new Set(paths.map((x) => x.trim()).filter(Boolean))]
  if (!unique.length) return
  void Promise.all(unique.map((p) => getFamilyFeedMediaDisplayUrl(p)))
}
