import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, MessageCircle, UserPlus, Users } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { getSupabase } from '../lib/supabase'
import { role } from '../design/roles'

type ProfileLite = { id: string; full_name: string; avatar_url: string | null }

export function ConnectionsPage() {
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const navigate = useNavigate()
  const [treeId, setTreeId] = useState<string | null>(null)
  const [treeName, setTreeName] = useState<string | null>(null)
  const [suggested, setSuggested] = useState<ProfileLite[]>([])
  const [pendingIn, setPendingIn] = useState<{ id: string; from_id: string; profiles?: ProfileLite | null }[]>([])
  const [friends, setFriends] = useState<ProfileLite[]>([])
  const [following, setFollowing] = useState<ProfileLite[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!sb || !uid) {
      setLoading(false)
      return
    }
    setErr(null)
    setLoading(true)
    try {
      const { data: roleRow } = await sb
        .from('family_tree_roles')
        .select('family_tree_id')
        .eq('user_id', uid)
        .maybeSingle()

      const fid = (roleRow as { family_tree_id: string } | null)?.family_tree_id ?? null
      setTreeId(fid)

      let others: string[] = []
      if (fid) {
        const { data: tree } = await sb.from('family_trees').select('name').eq('id', fid).maybeSingle()
        setTreeName((tree as { name: string } | null)?.name ?? null)
        const { data: rolesData } = await sb.from('family_tree_roles').select('user_id').eq('family_tree_id', fid)
        others = ((rolesData as { user_id: string }[]) ?? []).map((r) => r.user_id).filter((id) => id !== uid)
      } else {
        setTreeName(null)
      }

      const { data: reqs } = await sb
        .from('family_friend_requests')
        .select('id,from_id,status')
        .eq('to_id', uid)
        .eq('status', 'pending')
      const rawIncoming = (reqs as { id: string; from_id: string }[]) ?? []
      const incomingFromIds = [...new Set(rawIncoming.map((r) => r.from_id))]

      const { data: ship } = await sb
        .from('family_friendships')
        .select('user_low,user_high')
        .or(`user_low.eq.${uid},user_high.eq.${uid}`)

      const friendIds = new Set<string>()
      for (const row of (ship as { user_low: string; user_high: string }[]) ?? []) {
        friendIds.add(row.user_low === uid ? row.user_high : row.user_low)
      }

      const { data: fol } = await sb.from('family_feed_follows').select('following_id').eq('follower_id', uid)
      const fids = ((fol as { following_id: string }[]) ?? []).map((x) => x.following_id)

      const allProfileIds = [...new Set([...others, ...incomingFromIds, ...friendIds, ...fids])]
      const profilesMap = await loadProfiles(sb, allProfileIds)

      setSuggested(
        others
          .map((id) => profilesMap.get(id))
          .filter((p): p is ProfileLite => Boolean(p))
          .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')),
      )

      const incoming = rawIncoming.map((r) => ({
        ...r,
        profiles: profilesMap.get(r.from_id) ?? null,
      }))
      setPendingIn(incoming)

      setFriends(
        [...friendIds]
          .map((id) => profilesMap.get(id))
          .filter((p): p is ProfileLite => Boolean(p))
          .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')),
      )

      setFollowing(
        fids
          .map((id) => profilesMap.get(id))
          .filter((p): p is ProfileLite => Boolean(p))
          .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')),
      )
    } catch {
      setErr('Không tải được dữ liệu kết nối.')
    } finally {
      setLoading(false)
    }
  }, [sb, uid])

  useEffect(() => {
    void load()
  }, [load])

  async function sendFriend(toId: string) {
    if (!sb || !uid || toId === uid) return
    setBusyId(toId)
    setErr(null)
    try {
      const { error } = await sb.from('family_friend_requests').insert({ from_id: uid, to_id: toId })
      if (error?.message?.includes('duplicate') || error?.code === '23505') {
        setErr('Đã gửi hoặc đã có lời mời.')
      } else if (error) {
        setErr(error.message)
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function respondRequest(requestId: string, accept: boolean) {
    if (!sb) return
    setBusyId(requestId)
    try {
      await sb
        .from('family_friend_requests')
        .update({ status: accept ? 'accepted' : 'rejected' })
        .eq('id', requestId)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function toggleFollow(targetId: string, isFollowing: boolean) {
    if (!sb || !uid) return
    setBusyId(`fol-${targetId}`)
    try {
      if (isFollowing) {
        await sb.from('family_feed_follows').delete().eq('follower_id', uid).eq('following_id', targetId)
      } else {
        await sb.from('family_feed_follows').insert({ follower_id: uid, following_id: targetId })
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function openDm(otherUserId: string) {
    if (!sb) return
    setBusyId(`dm-${otherUserId}`)
    try {
      const { data, error } = await sb.rpc('family_chat_open_dm', { other_user_id: otherUserId })
      if (error) {
        setErr(error.message)
        return
      }
      navigate(`/app/chat/${data as string}`)
    } finally {
      setBusyId(null)
    }
  }

  const followingSet = useMemo(() => new Set(following.map((f) => f.id)), [following])
  const friendSet = useMemo(() => new Set(friends.map((f) => f.id)), [friends])

  if (!sb) {
    return <p className={`${role.bodySm} text-abnb-error`}>Không kết nối được. Vui lòng thử lại sau.</p>
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className={`${role.pageHero} animate-fade-up overflow-hidden`}>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
          <span className={`${role.iconTile} !h-14 !w-14`}>
            <Users className="h-7 w-7" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className={role.kicker}>Mạng xã hội</p>
            <h1 className={`${role.headingSection} mt-2`}>Kết nối</h1>
            <p className={`${role.bodySm} mt-3 max-w-prose text-abnb-body`}>
              Gợi ý từ cùng dòng họ; gửi lời mời kết bạn hoặc theo dõi. Phạm vi dòng họ được lấy từ mã thành viên của bạn.
            </p>
          </div>
        </div>
      </div>

      {err ? (
        <p
          className={`${role.bodySm} mt-8 rounded-abnb-lg border border-abnb-error/25 bg-abnb-error/[0.06] px-4 py-3 text-abnb-error`}
        >
          {err}
        </p>
      ) : null}

      {loading ? (
        <div
          className={`${role.cardQuiet} mt-10 flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-abnb-xl border border-abnb-hairlineSoft/85 py-16`}
        >
          <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
          <p className={role.caption}>Đang tải kết nối…</p>
        </div>
      ) : null}

      {!loading && !treeId ? (
        <p
          className={`${role.bodyMd} mt-10 rounded-abnb-xl border-2 border-dashed border-abnb-hairlineSoft bg-abnb-canvas/50 px-8 py-14 text-center text-abnb-muted`}
        >
          Bạn chưa tham gia dòng họ nào — không có gợi ý theo cùng họ.{' '}
          <Link to="/app/trees" className="font-semibold text-abnb-primary no-underline hover:underline">
            Đi tới dòng họ
          </Link>
        </p>
      ) : null}

      {!loading ? (
        <div className="mt-10 space-y-10">
          {treeId ? (
            <section>
              <h2 className={`${role.headingModule} mb-3 flex items-center gap-2`}>
                <UserPlus className="h-4 w-4 text-abnb-primary" />
                Gợi ý (cùng dòng họ{treeName ? `: ${treeName}` : ''})
              </h2>
              {suggested.length === 0 ? (
                <p className={`${role.bodySm} text-abnb-muted`}>Không còn thành viên khác để gợi ý.</p>
              ) : (
                <ul className="space-y-2">
                  {suggested.map((p) => (
                    <li
                      key={p.id}
                      className={`${role.cardQuiet} flex flex-col gap-3 rounded-abnb-lg border border-abnb-hairlineSoft/90 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-abnb-ink">
                          <Link to={`/app/u/${p.id}`} className={`${role.link} no-underline`}>
                            {p.full_name}
                          </Link>
                        </p>
                        <p className={`${role.statLabel} mt-0.5 normal-case`}>
                          {friendSet.has(p.id) ? 'Đã là bạn' : followingSet.has(p.id) ? 'Đang theo dõi' : 'Cùng họ'}
                        </p>
                      </div>
                      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          disabled={busyId === `dm-${p.id}`}
                          className={`${role.btnPrimary} !h-10 w-full !min-h-0 !px-4 !py-0 !text-[13px] !shadow-none hover:!translate-y-0 disabled:cursor-not-allowed sm:w-auto`}
                          onClick={() => void openDm(p.id)}
                        >
                          <MessageCircle className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={2} />
                          Nhắn tin
                        </button>
                        {!friendSet.has(p.id) ? (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            className={`${role.btnSecondary} !h-10 w-full !min-h-0 !px-5 !py-0 !text-[13px] !shadow-none hover:!translate-y-0 disabled:cursor-not-allowed sm:w-auto`}
                            onClick={() => void sendFriend(p.id)}
                          >
                            Kết bạn
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busyId === `fol-${p.id}`}
                          className={`${role.btnSecondary} !h-10 w-full !min-h-0 !px-5 !py-0 !text-[13px] !shadow-none hover:!translate-y-0 disabled:cursor-not-allowed sm:w-auto`}
                          onClick={() => void toggleFollow(p.id, followingSet.has(p.id))}
                        >
                          {followingSet.has(p.id) ? 'Bỏ theo dõi' : 'Theo dõi'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section>
            <h2 className={`${role.headingModule} mb-3`}>Lời mời đến</h2>
            {pendingIn.length === 0 ? (
              <p className={`${role.bodySm} text-abnb-muted`}>Không có lời mời chờ xử lý.</p>
            ) : (
              <ul className="space-y-2">
                {pendingIn.map((r) => (
                  <li
                    key={r.id}
                    className={`${role.cardQuiet} flex flex-col gap-3 rounded-abnb-lg border border-abnb-hairlineSoft/90 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between`}
                  >
                    <span className="min-w-0 font-medium text-abnb-ink">
                      <Link to={`/app/u/${r.from_id}`} className={`${role.link} font-medium no-underline`}>
                        {r.profiles?.full_name ?? 'Thành viên'}
                      </Link>
                    </span>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        className={`${role.btnPrimary} !h-10 w-full !min-h-0 !px-5 !py-0 !text-[13px] !shadow-none hover:!translate-y-0 disabled:cursor-not-allowed sm:w-auto`}
                        onClick={() => void respondRequest(r.id, true)}
                      >
                        Chấp nhận
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        className={`${role.btnSecondary} !h-10 w-full !min-h-0 !px-5 !py-0 !text-[13px] !shadow-none hover:!translate-y-0 disabled:cursor-not-allowed sm:w-auto`}
                        onClick={() => void respondRequest(r.id, false)}
                      >
                        Từ chối
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className={`${role.headingModule} mb-3`}>Bạn bè</h2>
            {friends.length === 0 ? (
              <p className={`${role.bodySm} text-abnb-muted`}>Chưa có kết nối bạn bè đã chấp nhận.</p>
            ) : (
              <ul className="space-y-2">
                {friends.map((p) => (
                  <li
                    key={p.id}
                    className={`${role.cardQuiet} flex flex-col gap-3 rounded-abnb-lg border border-abnb-hairlineSoft/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
                  >
                    <Link
                      to={`/app/u/${p.id}`}
                      className={`${role.link} min-w-0 font-semibold text-abnb-ink no-underline`}
                    >
                      {p.full_name}
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === `dm-${p.id}`}
                      className={`${role.btnSecondary} !h-10 w-full !min-h-0 !px-4 !py-0 !text-[13px] !shadow-none hover:!translate-y-0 disabled:cursor-not-allowed sm:w-auto`}
                      onClick={() => void openDm(p.id)}
                    >
                      <MessageCircle className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={2} />
                      Nhắn tin
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className={`${role.headingModule} mb-3`}>Đang theo dõi</h2>
            {following.length === 0 ? (
              <p className={`${role.bodySm} text-abnb-muted`}>Chưa theo dõi ai.</p>
            ) : (
              <ul className="space-y-2">
                {following.map((p) => (
                  <li
                    key={p.id}
                    className={`${role.cardQuiet} flex flex-col gap-3 rounded-abnb-lg border border-abnb-hairlineSoft/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
                  >
                    <Link
                      to={`/app/u/${p.id}`}
                      className={`${role.link} min-w-0 font-semibold text-abnb-ink no-underline`}
                    >
                      {p.full_name}
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === `fol-${p.id}`}
                      className={`${role.btnSecondary} !h-10 w-full !min-h-0 !px-5 !py-0 !text-[13px] !shadow-none hover:!translate-y-0 disabled:cursor-not-allowed sm:w-auto`}
                      onClick={() => void toggleFollow(p.id, true)}
                    >
                      Bỏ theo dõi
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {treeId ? (
            <p className={`${role.caption}`}>
              Bản tin trên{' '}
              <Link to="/app/home" className={`${role.link} font-semibold`}>
                Trang nhà
              </Link>{' '}
              (menu trên cùng).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

async function loadProfiles(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  ids: string[],
): Promise<Map<string, ProfileLite>> {
  const m = new Map<string, ProfileLite>()
  const uniq = [...new Set(ids)].filter(Boolean)
  if (!uniq.length) return m
  const { data } = await sb.from('profiles').select('id, full_name, avatar_url').in('id', uniq)
  if (data) {
    for (const row of data as ProfileLite[]) {
      m.set(row.id, row)
    }
  }
  return m
}
