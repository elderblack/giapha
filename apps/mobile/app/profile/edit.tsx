import FontAwesome from '@expo/vector-icons/FontAwesome'
import * as ImagePicker from 'expo-image-picker'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { uploadProfileImageFromPickerUri } from '@/lib/profile/uploadProfileImage'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { Font } from '@/theme/typography'

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

export default function ProfileEditScreen() {
  const p = usePalette()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [hometown, setHometown] = useState('')
  const [currentCity, setCurrentCity] = useState('')
  const [occupation, setOccupation] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

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
      return
    }
    const row = data as ProfileRow
    setFullName(row.full_name ?? '')
    setUsername(row.username ?? '')
    setBio(row.bio ?? '')
    setHometown(row.hometown ?? '')
    setCurrentCity(row.current_city ?? '')
    setOccupation(row.occupation ?? '')
    setPhone(row.phone ?? '')
    setAvatarUrl(row.avatar_url ?? null)
    setCoverUrl(row.cover_url ?? null)
  }, [sb, uid])

  useEffect(() => {
    void load()
  }, [load])

  const displayName = useMemo(() => fullName.trim() || 'Thành viên Gia Phả', [fullName])
  const initials = useMemo(() => {
    const n = displayName.trim()
    const parts = n.split(/\s+/)
    const a = parts[0]?.[0]
    const b = parts[parts.length - 1]?.[0]
    if (parts.length > 1 && a && b) return (a + b).toUpperCase()
    return (n[0] ?? '?').toUpperCase()
  }, [displayName])

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
    setAvatarUrl(up.publicUrl)
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
    setCoverUrl(up.publicUrl)
    setMsg({ kind: 'ok', text: 'Đã cập nhật ảnh bìa.' })
  }

  async function saveFields() {
    if (!sb || !uid) return
    const name = fullName.trim()
    if (!name || name.length > 120) {
      Alert.alert('Họ tên', 'Nhập họ tên (tối đa 120 ký tự).')
      return
    }
    if (username.trim().length > 64 || bio.length > 2000) {
      Alert.alert('Kiểm tra', 'Username hoặc giới thiệu vượt giới hạn.')
      return
    }
    setSaving(true)
    setMsg(null)
    const u = username.trim() === '' ? null : username.trim().toLowerCase()
    const { error } = await sb
      .from('profiles')
      .update({
        full_name: name,
        username: u,
        bio: bio.trim() || null,
        hometown: hometown.trim() || null,
        current_city: currentCity.trim() || null,
        occupation: occupation.trim() || null,
        phone: phone.trim() || null,
      })
      .eq('id', uid)
    setSaving(false)
    if (error) {
      setMsg({
        kind: 'err',
        text: error.message.includes('unique') || error.code === '23505' ? 'Username đã được dùng.' : error.message,
      })
      return
    }
    setMsg({ kind: 'ok', text: 'Đã lưu thông tin.' })
  }

  if (!hasSupabaseCredentials() || !sb || !uid) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: p.canvas }]} edges={['top']}>
        <Text style={{ fontFamily: Font.medium, color: p.muted }}>Cần đăng nhập và cấu hình Supabase.</Text>
      </SafeAreaView>
    )
  }

  const placeholderClr = p.muted
  const inputStyle = (extra?: object) => [
    styles.input,
    {
      color: p.ink,
      fontFamily: Font.regular,
    },
    extra,
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas }} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        {loading ? (
          <View style={[styles.center, { flex: 1 }]}>
            <ActivityIndicator size="large" color={p.accent} />
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.pageSub, { color: p.muted, fontFamily: Font.regular }]}>
              Cập nhật ảnh và thông tin hiển thị với dòng họ.
            </Text>

            <View style={[styles.heroCard, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
              <Pressable onPress={() => void pickCover()} disabled={coverBusy} style={styles.coverPress}>
                {coverUrl ? (
                  <Image source={{ uri: coverUrl }} style={styles.coverImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.coverPh, { backgroundColor: p.canvasMuted }]} />
                )}
                <View style={[styles.coverChip, { backgroundColor: p.surfaceElevated, borderColor: p.border }]}>
                  {coverBusy ? (
                    <ActivityIndicator color={p.accent} size="small" />
                  ) : (
                    <>
                      <FontAwesome name="camera" size={14} color={p.accent} />
                      <Text style={{ marginLeft: 6, fontFamily: Font.semiBold, fontSize: 13, color: p.accent }}>
                        Đổi ảnh bìa
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>

              <View style={styles.heroBody}>
                <Pressable
                  onPress={() => void pickAvatar()}
                  disabled={avatarBusy}
                  style={[styles.avatarRing, { borderColor: p.surfaceElevated }]}
                >
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarImg, styles.avatarPh, { backgroundColor: p.accentMuted }]}>
                      <Text style={{ fontFamily: Font.bold, fontSize: 26, color: p.accent }}>{initials}</Text>
                    </View>
                  )}
                  <View style={[styles.avatarCam, { backgroundColor: p.accent }]}>
                    {avatarBusy ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <FontAwesome name="camera" size={12} color="#FFF" />
                    )}
                  </View>
                </Pressable>
                <View style={styles.heroTextCol}>
                  <Text style={[styles.nameTitle, { color: p.ink, fontFamily: Font.bold }]} numberOfLines={2}>
                    {displayName}
                  </Text>
                  {user?.email ? (
                    <Text style={[styles.emailSub, { color: p.muted, fontFamily: Font.regular }]} numberOfLines={1}>
                      {user.email}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {msg ? (
              <View
                style={[
                  styles.msgBanner,
                  { borderColor: p.border, backgroundColor: msg.kind === 'err' ? p.accentMuted : p.canvasMuted },
                ]}
              >
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

            <Text style={[styles.sectionLabel, { color: p.muted, fontFamily: Font.semiBold }]}>Thông tin cá nhân</Text>
            <View style={[styles.formCard, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
              <Field label="Họ và tên" required first />
              <TextInput
                style={inputStyle()}
                placeholder="Họ và tên hiển thị"
                placeholderTextColor={placeholderClr}
                value={fullName}
                onChangeText={setFullName}
                editable={!saving}
                autoCapitalize="words"
              />

              <View style={[styles.inFieldSep, { backgroundColor: p.border }]} />

              <Field label="Username (tuỳ chọn)" />
              <TextInput
                style={inputStyle()}
                placeholder="username"
                placeholderTextColor={placeholderClr}
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase())}
                editable={!saving}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={[styles.inFieldSep, { backgroundColor: p.border }]} />

              <Field label="Giới thiệu" />
              <TextInput
                style={[inputStyle(), styles.textArea]}
                placeholder="Vài dòng về bạn…"
                placeholderTextColor={placeholderClr}
                value={bio}
                onChangeText={setBio}
                editable={!saving}
                multiline
                maxLength={2000}
              />

              <View style={[styles.inFieldSep, { backgroundColor: p.border }]} />

              <Field label="Quê quán" />
              <TextInput
                style={inputStyle()}
                placeholder="Quê quán"
                placeholderTextColor={placeholderClr}
                value={hometown}
                onChangeText={setHometown}
                editable={!saving}
              />

              <View style={[styles.inFieldSep, { backgroundColor: p.border }]} />

              <Field label="Đang sống tại" />
              <TextInput
                style={inputStyle()}
                placeholder="Thành phố / tỉnh"
                placeholderTextColor={placeholderClr}
                value={currentCity}
                onChangeText={setCurrentCity}
                editable={!saving}
              />

              <View style={[styles.inFieldSep, { backgroundColor: p.border }]} />

              <Field label="Nghề nghiệp" />
              <TextInput
                style={inputStyle()}
                placeholder="Nghề nghiệp"
                placeholderTextColor={placeholderClr}
                value={occupation}
                onChangeText={setOccupation}
                editable={!saving}
              />

              <View style={[styles.inFieldSep, { backgroundColor: p.border }]} />

              <Field label="Số điện thoại" />
              <TextInput
                style={inputStyle()}
                placeholder="Số điện thoại"
                placeholderTextColor={placeholderClr}
                value={phone}
                onChangeText={setPhone}
                editable={!saving}
                keyboardType="phone-pad"
              />
            </View>

            <Pressable
              onPress={() => void saveFields()}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: p.accent, opacity: saving ? 0.55 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={[styles.saveBtnTxt, { fontFamily: Font.bold }]}>Lưu thông tin</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Field(props: { label: string; required?: boolean; first?: boolean }) {
  const p = usePalette()
  return (
    <Text
      style={[
        styles.fieldLbl,
        { color: p.muted, fontFamily: Font.semiBold },
        props.first ? styles.fieldLblFirst : null,
      ]}
    >
      {props.label}
      {props.required ? <Text style={{ color: p.danger }}> *</Text> : null}
    </Text>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, alignSelf: 'center', width: '100%', maxWidth: 520, paddingTop: 8, paddingBottom: 28 },
  pageSub: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  heroCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 8,
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 14,
  },
  heroTextCol: { flex: 1, minWidth: 0 },
  coverPress: { width: '100%', height: 132 },
  coverImg: { width: '100%', height: '100%' },
  coverPh: { width: '100%', height: '100%' },
  coverChip: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden' },
  avatarPh: { alignItems: 'center', justifyContent: 'center' },
  avatarCam: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  nameTitle: { fontSize: 20, lineHeight: 26 },
  emailSub: { fontSize: 14, marginTop: 4 },
  msgBanner: { borderRadius: 12, padding: 12, marginBottom: 16, marginTop: 12, borderWidth: StyleSheet.hairlineWidth },
  msg: { fontSize: 14, lineHeight: 20 },
  sectionLabel: { fontSize: 13, marginTop: 20, marginBottom: 10, letterSpacing: 0.4 },
  formCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inFieldSep: { height: StyleSheet.hairlineWidth, marginVertical: 12, marginHorizontal: 2 },
  fieldLbl: { fontSize: 12, marginTop: 4, marginBottom: 8, letterSpacing: 0.35 },
  fieldLblFirst: { marginTop: 0 },
  input: {
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  textArea: { minHeight: 88, textAlignVertical: 'top', paddingTop: 4 },
  saveBtn: { marginTop: 18, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  saveBtnTxt: { color: '#FFFFFF', fontSize: 16 },
})
