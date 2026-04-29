import { Camera, Home, Loader2, MessageCircle, Settings, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { role } from '../design/roles'
import { getSupabase } from '../lib/supabase'
import { ProfileMyPosts } from './ProfileMyPosts'
import { CoverCropModal } from './profile/CoverCropModal'
import { ProfileAboutView } from './profile/ProfileAboutView'
import { ProfilePhotosTab } from './profile/ProfilePhotosTab'

type ProfileRow = {
  id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  hometown: string | null
  current_city: string | null
  occupation: string | null
  phone: string | null
}

export function ProfilePage() {
  const { userId: paramUserId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const sb = getSupabase()

  const profileUserId = paramUserId ?? user?.id ?? null
  const uid = user?.id ?? null
  const isSelf = Boolean(uid && profileUserId && uid === profileUserId)

  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [coverCropSrc, setCoverCropSrc] = useState<string | null>(null)
  const [tab, setTab] = useState<'posts' | 'photos' | 'about'>('posts')
  const [isFriend, setIsFriend] = useState(false)
  const [dmBusy, setDmBusy] = useState(false)

  useEffect(() => {
    if (paramUserId && user?.id && paramUserId === user.id) {
      navigate('/app/profile', { replace: true })
    }
  }, [paramUserId, user?.id, navigate])

  useEffect(() => {
    if (!sb || !uid || !profileUserId || isSelf) {
      setIsFriend(false)
      return
    }
    let mounted = true
    void (async () => {
      const low = uid < profileUserId ? uid : profileUserId
      const high = uid < profileUserId ? profileUserId : uid
      const { data } = await sb
        .from('family_friendships')
        .select('user_low')
        .eq('user_low', low)
        .eq('user_high', high)
        .maybeSingle()
      if (mounted) setIsFriend(Boolean(data))
    })()
    return () => { mounted = false }
  }, [sb, uid, profileUserId, isSelf])

  useEffect(() => {
    if (!profileUserId || !sb) {
      setLoading(false)
      return
    }
    let mounted = true
    setLoadErr(null)
    void (async () => {
      const { data, error } = await sb.from('profiles').select('*').eq('id', profileUserId).single()
      if (!mounted) return
      if (error || !data) {
        setLoadErr(
          error?.code === 'PGRST116'
            ? 'Không tìm thấy hồ sơ hoặc bạn chưa có quyền xem (cần cùng dòng họ).'
            : 'Không tải được hồ sơ.',
        )
        setProfile(null)
        setLoading(false)
        return
      }
      setProfile(data as ProfileRow)
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [profileUserId, sb])

  const headerTitle = profile?.full_name?.trim() || 'Thành viên GiaPhả'
  const bioLine = profile?.bio?.trim()
  const initials = headerTitle.trim()[0]?.toUpperCase() ?? '?'
  const avatarUrl = profile?.avatar_url ?? null
  const coverUrl = profile?.cover_url ?? null

  async function onAvatar(file: File | null) {
    if (!file || !user?.id || !sb || !isSelf) return
    setUploadBusy(true)
    setSaveMsg(null)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safe = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
    const path = `${user.id}/avatar-${crypto.randomUUID()}.${safe}`
    const { error: upErr } = await sb.storage.from('profile-media').upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })
    if (upErr) {
      setSaveMsg(upErr.message)
      setUploadBusy(false)
      return
    }
    const {
      data: { publicUrl },
    } = sb.storage.from('profile-media').getPublicUrl(path)
    const { error: dbErr } = await sb.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setUploadBusy(false)
    if (dbErr) {
      setSaveMsg(dbErr.message)
      return
    }
    setProfile((p) => (p ? { ...p, avatar_url: publicUrl } : p))
    setSaveMsg('Đã cập nhật ảnh đại diện.')
  }

  async function uploadCoverFromCrop(blob: Blob) {
    if (!user?.id || !sb || !isSelf) return
    const revokeUrl = coverCropSrc
    setCoverBusy(true)
    setSaveMsg(null)
    try {
      const path = `${user.id}/cover-${crypto.randomUUID()}.jpg`
      const { error: upErr } = await sb.storage.from('profile-media').upload(path, blob, {
        upsert: true,
        contentType: 'image/jpeg',
      })
      if (upErr) {
        setSaveMsg(upErr.message)
        return
      }
      const {
        data: { publicUrl },
      } = sb.storage.from('profile-media').getPublicUrl(path)
      const { error: dbErr } = await sb
        .from('profiles')
        .update({ cover_url: publicUrl, cover_offset_x: 50, cover_offset_y: 50 })
        .eq('id', user.id)
      if (dbErr) {
        setSaveMsg(dbErr.message)
        return
      }
      setProfile((p) => (p ? { ...p, cover_url: publicUrl } : p))
      setSaveMsg('Đã cập nhật ảnh bìa.')
      if (revokeUrl) URL.revokeObjectURL(revokeUrl)
      setCoverCropSrc(null)
    } finally {
      setCoverBusy(false)
    }
  }

  function openCoverCropFromFile(file: File | undefined) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp|gif)/i.test(file.type)) {
      setSaveMsg('Chỉ chọn ảnh (JPEG, PNG, WebP hoặc GIF).')
      return
    }
    if (coverCropSrc) URL.revokeObjectURL(coverCropSrc)
    setCoverCropSrc(URL.createObjectURL(file))
  }

  async function openDm() {
    if (!sb || !profileUserId || isSelf) return
    setDmBusy(true)
    const { data, error } = await sb.rpc('family_chat_open_dm', { other_user_id: profileUserId })
    setDmBusy(false)
    if (!error && data) navigate(`/app/chat/${data as string}`)
  }

  function closeCoverCropWithoutSave() {
    if (coverBusy) return
    if (coverCropSrc) URL.revokeObjectURL(coverCropSrc)
    setCoverCropSrc(null)
  }

  if (!sb) {
    return <p className="text-sm text-abnb-error">Không kết nối được. Vui lòng thử lại sau.</p>
  }

  if (!user?.id) {
    return <p className={`${role.bodySm} text-abnb-muted`}>Cần đăng nhập để xem hồ sơ.</p>
  }

  if (!profileUserId) {
    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
      </div>
    )
  }

  if (loadErr || !profile) {
    return (
      <div className={`${role.cardQuiet} mx-auto mt-10 max-w-lg rounded-xl border border-abnb-hairlineSoft p-8 text-center`}>
        <p className={`${role.bodySm} m-0 text-abnb-muted`}>{loadErr ?? 'Không có dữ liệu hồ sơ.'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-[100vh] bg-[#f0f2f5] pb-16 pt-2 dark:bg-abnb-canvas">
      <div className="mx-auto w-full max-w-[1016px] px-2 sm:px-4">
        <article className="overflow-hidden rounded-b-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-abnb sm:rounded-xl">
          <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-br from-abnb-primary/15 to-abnb-canvas">
            <div className="relative h-[clamp(11.5rem,calc(12rem+14vw),20rem)] w-full bg-abnb-surfaceSoft sm:h-[21.5rem]">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt=""
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center opacity-[0.45]"
                  style={{
                    backgroundImage:
                      'radial-gradient(700px 200px at 15% -5%, rgba(255,113,113,0.45), transparent 55%), radial-gradient(620px 200px at 92% -5%, rgba(116,98,255,0.38), transparent 48%)',
                  }}
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.22] via-transparent to-transparent" />

              <div className="absolute bottom-3 right-3 z-[2] flex flex-wrap items-center justify-end gap-2">
                <Link
                  to="/app/home"
                  className="inline-flex items-center gap-2 rounded-abnb-md bg-white px-3 py-2 text-[13px] font-semibold text-abnb-ink shadow-md ring-1 ring-black/10 transition-colors hover:bg-[#f0f2f5]"
                >
                  <Home className="h-4 w-4 shrink-0" strokeWidth={2} />
                  Trang nhà
                </Link>
                {isSelf ? (
                  <>
                    <Link
                      to="/app/profile/settings"
                      className="inline-flex items-center gap-2 rounded-abnb-md bg-white px-3 py-2 text-[13px] font-semibold text-abnb-ink shadow-md ring-1 ring-black/10 transition-colors hover:bg-[#f0f2f5]"
                    >
                      <Settings className="h-4 w-4 shrink-0" strokeWidth={2} />
                      Cài đặt
                    </Link>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-abnb-md bg-white px-3 py-2 text-[13px] font-semibold text-abnb-ink shadow-md ring-1 ring-black/10 transition-colors hover:bg-[#f0f2f5]">
                      <Upload className="h-4 w-4 shrink-0" strokeWidth={2} />
                      Ảnh bìa
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={coverBusy || Boolean(coverCropSrc)}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.target.value = ''
                          openCoverCropFromFile(f)
                        }}
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative px-5 pb-2 pt-10 sm:px-8 lg:pb-4">
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
              <div className="relative shrink-0 sm:-mt-20 sm:w-[172px]">
                <div className="group relative mx-auto w-[clamp(11rem,30vw,10.75rem)] sm:mx-0 sm:w-[10.625rem]">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="relative z-[1] aspect-square w-full rounded-full border-[5px] border-abnb-surfaceCard bg-black/5 object-cover shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-black/10 sm:h-[168px] sm:w-[168px]"
                    />
                  ) : (
                    <div className="relative z-[1] flex aspect-square w-full items-center justify-center rounded-full border-[5px] border-abnb-surfaceCard bg-gradient-to-br from-abnb-surfaceSoft to-abnb-hairlineSoft/90 text-[2rem] font-bold uppercase text-abnb-muted shadow-[0_2px_12px_rgba(0,0,0,0.1)] ring-1 ring-black/10 sm:h-[168px] sm:w-[168px] sm:text-[3rem]">
                      {initials}
                    </div>
                  )}
                  {isSelf ? (
                    <label className="absolute inset-0 z-[2] flex cursor-pointer flex-col items-center justify-center rounded-full bg-black/0 transition-colors group-hover:bg-black/35">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/98 text-abnb-ink opacity-0 shadow-md ring-1 ring-black/10 transition-opacity group-hover:opacity-100">
                        {uploadBusy ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Camera className="h-6 w-6" strokeWidth={2} />
                        )}
                      </span>
                      <span className="sr-only">Đổi ảnh đại diện</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={uploadBusy}
                        onChange={(e) => void onAvatar(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0 flex-1 pb-2 text-center sm:pt-2 sm:text-left">
                <h1 className="text-[clamp(1.5rem,4vw,2rem)] font-bold leading-tight tracking-tight text-abnb-ink">
                  {headerTitle}
                </h1>
                {profile.username ? (
                  <p className={`${role.bodySm} mt-1 text-abnb-muted`}>@{profile.username}</p>
                ) : null}
                {bioLine ? (
                  <p className={`${role.bodyMd} mt-2 line-clamp-4 text-abnb-body`}>{bioLine}</p>
                ) : (
                  <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
                    {isSelf ? 'Thêm giới thiệu trong Cài đặt tài khoản.' : 'Chưa có tiểu sử công khai.'}
                  </p>
                )}
                {!isSelf && isFriend && (
                  <button
                    type="button"
                    disabled={dmBusy}
                    onClick={() => void openDm()}
                    className={`${role.btnPrimary} !h-10 !px-5 !text-[13px] mt-3`}
                  >
                    <MessageCircle className="mr-1.5 inline h-4 w-4" strokeWidth={2} />
                    Nhắn tin
                  </button>
                )}
              </div>
            </div>

            <div
              className="mt-4 flex flex-wrap border-t border-abnb-hairlineSoft/90 pt-1"
              role="tablist"
              aria-label="Hồ sơ"
            >
              {(
                [
                  { id: 'posts' as const, label: 'Bài viết' },
                  { id: 'photos' as const, label: 'Ảnh' },
                  { id: 'about' as const, label: 'Giới thiệu' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`relative -mb-px border-b-[3px] px-4 py-3.5 text-[15px] font-semibold transition-colors sm:px-7 ${
                    tab === id
                      ? 'border-abnb-primary text-abnb-primary'
                      : 'border-transparent text-abnb-muted hover:bg-abnb-canvas/80 hover:text-abnb-ink'
                  }`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </article>

        {saveMsg && isSelf ? (
          <p className={`${role.bodySm} mt-4 text-center text-abnb-muted`} role="status">
            {saveMsg}
          </p>
        ) : null}

        <div className="mt-4">
          {tab === 'posts' ? (
            <div className="rounded-xl border border-abnb-hairlineSoft/90 bg-abnb-surfaceCard p-4 shadow-abnb sm:p-6">
              <ProfileMyPosts slim composer={isSelf} userId={profileUserId} />
            </div>
          ) : tab === 'photos' ? (
            <div className="rounded-xl border border-abnb-hairlineSoft/90 bg-abnb-surfaceCard p-4 shadow-abnb sm:p-6">
              <ProfilePhotosTab userId={profileUserId} />
            </div>
          ) : (
            <ProfileAboutView
              profile={{
                full_name: profile.full_name,
                hometown: profile.hometown,
                current_city: profile.current_city,
                occupation: profile.occupation,
              }}
            />
          )}
        </div>
      </div>

      {coverCropSrc && isSelf ? (
        <CoverCropModal
          imageSrc={coverCropSrc}
          busy={coverBusy}
          onCancel={closeCoverCropWithoutSave}
          onConfirm={(blob) => uploadCoverFromCrop(blob)}
        />
      ) : null}
    </div>
  )
}
