import { getSupabase } from './supabase'

/** Avatar nhỏ (feed, chat, cây): ưu tiên thumb trong bucket profile-media. */
export function profileAvatarDisplayUrl(profile: {
  avatar_url: string | null
  avatar_thumb_path?: string | null
}): string | null {
  const thumbPath = profile.avatar_thumb_path?.trim()
  if (thumbPath) {
    const sb = getSupabase()
    if (sb) {
      const u = sb.storage.from('profile-media').getPublicUrl(thumbPath).data.publicUrl
      if (u) return u
    }
  }
  return profile.avatar_url?.trim() || null
}
