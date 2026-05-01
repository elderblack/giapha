import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Stack, useRouter } from 'expo-router'
import type { ComponentProps, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'

import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { getSupabase } from '@/lib/supabase'
import { Font } from '@/theme/typography'

type ProfileLite = { id: string; full_name: string; avatar_url: string | null }

export default function ConnectionsScreen() {
  const router = useRouter()
  const p = usePalette()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id

  const [treeId, setTreeId] = useState<string | null>(null)
  const [treeName, setTreeName] = useState<string | null>(null)
  const [suggested, setSuggested] = useState<ProfileLite[]>([])
  const [pendingIn, setPendingIn] = useState<{ id: string; from_id: string; profiles?: ProfileLite | null }[]>([])
  const [friends, setFriends] = useState<ProfileLite[]>([])
  const [following, setFollowing] = useState<ProfileLite[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pullBusy, setPullBusy] = useState(false)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!sb || !uid) {
      setLoading(false)
      return
    }
    const silent = opts?.silent === true
    setErr(null)
    if (!silent) setLoading(true)
    try {
      const { data: roleRow } = await sb.from('family_tree_roles').select('family_tree_id').eq('user_id', uid).maybeSingle()

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

      const { data: reqs } = await sb.from('family_friend_requests').select('id,from_id,status').eq('to_id', uid).eq('status', 'pending')
      const rawIncoming = (reqs as { id: string; from_id: string }[]) ?? []
      const incomingFromIds = [...new Set(rawIncoming.map((r) => r.from_id))]

      const { data: ship } = await sb.from('family_friendships').select('user_low,user_high').or(`user_low.eq.${uid},user_high.eq.${uid}`)

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
          .filter((x): x is ProfileLite => Boolean(x))
          .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')),
      )

      const incoming = rawIncoming.map((r) => ({
        ...r,
        profiles: profilesMap.get(r.from_id) ?? null,
      }))
      setPendingIn(incoming)

      setFriends(
        [...friendIds].map((id) => profilesMap.get(id)).filter((x): x is ProfileLite => Boolean(x)).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')),
      )

      setFollowing(fids.map((id) => profilesMap.get(id)).filter((x): x is ProfileLite => Boolean(x)).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')))
    } catch {
      setErr('Không tải được dữ liệu kết nối.')
    } finally {
      if (!silent) setLoading(false)
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
      await load({ silent: true })
    } finally {
      setBusyId(null)
    }
  }

  async function respondRequest(requestId: string, accept: boolean) {
    if (!sb) return
    setBusyId(requestId)
    try {
      await sb.from('family_friend_requests').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', requestId)
      await load({ silent: true })
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
      await load({ silent: true })
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
        Alert.alert('Không mở được tin nhắn', error.message)
        return
      }
      router.push(`/chat/${String(data)}`)
    } finally {
      setBusyId(null)
    }
  }

  const followingSet = useMemo(() => new Set(following.map((f) => f.id)), [following])
  const friendSet = useMemo(() => new Set(friends.map((f) => f.id)), [friends])

  if (!sb || !uid) {
    return (
      <View style={[styles.center, { backgroundColor: p.canvas }]}>
        <Text style={{ color: p.muted, fontFamily: Font.medium }}>Cần đăng nhập để xem kết nối.</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Kết nối', headerBackTitle: 'Lại', headerTintColor: p.accent }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: p.canvas }}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={pullBusy}
            onRefresh={() => {
              setPullBusy(true)
              void load({ silent: true }).finally(() => setPullBusy(false))
            }}
            tintColor={p.accent}
          />
        }
      >
        <Text style={[styles.intro, { color: p.muted, fontFamily: Font.regular }]}>
          Gợi ý từ cùng dòng họ; kết bạn và theo dõi như trên web.
        </Text>

        {err ? (
          <View style={[styles.errBox, { borderColor: p.border, backgroundColor: p.accentMuted }]}>
            <Text style={[styles.errTxt, { color: p.danger, fontFamily: Font.medium }]}>{err}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={p.accent} size="large" />
            <Text style={{ marginTop: 12, fontFamily: Font.medium, color: p.muted }}>Đang tải kết nối…</Text>
          </View>
        ) : null}

        {!loading && !treeId ? (
          <View style={[styles.box, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
            <FontAwesome name="link" size={28} color={p.accent} />
            <Text style={[styles.boxTitle, { color: p.ink, fontFamily: Font.bold }]}>Chưa có dòng họ</Text>
            <Text style={[styles.boxTxt, { color: p.muted, fontFamily: Font.regular }]}>
              Tab Dòng họ: dán mã mời UUID hoặc tạo dòng họ mới để vào không gian, rồi quay lại tab Kết nối để xem gợi ý
              cùng họ.
            </Text>
            <Pressable onPress={() => router.push('/trees')} style={[styles.linkBtn, { backgroundColor: p.accentMuted }]}>
              <Text style={{ fontFamily: Font.semiBold, color: p.accent }}>Mở tab Dòng họ</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && treeId ? (
          <Section title={`Gợi ý (${treeName ?? 'cùng họ'})`} icon="user-plus">
            {suggested.length === 0 ? (
              <Muted p={p}>Không còn thành viên khác để gợi ý.</Muted>
            ) : (
              suggested.map((prof) => (
                <ProfileRow
                  key={prof.id}
                  profile={prof}
                  subtitle={
                    friendSet.has(prof.id) ? 'Đã là bạn' : followingSet.has(prof.id) ? 'Đang theo dõi' : 'Cùng họ'
                  }
                  trailing={
                    <>
                      <SmallBtn
                        label="Nhắn tin"
                        icon="comment-o"
                        onPress={() => void openDm(prof.id)}
                        disabled={busyId === `dm-${prof.id}`}
                        p={p}
                      />
                      {!friendSet.has(prof.id) ? (
                        <SmallBtn label="Kết bạn" onPress={() => void sendFriend(prof.id)} disabled={busyId === prof.id} p={p} />
                      ) : null}
                      <SmallBtn
                        label={followingSet.has(prof.id) ? 'Bỏ theo dõi' : 'Theo dõi'}
                        onPress={() => void toggleFollow(prof.id, followingSet.has(prof.id))}
                        disabled={busyId === `fol-${prof.id}`}
                        outline
                        p={p}
                      />
                    </>
                  }
                  p={p}
                />
              ))
            )}
          </Section>
        ) : null}

        {!loading ? (
          <>
            <Section title="Lời mời đến" icon="inbox">
              {pendingIn.length === 0 ? (
                <Muted p={p}>Không có lời mời chờ.</Muted>
              ) : (
                pendingIn.map((r) => (
                  <View key={r.id} style={[styles.rowCard, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
                    <Avatar profile={r.profiles} fallback={r.from_id.slice(0, 2)} p={p} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.name, { color: p.ink, fontFamily: Font.bold }]} numberOfLines={1}>
                        {r.profiles?.full_name ?? 'Thành viên'}
                      </Text>
                    </View>
                    <Pressable
                      disabled={busyId === r.id}
                      onPress={() => void respondRequest(r.id, true)}
                      style={[styles.miniPrimary, { backgroundColor: p.accent, opacity: busyId === r.id ? 0.5 : 1 }]}
                    >
                      <Text style={{ color: '#FFF', fontFamily: Font.semiBold, fontSize: 13 }}>Chấp nhận</Text>
                    </Pressable>
                    <Pressable
                      disabled={busyId === r.id}
                      onPress={() => void respondRequest(r.id, false)}
                      style={[styles.miniOutline, { borderColor: p.border }]}
                    >
                      <Text style={{ fontFamily: Font.medium, fontSize: 13, color: p.muted }}>Từ chối</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </Section>

            <Section title="Bạn bè" icon="users">
              {friends.length === 0 ? (
                <Muted p={p}>Chưa có kết nối bạn bè.</Muted>
              ) : (
                friends.map((prof) => (
                  <ProfileRow
                    key={prof.id}
                    profile={prof}
                    subtitle="Bạn bè"
                    trailing={
                      <SmallBtn
                        label="Nhắn tin"
                        icon="comment-o"
                        onPress={() => void openDm(prof.id)}
                        disabled={busyId === `dm-${prof.id}`}
                        p={p}
                      />
                    }
                    p={p}
                  />
                ))
              )}
            </Section>

            <Section title="Đang theo dõi" icon="eye">
              {following.length === 0 ? (
                <Muted p={p}>Chưa theo dõi ai.</Muted>
              ) : (
                following.map((prof) => (
                  <ProfileRow
                    key={prof.id}
                    profile={prof}
                    subtitle="Đang theo dõi"
                    trailing={
                      <SmallBtn
                        label="Bỏ theo dõi"
                        onPress={() => void toggleFollow(prof.id, true)}
                        disabled={busyId === `fol-${prof.id}`}
                        outline
                        p={p}
                      />
                    }
                    p={p}
                  />
                ))
              )}
            </Section>
          </>
        ) : null}

        <View style={{ height: 12 }} />
      </ScrollView>
    </>
  )
}

function Section(props: { title: string; icon: ComponentProps<typeof FontAwesome>['name']; children: ReactNode }) {
  const p = usePalette()
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <FontAwesome name={props.icon} size={16} color={p.accent} />
        <Text style={[styles.sectionTitle, { color: p.ink, fontFamily: Font.bold }]}>{props.title}</Text>
      </View>
      {props.children}
    </View>
  )
}

function Muted({ children, p }: { children: string; p: ReturnType<typeof usePalette> }) {
  return (
    <Text style={{ fontFamily: Font.regular, color: p.muted, fontSize: 14, marginBottom: 4 }}>{children}</Text>
  )
}

function Avatar({
  profile,
  fallback,
  p,
}: {
  profile: ProfileLite | null | undefined
  fallback: string
  p: ReturnType<typeof usePalette>
}) {
  if (profile?.avatar_url) {
    return <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
  }
  return (
    <View style={[styles.avatar, styles.avatarPh, { backgroundColor: p.accentMuted }]}>
      <Text style={{ fontFamily: Font.bold, color: p.accent, fontSize: 13 }}>{fallback.toUpperCase()}</Text>
    </View>
  )
}

function ProfileRow(props: {
  profile: ProfileLite
  subtitle: string
  trailing: ReactNode
  p: ReturnType<typeof usePalette>
}) {
  const { profile, subtitle, trailing, p } = props
  const router = useRouter()
  const initials = profile.full_name
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const goProfile = () => router.push(`/profile/${profile.id}`)
  return (
    <View style={[styles.rowCard, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
      <Pressable onPress={goProfile} accessibilityRole="button" accessibilityLabel={`Hồ sơ ${profile.full_name}`}>
        <Avatar profile={profile} fallback={initials || '?'} p={p} />
      </Pressable>
      <Pressable onPress={goProfile} style={{ flex: 1, minWidth: 0 }} accessibilityRole="button" accessibilityLabel={`Hồ sơ ${profile.full_name}`}>
        <Text style={[styles.name, { color: p.ink, fontFamily: Font.bold }]} numberOfLines={1}>
          {profile.full_name}
        </Text>
        <Text style={{ fontFamily: Font.regular, fontSize: 12, color: p.muted, marginTop: 2 }}>{subtitle}</Text>
      </Pressable>
      <View style={styles.btns}>{trailing}</View>
    </View>
  )
}

function SmallBtn(props: {
  label: string
  icon?: ComponentProps<typeof FontAwesome>['name']
  onPress: () => void
  disabled?: boolean
  outline?: boolean
  p: ReturnType<typeof usePalette>
}) {
  const { label, icon, onPress, disabled, outline, p } = props
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.smallBtn,
        outline
          ? { borderWidth: StyleSheet.hairlineWidth, borderColor: p.border, backgroundColor: 'transparent' }
          : { backgroundColor: p.accent },
        { opacity: disabled ? 0.45 : 1 },
      ]}
    >
      {icon ? <FontAwesome name={icon} size={12} color={outline ? p.accent : '#FFF'} style={{ marginRight: 6 }} /> : null}
      <Text style={{ fontFamily: Font.semiBold, fontSize: 12.5, color: outline ? p.accent : '#FFF' }}>{label}</Text>
    </Pressable>
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 14 },
  errBox: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginBottom: 14 },
  errTxt: { fontSize: 13 },
  loader: { alignItems: 'center', paddingVertical: 32 },
  box: { padding: 20, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', marginBottom: 20 },
  boxTitle: { marginTop: 10, fontSize: 17 },
  boxTxt: { marginTop: 8, textAlign: 'center', lineHeight: 22 },
  linkBtn: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  section: { marginBottom: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 17 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPh: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16 },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', maxWidth: 200 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  miniPrimary: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  miniOutline: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
