import { useFocusEffect, useIsFocused } from '@react-navigation/native'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { ProfilePhotosTab } from '@/components/profile/ProfilePhotosTab'
import { ProfilePostsTab } from '@/components/profile/ProfilePostsTab'
import { Text } from '@/components/Themed'
import { FloatingBackOverMedia } from '@/components/navigation/AppStackHeader'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { Font } from '@/theme/typography'

const COVER_HEIGHT = 196
const AVATAR_SIZE = 108
const AVATAR_RING = 4

type ProfileTab = 'posts' | 'photos' | 'about'

type ProfileRow = {
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

export default function PublicProfileScreen() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  const { width: screenW } = useWindowDimensions()
  const router = useRouter()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id ?? null

  const raw = useLocalSearchParams<{ userId?: string | string[] }>()
  const profileUserId =
    typeof raw.userId === 'string' ? raw.userId : Array.isArray(raw.userId) ? raw.userId[0] : undefined

  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [tab, setTab] = useState<ProfileTab>('posts')
  const [dmBusy, setDmBusy] = useState(false)
  const [dmMsg, setDmMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!uid || !profileUserId) return
    if (uid === profileUserId) {
      router.replace('/(tabs)/profile')
    }
  }, [uid, profileUserId, router])

  const load = useCallback(async () => {
    if (!sb || !profileUserId || !uid) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadErr(null)
    const { data, error } = await sb.from('profiles').select('*').eq('id', profileUserId).single()
    setLoading(false)
    if (error || !data) {
      setLoadErr(
        error?.code === 'PGRST116'
          ? 'Không tìm thấy hồ sơ hoặc bạn chưa có quyền xem (cần cùng dòng họ).'
          : 'Không tải được hồ sơ.',
      )
      setProfile(null)
      return
    }
    setProfile(data as ProfileRow)
  }, [sb, profileUserId, uid])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const displayName = useMemo(
    () => profile?.full_name?.trim() || 'Thành viên Gia Phả',
    [profile?.full_name],
  )
  const initials = useMemo(() => {
    const n = displayName.trim()
    const parts = n.split(/\s+/)
    const a = parts[0]?.[0]
    const b = parts[parts.length - 1]?.[0]
    if (parts.length > 1 && a && b) return (a + b).toUpperCase()
    return (n[0] ?? '?').toUpperCase()
  }, [displayName])

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)')
  }, [router])

  const bioLine = profile?.bio?.trim() ?? ''
  const aboutRows = useMemo(() => {
    if (!profile) return []
    return [
      { label: 'Quê quán', value: profile.hometown?.trim() || null, icon: 'map-marker' as const },
      { label: 'Đang sống tại', value: profile.current_city?.trim() || null, icon: 'home' as const },
      { label: 'Nghề nghiệp', value: profile.occupation?.trim() || null, icon: 'briefcase' as const },
    ].filter((r) => r.value)
  }, [profile])

  async function openDm() {
    if (!sb || !profileUserId || !uid) return
    setDmBusy(true)
    setDmMsg(null)
    const { data, error } = await sb.rpc('family_chat_open_dm', { other_user_id: profileUserId })
    setDmBusy(false)
    if (error) {
      setDmMsg(
        error.message?.includes('not_eligible') || error.message?.includes('not_friends')
          ? 'Không thể nhắn tin. Chỉ mở được với người cùng dòng họ hoặc bạn bè.'
          : error.message,
      )
      return
    }
    if (data) router.push(`/chat/${data as string}`)
  }

  if (!hasSupabaseCredentials() || !sb || !uid) {
    return (
      <View style={{ flex: 1, backgroundColor: p.canvas }}>
        <SafeAreaView style={[styles.center, { flex: 1 }]} edges={['top']}>
          <Text style={{ fontFamily: Font.medium, color: p.muted }}>Cần đăng nhập và cấu hình Supabase.</Text>
        </SafeAreaView>
        <FloatingBackOverMedia topOffset={insets.top} iconColor={p.accent} onPress={goBack} />
      </View>
    )
  }

  if (!profileUserId) {
    return (
      <View style={{ flex: 1, backgroundColor: p.canvas }}>
        <SafeAreaView style={[styles.center, { flex: 1 }]} edges={['top']}>
          <Text style={{ fontFamily: Font.medium, color: p.muted }}>Thiếu mã hồ sơ.</Text>
        </SafeAreaView>
        <FloatingBackOverMedia topOffset={insets.top} iconColor={p.accent} onPress={goBack} />
      </View>
    )
  }

  if (uid === profileUserId) {
    return (
      <View style={{ flex: 1, backgroundColor: p.canvas }}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={p.accent} />
        </View>
        <FloatingBackOverMedia topOffset={insets.top} iconColor={p.accent} onPress={goBack} />
      </View>
    )
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: p.canvas }}>
        <SafeAreaView style={[styles.center, { flex: 1 }]} edges={['left', 'right']}>
          <ActivityIndicator size="large" color={p.accent} />
        </SafeAreaView>
        <FloatingBackOverMedia topOffset={insets.top} iconColor={p.accent} onPress={goBack} />
      </View>
    )
  }

  if (loadErr || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: p.canvas }}>
        <SafeAreaView style={[styles.center, { flex: 1, paddingHorizontal: 24 }]} edges={['top']}>
          <Text style={{ fontFamily: Font.medium, color: p.muted, textAlign: 'center' }}>
            {loadErr ?? 'Không có dữ liệu hồ sơ.'}
          </Text>
        </SafeAreaView>
        <FloatingBackOverMedia topOffset={insets.top} iconColor={p.accent} onPress={goBack} />
      </View>
    )
  }

  const avatarUrl = profile.avatar_url ?? null
  const coverUrl = profile.cover_url ?? null
  const sheetBg = p.surfaceElevated
  const coverTotalH = COVER_HEIGHT + insets.top

  const listHeader = (
    <>
      <View style={{ width: screenW, height: coverTotalH, backgroundColor: p.canvasMuted }}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.coverImageFull} resizeMode="cover" />
        ) : (
          <View style={[styles.coverImageFull, { backgroundColor: p.canvasMuted }]} />
        )}
      </View>

      <View style={[styles.profileSheet, { backgroundColor: sheetBg }]}>
        <View style={[styles.avatarStage, { marginTop: -(AVATAR_SIZE / 2) - AVATAR_RING }]}>
          <View
            style={[
              styles.avatarOuter,
              {
                width: AVATAR_SIZE + AVATAR_RING * 2,
                height: AVATAR_SIZE + AVATAR_RING * 2,
                borderRadius: (AVATAR_SIZE + AVATAR_RING * 2) / 2,
                borderColor: sheetBg,
                backgroundColor: sheetBg,
              },
            ]}
          >
            <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, overflow: 'hidden' }}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} resizeMode="cover" />
              ) : (
                <View style={[styles.avatarPhInner, { width: AVATAR_SIZE, height: AVATAR_SIZE, backgroundColor: p.accentMuted }]}>
                  <Text style={{ fontFamily: Font.bold, fontSize: 34, color: p.accent }}>{initials}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <Text style={[styles.nameFb, { color: p.ink, fontFamily: Font.bold }]} numberOfLines={3}>
          {displayName}
        </Text>
        {profile.username ? (
          <Text style={[styles.usernameFb, { color: p.muted, fontFamily: Font.regular }]}>@{profile.username}</Text>
        ) : null}

        {bioLine ? (
          <Text style={[styles.bioFb, { color: p.ink, fontFamily: Font.regular }]}>{bioLine}</Text>
        ) : (
          <Text style={[styles.bioHintFb, { color: p.muted, fontFamily: Font.regular }]}>Chưa có tiểu sử công khai.</Text>
        )}

        <Pressable
          onPress={() => void openDm()}
          disabled={dmBusy}
          style={({ pressed }) => [
            styles.dmBtn,
            { backgroundColor: p.accent, opacity: dmBusy ? 0.55 : pressed ? 0.88 : 1 },
          ]}
        >
          {dmBusy ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <FontAwesome name="comment" size={15} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={[styles.dmBtnTxt, { fontFamily: Font.bold }]}>Nhắn tin</Text>
            </>
          )}
        </Pressable>

        {dmMsg ? (
          <Text style={[styles.dmErr, { color: p.danger, fontFamily: Font.medium }]}>{dmMsg}</Text>
        ) : null}
      </View>

      <View style={[styles.sectionBar, { backgroundColor: p.canvasMuted }]} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={[styles.tabScroll, { backgroundColor: sheetBg, borderBottomColor: p.border }]}
        contentContainerStyle={styles.tabScrollContent}
      >
        {(
          [
            { id: 'posts' as const, label: 'Bài viết' },
            { id: 'photos' as const, label: 'Ảnh' },
            { id: 'about' as const, label: 'Giới thiệu' },
          ] as const
        ).map(({ id, label }) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[
              styles.tabCell,
              tab === id ? { borderBottomColor: p.accent } : { borderBottomColor: 'transparent' },
            ]}
          >
            <Text style={[styles.tabLabel, { fontFamily: Font.semiBold, color: tab === id ? p.accent : p.muted }]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  )

  return (
    <>
      {isFocused ? <StatusBar style="light" translucent /> : null}
      <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas }} edges={['left', 'right']}>
        <View style={styles.flexFill}>
          {tab === 'posts' && profileUserId ? (
            <ProfilePostsTab
              profileUserId={profileUserId}
              viewerUserId={uid}
              showComposer={false}
              displayName={displayName}
              avatarUrl={avatarUrl}
              initials={initials}
              ListHeaderComponent={listHeader}
            />
          ) : tab === 'photos' && profileUserId ? (
            <ProfilePhotosTab userId={profileUserId} ListHeaderComponent={listHeader} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
            >
              {listHeader}
              <View style={[styles.tabBody, { backgroundColor: p.canvas }]}>
                {aboutRows.length === 0 ? (
                  <View style={[styles.detailCard, { backgroundColor: sheetBg, borderColor: p.border }]}>
                    <Text style={[styles.aboutEmpty, { color: p.muted, fontFamily: Font.regular }]}>
                      Chưa có thông tin giới thiệu công khai.
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.detailCard, { backgroundColor: sheetBg, borderColor: p.border }]}>
                    {aboutRows.map((row, i) => (
                      <View key={row.label}>
                        {i > 0 ? <View style={[styles.detailSep, { backgroundColor: p.border }]} /> : null}
                        <View style={styles.detailRow}>
                          <View style={[styles.detailIconWrap, { backgroundColor: p.canvasMuted }]}>
                            <FontAwesome name={row.icon} size={18} color={p.muted} />
                          </View>
                          <View style={styles.detailTextCol}>
                            <Text style={[styles.detailLabel, { color: p.muted, fontFamily: Font.medium }]}>{row.label}</Text>
                            <Text style={[styles.detailValue, { color: p.ink, fontFamily: Font.regular }]}>{row.value}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
          <FloatingBackOverMedia topOffset={insets.top} iconColor={p.accent} onPress={goBack} />
        </View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverImageFull: { width: '100%', height: '100%' },
  profileSheet: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  avatarStage: { alignItems: 'center' },
  avatarOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: AVATAR_RING,
  },
  avatarPhInner: { alignItems: 'center', justifyContent: 'center' },
  nameFb: { fontSize: 22, textAlign: 'center', lineHeight: 28, marginTop: 8, paddingHorizontal: 8 },
  usernameFb: { fontSize: 15, marginTop: 4, textAlign: 'center' },
  bioFb: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 },
  bioHintFb: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
  dmBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    maxWidth: 420,
  },
  dmBtnTxt: { color: '#FFF', fontSize: 16 },
  dmErr: { marginTop: 10, textAlign: 'center', fontSize: 14, paddingHorizontal: 12 },
  sectionBar: { height: 10, width: '100%' },
  tabScroll: {
    maxHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabScrollContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 4,
  },
  tabCell: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderBottomWidth: 3,
  },
  tabLabel: { fontSize: 14 },
  tabBody: { paddingHorizontal: 12, paddingTop: 12 },
  detailCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  aboutEmpty: { padding: 18, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  detailSep: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  detailIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextCol: { flex: 1, minWidth: 0 },
  detailLabel: { fontSize: 12, marginBottom: 2 },
  detailValue: { fontSize: 16, lineHeight: 22 },
})
