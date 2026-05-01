import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { normalizeVnPhoneToE164 } from '@/lib/phoneE164'
import { Font } from '@/theme/typography'

type Mode = 'signIn' | 'signUp'

/** Ảnh gói trong bundle — tránh lỗi không tải được URL từ mạng (simulator / ATS / CDN). */
const authHeroSource = require('../assets/images/auth-hero.jpg') as number

export default function SignInScreen() {
  const p = usePalette()
  const { height: windowH } = useWindowDimensions()
  const heroHeight = Math.min(Math.round(windowH * 0.38), 340)
  const router = useRouter()
  const { loading: authLoading } = useAuth()
  const sb = getSupabase()

  const [mode, setMode] = useState<Mode>('signIn')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const inputStyle = [
    styles.input,
    {
      backgroundColor: p.surfaceElevated,
      borderColor: p.border,
      color: p.ink,
      fontFamily: Font.regular,
    },
  ]

  const placeholderClr = p.muted

  if (!hasSupabaseCredentials() || !sb) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.canvas }]} edges={['top', 'bottom']}>
        <View style={[styles.heroPad, styles.centerFallback]}>
          <FontAwesome name="exclamation-circle" size={44} color={p.accent} />
          <Text style={[styles.fallbackTitle, { color: p.ink }, { fontFamily: Font.bold }]}>Cần cấu hình Supabase</Text>
          <Text style={[styles.fallbackTxt, { color: p.muted }, { fontFamily: Font.regular }]}>
            Tạo <Text style={{ fontFamily: Font.semiBold, color: p.ink }}>apps/mobile/.env</Text> với{' '}
            <Text style={{ fontFamily: Font.medium, color: p.ink }}>EXPO_PUBLIC_SUPABASE_*</Text> rồi khởi động lại Metro (
            <Text style={{ fontFamily: Font.semiBold }}>pnpm dev:mobile</Text>).
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (authLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: p.canvas }]}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    )
  }

  async function onSubmit() {
    if (!sb) return
    setMsg(null)
    const id = identifier.trim()
    if (!id || !password) {
      setMsg({ kind: 'err', text: 'Nhập email/SĐT và mật khẩu.' })
      return
    }
    setBusy(true)
    if (mode === 'signIn') {
      const hasAt = id.includes('@')
      const e164 = !hasAt ? normalizeVnPhoneToE164(id) : null
      if (!hasAt && !e164) {
        setBusy(false)
        setMsg({
          kind: 'err',
          text: 'Số điện thoại không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678',
        })
        return
      }
      const { error } = hasAt
        ? await sb.auth.signInWithPassword({ email: id, password })
        : await sb.auth.signInWithPassword({ phone: e164!, password })
      setBusy(false)
      if (error) {
        setMsg({ kind: 'err', text: error.message })
        return
      }
      setMsg({ kind: 'ok', text: 'Đăng nhập thành công.' })
      return
    }
    if (!id.includes('@')) {
      setBusy(false)
      setMsg({ kind: 'err', text: 'Đăng ký hiện chỉ hỗ trợ email. Đăng nhập với SĐT nếu đã có tài khoản.' })
      return
    }
    if (password.length < 6) {
      setBusy(false)
      setMsg({ kind: 'err', text: 'Mật khẩu ít nhất 6 ký tự.' })
      return
    }
    const display = name.trim() || 'Thành viên mới'
    const { data, error } = await sb.auth.signUp({
      email: id,
      password,
      options: { data: { full_name: display, name: display } },
    })
    setBusy(false)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    if (data.session) {
      setMsg({ kind: 'ok', text: 'Đã tạo tài khoản và đăng nhập.' })
    } else {
      setMsg({
        kind: 'ok',
        text: 'Đã gửi email xác nhận. Mở link trong thư rồi đăng nhập lại.',
      })
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: p.canvas }]}>
      <View style={[styles.heroContainer, { height: heroHeight }]}>
        <Image
          source={authHeroSource}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={280}
          recyclingKey="auth-hero"
        />
        <LinearGradient
          colors={
            p.scheme === 'dark'
              ? ['rgba(0,0,0,0.28)', 'rgba(11,15,22,0.72)']
              : ['rgba(0,0,0,0.2)', 'rgba(30,10,22,0.58)']
          }
          locations={[0, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['top']} style={styles.heroSafe}>
          <View style={styles.topBrand}>
            <View style={styles.logoMark}>
              <FontAwesome name="tree" size={28} color="#FFF" />
            </View>
            <Text style={[styles.brandTypo, { fontFamily: Font.extraBold, color: '#FFFFFF' }]}>
              Gia Phả
            </Text>
            <Text style={[styles.tags, { fontFamily: Font.medium, color: 'rgba(255,255,255,0.88)' }]}>
              Gìn giữ dòng họ · kết nối thế hệ
            </Text>
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={[styles.sheetWrap, styles.flex]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetInner}
          style={{ flex: 1 }}
        >
          <View style={[styles.card, { backgroundColor: p.surfaceElevated, borderColor: p.border }]}>
            <Text style={[styles.cardTitle, { color: p.ink, fontFamily: Font.bold }]}>
              {mode === 'signIn' ? 'Chào bạn trở lại' : 'Tài khoản mới'}
            </Text>
            <Text style={[styles.cardSubtitle, { color: p.muted, fontFamily: Font.regular }]}>
              {mode === 'signIn'
                ? 'Đăng nhập bằng email hoặc số điện thoại Việt Nam có mật khẩu.'
                : 'Đăng ký bằng email và mật khẩu (ít nhất 6 ký tự).'}
            </Text>

            {mode === 'signUp' ? (
              <TextInput
                style={inputStyle}
                placeholder="Họ tên hiển thị"
                placeholderTextColor={placeholderClr}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!busy}
              />
            ) : null}

            <TextInput
              style={inputStyle}
              placeholder={mode === 'signIn' ? 'Email hoặc SĐT Việt Nam' : 'Email'}
              placeholderTextColor={placeholderClr}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType={mode === 'signIn' ? 'default' : 'email-address'}
              autoCorrect={false}
              editable={!busy}
            />
            <TextInput
              style={inputStyle}
              placeholder="Mật khẩu"
              placeholderTextColor={placeholderClr}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!busy}
            />

            {msg ? (
              <Text
                style={[
                  styles.msg,
                  { fontFamily: Font.medium },
                  msg.kind === 'err' ? { color: p.danger } : { color: p.success },
                ]}
              >
                {msg.text}
              </Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: p.accent, opacity: busy ? 0.55 : pressed ? 0.92 : 1 },
              ]}
              onPress={() => void onSubmit()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.primaryBtnText, { fontFamily: Font.bold }]}>
                  {mode === 'signIn' ? 'Đăng nhập' : 'Đăng ký'}
                </Text>
              )}
            </Pressable>

            {mode === 'signIn' ? (
              <Pressable
                style={styles.forgotRow}
                onPress={() => router.push('/forgot-password')}
                disabled={busy}
                hitSlop={10}
              >
                <Text style={[styles.forgotTxt, { color: p.accent }, { fontFamily: Font.semiBold }]}>Quên mật khẩu?</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.switchMode}
              onPress={() => {
                setMode(mode === 'signIn' ? 'signUp' : 'signIn')
                setMsg(null)
              }}
              disabled={busy}
            >
              <Text style={[styles.switchModeText, { color: p.accent }, { fontFamily: Font.semiBold }]}>
                {mode === 'signIn' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroPad: { paddingHorizontal: 24 },
  centerFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flex: 1,
    paddingBottom: 40,
  },
  fallbackTitle: { fontSize: 22, marginTop: 8, textAlign: 'center' },
  fallbackTxt: { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  heroContainer: {
    width: '100%',
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroSafe: { flex: 1 },
  topBrand: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 28,
    gap: 6,
    justifyContent: 'flex-end',
  },
  logoMark: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  brandTypo: { fontSize: 32, letterSpacing: -0.8, marginTop: 10, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  tags: { fontSize: 15, marginTop: 2, lineHeight: 21 },
  sheetWrap: { flex: 1, marginTop: -22 },
  sheetInner: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 40,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  cardTitle: { fontSize: 22 },
  cardSubtitle: { fontSize: 14, marginTop: 6, marginBottom: 18, lineHeight: 21 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    marginBottom: 11,
  },
  msg: { fontSize: 14, marginBottom: 14, marginTop: -2 },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16 },
  forgotRow: { marginTop: 12, alignItems: 'center', paddingVertical: 6 },
  forgotTxt: { fontSize: 14 },
  switchMode: { marginTop: 10, alignItems: 'center', padding: 14 },
  switchModeText: { fontSize: 15 },
})
