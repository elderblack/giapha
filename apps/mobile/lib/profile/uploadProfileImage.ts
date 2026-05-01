import type { SupabaseClient } from '@supabase/supabase-js'

function extAndMime(uri: string): { ext: string; contentType: string } {
  const lower = uri.split('?')[0]?.toLowerCase() ?? ''
  if (lower.endsWith('.png')) return { ext: 'png', contentType: 'image/png' }
  if (lower.endsWith('.webp')) return { ext: 'webp', contentType: 'image/webp' }
  if (lower.endsWith('.gif')) return { ext: 'gif', contentType: 'image/gif' }
  return { ext: 'jpg', contentType: 'image/jpeg' }
}

/**
 * Upload ảnh local (URI từ ImagePicker) lên bucket `profile-media`, trả URL công khai.
 */
export async function uploadProfileImageFromPickerUri(
  sb: SupabaseClient,
  opts: {
    userId: string
    uri: string
    kind: 'avatar' | 'cover'
    randomId?: string
  },
): Promise<{ publicUrl: string } | { error: string }> {
  const { userId, uri, kind } = opts
  const id = opts.randomId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const { ext, contentType } = extAndMime(uri)
  const path = `${userId}/${kind}-${id}.${ext}`

  try {
    const res = await fetch(uri)
    if (!res.ok) return { error: 'Không đọc được file ảnh.' }
    const buf = await res.arrayBuffer()
    const { error: upErr } = await sb.storage.from('profile-media').upload(path, buf, {
      contentType,
      upsert: true,
    })
    if (upErr) return { error: upErr.message }
    const {
      data: { publicUrl },
    } = sb.storage.from('profile-media').getPublicUrl(path)
    return { publicUrl }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi tải ảnh lên.'
    return { error: msg }
  }
}
