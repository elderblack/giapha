import { getSupabase } from '@/lib/supabase'

export function profileAvatarDisplayUrl(profile: {
  avatar_url: string | null
  avatar_thumb_path?: string | null
}): string | null {
  const p = profile.avatar_thumb_path?.trim()
  if (p) {
    const sb = getSupabase()
    if (sb) {
      const u = sb.storage.from('profile-media').getPublicUrl(p).data.publicUrl
      if (u) return u
    }
  }
  return profile.avatar_url?.trim() || null
}

export function profileCoverDisplayUrl(profile: {
  cover_url: string | null
  cover_thumb_path?: string | null
}): string | null {
  const p = profile.cover_thumb_path?.trim()
  if (p) {
    const sb = getSupabase()
    if (sb) {
      const u = sb.storage.from('profile-media').getPublicUrl(p).data.publicUrl
      if (u) return u
    }
  }
  return profile.cover_url?.trim() || null
}
