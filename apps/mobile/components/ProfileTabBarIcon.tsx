import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'

import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { getSupabase } from '@/lib/supabase'
import { Font } from '@/theme/typography'

const SZ = 28

export function ProfileTabBarIcon({ focused }: { focused: boolean }) {
  const p = usePalette()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const [fullName, setFullName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!sb || !uid) {
      setFullName(null)
      setAvatarUrl(null)
      return
    }
    const { data, error } = await sb.from('profiles').select('full_name, avatar_url').eq('id', uid).maybeSingle()
    if (error || !data) {
      setFullName(null)
      setAvatarUrl(null)
      return
    }
    setFullName(typeof (data as { full_name?: string }).full_name === 'string' ? (data as { full_name: string }).full_name : null)
    setAvatarUrl(typeof (data as { avatar_url?: string | null }).avatar_url === 'string' ? (data as { avatar_url: string }).avatar_url : null)
  }, [sb, uid])

  useEffect(() => {
    void load()
  }, [load])

  const initials = useMemo(() => {
    const n = fullName?.trim() ?? user?.email ?? '?'
    const parts = n.split(/\s+/)
    const a = parts[0]?.[0]
    const b = parts[parts.length - 1]?.[0]
    if (parts.length > 1 && a && b) return (a + b).toUpperCase()
    return (n[0] ?? '?').toUpperCase()
  }, [fullName, user?.email])

  const ring = focused ? p.accent : p.border

  return (
    <View style={[styles.shell, { borderColor: ring, borderWidth: focused ? 2 : StyleSheet.hairlineWidth }]}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.img} accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient colors={[p.accent, '#C026D3']} style={styles.img} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}>
          <Text style={[styles.ini, { fontFamily: Font.bold }]} accessibilityLabel={`Hồ sơ ${initials}`}>
            {initials}
          </Text>
        </LinearGradient>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    width: SZ,
    height: SZ,
    borderRadius: SZ / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  ini: { fontSize: 11, color: '#FFF' },
})
