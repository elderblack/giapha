import { useFocusEffect, useIsFocused } from '@react-navigation/native'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { uploadProfileImageFromPickerUri } from '@/lib/profile/uploadProfileImage'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { Font } from '@/theme/typography'

/** Chiều cao ảnh bìa (~Facebook mobile). */
const COVER_HEIGHT = 196
const AVATAR_SIZE = 108
const AVATAR_RING = 4

type ProfileTab = 'posts' | 'photos' | 'about' | 'account'

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

export default function ProfileScreen() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  const { width: screenW } = useWindowDimensions()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const sb = getSupabase()
  const uid = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [tab, setTab] = useState<ProfileTab>('posts')

  const load = useCallback(async () => {
    if (!sb || !uid) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await sb.from('profiles').select('*').eq('id', uid).single()
    setLoading(false)
    if (error || !data) {
      setMsg({ kind: 'err', text: 'Không tải được hồ sơ.' })
      setProfile(null)
      return
    }
    setProfile(data as ProfileRow)
    setMsg(null)
  }, [sb, uid])

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

  const bioLine = profile?.bio?.trim() ?? ''
  const aboutRows = useMemo(() => {
    if (!profile) return []
    return [
      {
        label: 'Quê quán',
        value: profile.hometown?.trim() || null,
        icon: 'map-marker' as const,
      },
      {
        label: 'Đang sống tại',
        value: profile.current_city?.trim() || null,
        icon: 'home' as const,
      },
      {
        label: 'Nghề nghiệp',
        value: profile.occupation?.trim() || null,
        icon: 'briefcase' as const,
      },
    ].filter((r) => r.value)
  }, [profile])

  async function ensureMediaPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần quyền thư viện ảnh để đổi ảnh.')
      return false
    }
    return true
  }

  async function pickAvatar() {
    if (!sb || !uid) return
    const ok = await ensureMediaPermission()
    if (!ok) return
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.88,
    })
    if (res.canceled || !res.assets[0]?.uri) return
    setAvatarBusy(true)
    setMsg(null)
    const up = await uploadProfileImageFromPickerUri(sb, { userId: uid, uri: res.assets[0].uri, kind: 'avatar' })
    setAvatarBusy(false)
    if ('error' in up) {
      setMsg({ kind: 'err', text: up.error })
      return
    }
    const { error } = await sb.from('profiles').update({ avatar_url: up.publicUrl }).eq('id', uid)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    setProfile((prev) => (prev ? { ...prev, avatar_url: up.publicUrl } : prev))
    setMsg({ kind: 'ok', text: 'Đã cập nhật ảnh đại diện.' })
  }

  async function pickCover() {
    if (!sb || !uid) return
    const ok = await ensureMediaPermission()
    if (!ok) return
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    })
    if (res.canceled || !res.assets[0]?.uri) return
    setCoverBusy(true)
    setMsg(null)
    const up = await uploadProfileImageFromPickerUri(sb, { userId: uid, uri: res.assets[0].uri, kind: 'cover' })
    setCoverBusy(false)
    if ('error' in up) {
      setMsg({ kind: 'err', text: up.error })
      return
    }
    const { error } = await sb.from('profiles').update({ cover_url: up.publicUrl }).eq('id', uid)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    setProfile((prev) => (prev ? { ...prev, cover_url: up.publicUrl } : prev))
    setMsg({ kind: 'ok', text: 'Đã cập nhật ảnh bìa.' })
  }

  const confirmSignOut = useCallback(() => {
    Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại để dùng ứng dụng.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() },
    ])
  }, [signOut])

  if (!hasSupabaseCredentials() || !sb || !uid) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: p.canvas }]} edges={['top']}>
        <Text style={{ fontFamily: Font.medium, color: p.muted }}>Cần đăng nhập và cấu hình Supabase.</Text>
      </SafeAreaView>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { flex: 1, backgroundColor: p.canvas }]} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={p.accent} />
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.center, { flex: 1, backgroundColor: p.canvas, paddingHorizontal: 24 }]} edges={['top']}>
        <Text style={{ fontFamily: Font.medium, color: p.muted, textAlign: 'center' }}>
          {msg?.text ?? 'Không có dữ liệu hồ sơ.'}
        </Text>
      </SafeAreaView>
    )
  }

  const avatarUrl = profile.avatar_url ?? null
  const coverUrl = profile.cover_url ?? null
  const sheetBg = p.surfaceElevated
  const secondaryBtnBg = p.canvasMuted
  const coverCamBg = 'rgba(0,0,0,0.48)'

  const coverTotalH = COVER_HEIGHT + insets.top

  const listHeader = (
    <>
      <View style={{ width: screenW, height: coverTotalH, backgroundColor: p.canvasMuted }}>
        <Pressable onPress={() => void pickCover()} disabled={coverBusy} style={StyleSheet.absoluteFill}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImageFull} resizeMode="cover" />
          ) : (
            <View style={[styles.coverImageFull, { backgroundColor: p.canvasMuted }]} />
          )}
          <View style={[styles.coverCamFab, { backgroundColor: coverCamBg }]}>
            {coverBusy ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <FontAwesome name="camera" size={18} color="#FFF" />
            )}
          </View>
        </Pressable>
      </View>

      <View style={[styles.profileSheet, { backgroundColor: sheetBg }]}>
        <View style={[styles.avatarStage, { marginTop: -(AVATAR_SIZE / 2) - AVATAR_RING }]}>
          <Pressable
            onPress={() => void pickAvatar()}
            disabled={avatarBusy}
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
            <View style={[styles.avatarCamFab, { backgroundColor: p.accent, borderColor: sheetBg }]}>
              {avatarBusy ? <ActivityIndicator color="#FFF" size="small" /> : <FontAwesome name="camera" size={14} color="#FFF" />}
            </View>
          </Pressable>
        </View>

        <Text style={[styles.nameFb, { color: p.ink, fontFamily: Font.bold }]} numberOfLines={3}>
          {displayName}
        </Text>
        {profile.username ? (
          <Text style={[styles.usernameFb, { color: p.muted, fontFamily: Font.regular }]}>@{profile.username}</Text>
        ) : null}
        {user?.email ? (
          <Text style={[styles.emailFb, { color: p.muted, fontFamily: Font.regular }]} numberOfLines={1}>
            {user.email}
          </Text>
        ) : null}

        {bioLine ? (
          <Text style={[styles.bioFb, { color: p.ink, fontFamily: Font.regular }]}>{bioLine}</Text>
        ) : (
          <Text style={[styles.bioHintFb, { color: p.muted, fontFamily: Font.regular }]}>
            Chưa có tiểu sử.{' '}
            <Text onPress={() => router.push('/profile/edit')} style={{ fontFamily: Font.semiBold, color: p.accent }}>
              Thêm ngay
            </Text>
          </Text>
        )}

        <View style={styles.editBtnRow}>
          <Pressable
            onPress={() => router.push('/profile/edit')}
            style={({ pressed }) => [styles.fbSecondaryBtn, { backgroundColor: secondaryBtnBg, opacity: pressed ? 0.92 : 1 }]}
          >
            <FontAwesome name="pencil" size={14} color={p.ink} style={{ marginRight: 8 }} />
            <Text style={[styles.fbSecondaryBtnTxt, { color: p.ink, fontFamily: Font.semiBold }]}>Chỉnh sửa thông tin</Text>
          </Pressable>
        </View>

        {msg ? (
          <View style={[styles.msgBanner, { borderColor: p.border, backgroundColor: msg.kind === 'err' ? p.accentMuted : p.canvasMuted }]}>
            <Text
              style={[
                styles.msg,
                { fontFamily: Font.medium },
                msg.kind === 'err' ? { color: p.danger } : { color: p.success },
              ]}
            >
              {msg.text}
            </Text>
          </View>
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
            { id: 'account' as const, label: 'Tài khoản' },
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
      {tab === 'posts' ? (
        <View style={styles.flexFill}>
          <ProfilePostsTab
            profileUserId={uid}
            viewerUserId={uid}
            showComposer
            displayName={displayName}
            avatarUrl={avatarUrl}
            initials={initials}
            ListHeaderComponent={listHeader}
          />
        </View>
      ) : tab === 'photos' ? (
        <View style={styles.flexFill}>
          <ProfilePhotosTab userId={uid} ListHeaderComponent={listHeader} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          {listHeader}
          <View style={[styles.tabBody, { backgroundColor: p.canvas }]}>
            {tab === 'about' ? (
              <>
                {aboutRows.length === 0 ? (
                  <View style={[styles.detailCard, { backgroundColor: sheetBg, borderColor: p.border }]}>
                    <Text style={[styles.aboutEmpty, { color: p.muted, fontFamily: Font.regular }]}>
                      Chưa có thông tin giới thiệu (quê quán, nơi sống, nghề nghiệp). Cập nhật trong Chỉnh sửa thông tin.
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
              </>
            ) : (
              <View style={[styles.detailCard, { backgroundColor: sheetBg, borderColor: p.border, padding: 0 }]}>
                <Pressable
                  onPress={confirmSignOut}
                  style={({ pressed }) => [styles.accountRow, { opacity: pressed ? 0.75 : 1 }]}
                  accessibilityLabel="Đăng xuất"
                >
                  <View style={[styles.detailIconWrap, { backgroundColor: `${p.danger}18` }]}>
                    <FontAwesome name="sign-out" size={18} color={p.danger} />
                  </View>
                  <Text style={[styles.accountRowTitle, { color: p.danger, fontFamily: Font.semiBold }]}>Đăng xuất</Text>
                  <FontAwesome name="chevron-right" size={14} color={p.muted} />
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      )}
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverImageFull: { width: '100%', height: '100%' },
  coverCamFab: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  avatarCamFab: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  nameFb: { fontSize: 22, textAlign: 'center', lineHeight: 28, marginTop: 8, paddingHorizontal: 8 },
  usernameFb: { fontSize: 15, marginTop: 4, textAlign: 'center' },
  emailFb: { fontSize: 14, marginTop: 2, textAlign: 'center', paddingHorizontal: 12 },
  bioFb: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 },
  bioHintFb: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
  editBtnRow: { width: '100%', maxWidth: 420, marginTop: 14 },
  fbSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    width: '100%',
  },
  fbSecondaryBtnTxt: { fontSize: 15 },
  msgBanner: {
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    alignSelf: 'stretch',
    maxWidth: 420,
    borderWidth: StyleSheet.hairlineWidth,
  },
  msg: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
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
  accountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 14, gap: 12 },
  accountRowTitle: { fontSize: 16, flex: 1 },
})
