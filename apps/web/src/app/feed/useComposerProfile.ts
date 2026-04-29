import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'

export function useComposerProfile() {
  const { user } = useAuth()
  const sb = getSupabase()
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id || !sb) return
    let cancel = false
    void sb
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancel || error || !data) return
        const row = data as { full_name: string | null; avatar_url: string | null }
        setProfileName(row.full_name?.trim() ?? null)
        setProfileAvatarUrl(row.avatar_url ?? null)
      })
    return () => {
      cancel = true
    }
  }, [user?.id, sb])

  const displayName =
    profileName ??
    user?.email?.split('@')[0]?.trim() ??
    user?.phone ??
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
    'Thành viên'

  return { displayName, avatarUrl: profileAvatarUrl }
}
