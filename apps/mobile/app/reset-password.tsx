import FontAwesome from '@expo/vector-icons/FontAwesome'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
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
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { Font } from '@/theme/typography'

export default function ResetPasswordScreen() {
  const p = usePalette()
  const router = useRouter()
  const { session, loading } = useAuth()
  const sb = getSupabase()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
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

  if (!hasSupabaseCredentials() || !sb) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.canvas }]} edges={['top', 'bottom']}>
        <View style={[styles.heroPad, styles.centerFallback]}>
          <FontAwesome name="exclamation-circle" size={44} color={p.accent} />
          <Text style={[styles.fallbackTitle, { color: p.ink }, { fontFamily: Font.bold }]}>Cần cấu hình Supabase</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: p.canvas }]}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    )
  }

  if (!session) {
    return (
      <View style={[styles.flex, { backgroundColor: p.canvas }]}>
        <LinearGradient colors={p.scheme === 'dark' ? ['#1f1320', '#0B0F14'] : ['#FFF0F4', '#F4F6F9']} style={styles.gradTop}>
          <SafeAreaView edges={['top']}>
            <View style={styles.topBrand}>
              <View style={[styles.logoMark, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                <FontAwesome name="tree" size={30} color="#FFF" />
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={[styles.sheetInner, { flex: 1, justifyContent: 'center' }]}>
          <View style={[styles.card, { backgroundColor: p.surfaceElevated, borderColor: p.border }]}>
            <FontAwesome name="link" size={40} color={p.accent} style={{ alignSelf: 'center' }} />
            <Text style={[styles.cardTitle, { color: p.ink, fontFamily: Font.bold, textAlign: 'center', marginTop: 16 }]}>
              Liên kết không hợp lệ
            </Text>
            <Text style={[styles.cardSubtitle, { color: p.muted, fontFamily: Font.regular, textAlign: 'center' }]}>
              Link đặt lại mật khẩu đã hết hạn hoặc đã dùng. Hãy gửi email mới.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: p.accent, opacity: pressed ? 0.92 : 1 }]}
              onPress={() => router.replace('/forgot-password')}
            >
              <Text style={[styles.primaryBtnText, { fontFamily: Font.bold }]}>Gửi lại email</Text>
            </Pressable>
            <Pressable style={styles.switchMode} onPress={() => router.replace('/sign-in')}>
              <Text style={[styles.switchModeText, { color: p.accent }, { fontFamily: Font.semiBold }]}>Đăng nhập</Text>
            </Pressable>
          </View>
        </View>
      </View>
    )
  }

  async function onSubmit() {
    if (!sb) return
    setMsg(null)
    if (!password) {
      setMsg({ kind: 'err', text: 'Nhập mật khẩu mới.' })
      return
    }
    if (password.length < 6) {
      setMsg({ kind: 'err', text: 'Mật khẩu cần ít nhất 6 ký tự.' })
      return
    }
    if (password !== passwordConfirm) {
      setMsg({ kind: 'err', text: 'Mật khẩu xác nhận không khớp.' })
      return
    }
    setBusy(true)
    const { error } = await sb.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    router.replace('/(tabs)')
  }

  return (
    <View style={[styles.flex, { backgroundColor: p.canvas }]}>
      <LinearGradient colors={p.scheme === 'dark' ? ['#1f1320', '#0B0F14'] : ['#FFF0F4', '#F4F6F9']} style={styles.gradTop}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBrand}>
            <View style={[styles.logoMark, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
              <FontAwesome name="tree" size={30} color="#FFF" />
            </View>
            <Text style={[styles.brandTypo, { fontFamily: Font.extraBold }, { color: p.scheme === 'dark' ? p.ink : '#1E0A14' }]}>
              Đặt mật khẩu mới
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

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
            <Text style={[styles.cardSubtitle, { color: p.muted, fontFamily: Font.regular }]}>
              Nhập mật khẩu mới cho tài khoản của bạn.
            </Text>

            <TextInput
              style={inputStyle}
              placeholder="Mật khẩu mới"
              placeholderTextColor={p.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
            <TextInput
              style={inputStyle}
              placeholder="Nhập lại mật khẩu"
              placeholderTextColor={p.muted}
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry
              autoCapitalize="none"
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
                <Text style={[styles.primaryBtnText, { fontFamily: Font.bold }]}>Lưu mật khẩu</Text>
              )}
            </Pressable>

            <Pressable style={styles.switchMode} onPress={() => router.replace('/sign-in')} disabled={busy}>
              <Text style={[styles.switchModeText, { color: p.accent }, { fontFamily: Font.semiBold }]}>← Về đăng nhập</Text>
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
  gradTop: { paddingBottom: 20 },
  topBrand: { paddingHorizontal: 28, gap: 6 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  brandTypo: { fontSize: 24, letterSpacing: -0.5, marginTop: 8 },
  sheetWrap: { flex: 1, marginTop: -18 },
  sheetInner: {
    flexGrow: 1,
    paddingHorizontal: 20,
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
  switchMode: { marginTop: 18, alignItems: 'center', padding: 14 },
  switchModeText: { fontSize: 15 },
})
