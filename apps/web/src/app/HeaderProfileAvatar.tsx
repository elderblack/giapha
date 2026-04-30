import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getSupabase } from '../lib/supabase'

/** Avatar ở header: bấm vào vào trang hồ sơ của mình (thay nút cài đặt). */
export function HeaderProfileAvatar() {
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [initial, setInitial] = useState('?')
  const [profileReady, setProfileReady] = useState(false)

  useEffect(() => {
    if (!sb || !uid) return
    setProfileReady(false)
    let cancel = false
    void sb
      .from('profiles')
      .select('avatar_url,full_name')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancel && data) {
          const row = data as { avatar_url: string | null; full_name: string | null }
          setAvatarUrl(row.avatar_url ?? null)
          const ch = row.full_name?.trim()?.[0]
          setInitial(ch ? ch.toUpperCase() : '?')
        }
        if (!cancel) setProfileReady(true)
      })
    return () => {
      cancel = true
    }
  }, [sb, uid])

  if (!uid) return null

  return (
    <Link
      to="/app/profile"
      className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-abnb-hairlineSoft bg-abnb-canvas text-abnb-ink shadow-abnb-inner transition-colors hover:border-abnb-hairline hover:bg-abnb-surfaceSoft"
      aria-label="Hồ sơ của tôi"
      title="Hồ sơ"
    >
      {!profileReady ? (
        <span
          className="block h-full w-full animate-pulse bg-abnb-hairlineSoft/70"
          aria-hidden
        />
      ) : avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[13px] font-bold uppercase text-abnb-muted">{initial}</span>
      )}
    </Link>
  )
}
