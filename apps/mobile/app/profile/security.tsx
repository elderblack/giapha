import FontAwesome from '@expo/vector-icons/FontAwesome'
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
import { normalizeVnPhoneToE164 } from '@/lib/phoneE164'
import { profileAllowsPasswordChange } from '@/lib/profile/profileAllowsPasswordChange'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { Font } from '@/theme/typography'

export default function ProfileSecurityScreen() {
  const p = usePalette()
  const { user } = useAuth()
  const sb = getSupabase()
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const canChange = user ? profileAllowsPasswordChange(user.identities) : false

  const inputStyle = [
    styles.input,
    {
      backgroundColor: p.surfaceElevated,
      borderColor: p.border,
      color: p.ink,
      fontFamily: Font.regular,
    },
  ]

  async function submitPasswordChange() {
    if (!sb || !user) return
    setPwdMsg(null)
    if (!canChange) {
      setPwdMsg({ kind: 'err', text: 'Tài khoản đăng nhập Google không đổi mật khẩu tại đây.' })
      return
    }
    if (!pwdCurrent) {
      setPwdMsg({ kind: 'err', text: 'Nhập mật khẩu hiện tại.' })
      return
    }
    if (pwdNew.length < 6) {
      setPwdMsg({ kind: 'err', text: 'Mật khẩu mới cần ít nhất 6 ký tự.' })
      return
    }
    if (pwdNew !== pwdConfirm) {
      setPwdMsg({ kind: 'err', text: 'Mật khẩu mới và xác nhận không khớp.' })
      return
    }

    setPwdBusy(true)
    let credential: { email: string; password: string } | { phone: string; password: string } | null = null
    if (user.email) {
      credential = { email: user.email, password: pwdCurrent }
    } else if (user.phone) {
      credential = { phone: user.phone, password: pwdCurrent }
    } else {
      const metaPhone =
        typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone.trim() : ''
      const e164 = metaPhone ? normalizeVnPhoneToE164(metaPhone) : null
      if (e164) credential = { phone: e164, password: pwdCurrent }
    }

    if (credential === null) {
      setPwdBusy(false)
      setPwdMsg({ kind: 'err', text: 'Không có email hoặc số điện thoại trên tài khoản để xác nhận.' })
      return
    }

    const { error: verifyErr } = await sb.auth.signInWithPassword(credential)
    if (verifyErr) {
      setPwdBusy(false)
      const low = verifyErr.message.toLowerCase()
      setPwdMsg({
        kind: 'err',
        text:
          low.includes('invalid') || low.includes('credential') ? 'Mật khẩu hiện tại không đúng.' : verifyErr.message,
      })
      return
    }

    const { error: updateErr } = await sb.auth.updateUser({ password: pwdNew })
    setPwdBusy(false)
    if (updateErr) {
      setPwdMsg({ kind: 'err', text: updateErr.message })
      return
    }
    setPwdCurrent('')
    setPwdNew('')
    setPwdConfirm('')
    setPwdMsg({ kind: 'ok', text: 'Đã đổi mật khẩu. Lần sau đăng nhập bằng mật khẩu mới.' })
  }

  if (!hasSupabaseCredentials() || !sb || !user?.id) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.canvas }]} edges={['top', 'bottom']}>
        <Text style={{ fontFamily: Font.medium, color: p.muted, padding: 20 }}>Cần đăng nhập.</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas }} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.body, { paddingBottom: 28 }]}
          style={{ flex: 1 }}
        >
          <Text style={[styles.lead, { color: p.muted, fontFamily: Font.regular }]}>
            Đổi mật khẩu khi bạn đăng nhập bằng email hoặc số điện thoại.
          </Text>

          <View style={[styles.card, { backgroundColor: p.surfaceElevated, borderColor: p.border }]}>
            {canChange ? (
              <>
                <View style={styles.cardHead}>
                  <FontAwesome name="key" size={18} color={p.muted} />
                  <Text style={[styles.cardTitle, { color: p.ink, fontFamily: Font.semiBold }]}>Đổi mật khẩu</Text>
                </View>
                <Text style={[styles.hint, { color: p.muted, fontFamily: Font.regular }]}>
                  Xác nhận mật khẩu hiện tại rồi nhập mật khẩu mới (
                  {user.email ? 'email' : user.phone ? 'số điện thoại' : 'tài khoản'}
                  ).
                </Text>

                <TextInput
                  style={inputStyle}
                  placeholder="Mật khẩu hiện tại"
                  placeholderTextColor={p.muted}
                  value={pwdCurrent}
                  onChangeText={setPwdCurrent}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!pwdBusy}
                />
                <TextInput
                  style={inputStyle}
                  placeholder="Mật khẩu mới"
                  placeholderTextColor={p.muted}
                  value={pwdNew}
                  onChangeText={setPwdNew}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!pwdBusy}
                />
                <TextInput
                  style={inputStyle}
                  placeholder="Nhập lại mật khẩu mới"
                  placeholderTextColor={p.muted}
                  value={pwdConfirm}
                  onChangeText={setPwdConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!pwdBusy}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.submit,
                    { backgroundColor: p.accent, opacity: pwdBusy ? 0.55 : pressed ? 0.92 : 1 },
                  ]}
                  onPress={() => void submitPasswordChange()}
                  disabled={pwdBusy}
                >
                  {pwdBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.submitTxt, { fontFamily: Font.semiBold }]}>Cập nhật mật khẩu</Text>
                  )}
                </Pressable>

                {pwdMsg ? (
                  <Text
                    style={[
                      styles.msg,
                      { fontFamily: Font.medium },
                      pwdMsg.kind === 'err' ? { color: p.danger } : { color: p.success },
                    ]}
                  >
                    {pwdMsg.text}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={[styles.cardTitle, { color: p.ink, fontFamily: Font.semiBold }]}>Mật khẩu</Text>
                <Text style={[styles.hint, { color: p.muted, fontFamily: Font.regular }]}>
                  Bạn đăng nhập bằng Google — không đổi mật khẩu tại đây.
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 12 },
  lead: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 17 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    marginBottom: 10,
  },
  submit: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitTxt: { color: '#FFFFFF', fontSize: 16 },
  msg: { fontSize: 14, marginTop: 12, lineHeight: 20 },
})
