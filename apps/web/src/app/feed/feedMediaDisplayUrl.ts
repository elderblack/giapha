import { getSupabase } from '../../lib/supabase'

/** Bucket tin công khai — URL ổn định để trình duyệt cache hiệu quả (không signed). */
export async function getFamilyFeedMediaDisplayUrl(storagePath: string): Promise<string | null> {
  const path = storagePath?.trim()
  if (!path) return null
  const sb = getSupabase()
  if (!sb) return null
  return sb.storage.from('family-feed-media').getPublicUrl(path).data.publicUrl ?? null
}
