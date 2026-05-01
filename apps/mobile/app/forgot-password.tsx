import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
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
import { APP_DISPLAY_NAME, logoMarkAsset } from '@/constants/brand'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { usePalette } from '@/hooks/usePalette'
import { Font } from '@/theme/typography'

export default function ForgotPasswordScreen() {
  const p = usePalette()
  const router = useRouter()
  const sb = getSupabase()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const redirectTo = useMemo(() => Linking.createURL('/reset-password'), [])

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

  async function onSubmit() {
    setMsg(null)
    const e = email.trim()
    if (!e) {
      setMsg({ kind: 'err', text: 'Nhập email.' })
      return
    }
    setBusy(true)
    const { error } = await sb.auth.resetPasswordForEmail(e, { redirectTo })
    setBusy(false)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    setMsg({
      kind: 'ok',
      text: 'Nếu email có tài khoản, bạn sẽ nhận link đặt lại mật khẩu. Kiểm tra hộp thư và thư mục spam.',
    })
  }

  return (
    <View style={[styles.flex, { backgroundColor: p.canvas }]}>
      <LinearGradient colors={p.scheme === 'dark' ? ['#1f1320', '#0B0F14'] : ['#FFF0F4', '#F4F6F9']} style={styles.gradTop}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBrand}>
            <View style={[styles.logoMark, { padding: 0, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)' }]}>
              <Image source={logoMarkAsset} style={{ width: 58, height: 58 }} contentFit="cover" />
            </View>
            <Text style={[styles.brandTypo, { fontFamily: Font.extraBold }, { color: p.scheme === 'dark' ? p.ink : '#1E0A14' }]}>
              {APP_DISPLAY_NAME}
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
            <Text style={[styles.cardTitle, { color: p.ink, fontFamily: Font.bold }]}>Quên mật khẩu</Text>
            <Text style={[styles.cardSubtitle, { color: p.muted, fontFamily: Font.regular }]}>
              Nhập email đã đăng ký. Bạn sẽ nhận link để đặt mật khẩu mới (mở trong app bằng deep link hoặc trình duyệt tùy thiết bị).
            </Text>

            <TextInput
              style={inputStyle}
              placeholder="Email"
              placeholderTextColor={p.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
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
                <Text style={[styles.primaryBtnText, { fontFamily: Font.bold }]}>Gửi link đặt lại mật khẩu</Text>
              )}
            </Pressable>

            <Pressable style={styles.switchMode} onPress={() => router.replace('/sign-in')} disabled={busy}>
              <Text style={[styles.switchModeText, { color: p.accent }, { fontFamily: Font.semiBold }]}>← Quay lại đăng nhập</Text>
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
  brandTypo: { fontSize: 28, letterSpacing: -1, marginTop: 8 },
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
