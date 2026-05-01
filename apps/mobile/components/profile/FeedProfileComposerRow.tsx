import FontAwesome from '@expo/vector-icons/FontAwesome'
import { LinearGradient } from 'expo-linear-gradient'
import { Image, Pressable, StyleSheet, View } from 'react-native'

import { Text } from '@/components/Themed'
import { usePalette } from '@/hooks/usePalette'
import { Font } from '@/theme/typography'

function firstNameHint(displayName: string): string {
  const n = displayName.trim()
  const first = n.split(/\s+/)[0]
  return first && first.length ? first : 'Bạn'
}

export function FeedProfileComposerRow({
  disabled,
  onOpen,
  avatarUrl,
  initials,
  displayName,
}: {
  disabled: boolean
  onOpen: () => void
  avatarUrl: string | null
  initials: string
  displayName: string
}) {
  const p = usePalette()
  const hint = firstNameHint(displayName)

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: p.border,
          backgroundColor: p.surfaceElevated,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <View style={[styles.avatarSm, { borderColor: p.border }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
        ) : (
          <LinearGradient colors={[p.accent, '#DD2476']} style={styles.avatarImg} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}>
            <Text style={[styles.initials, { fontFamily: Font.bold }]}>{initials[0]?.toUpperCase() ?? '?'}</Text>
          </LinearGradient>
        )}
      </View>
      <Pressable
        onPress={() => !disabled && onOpen()}
        disabled={disabled}
        style={({ pressed }) => [
          styles.fakeInput,
          {
            backgroundColor: p.canvasMuted,
            borderColor: p.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Text style={{ fontFamily: Font.regular, fontSize: 15, color: p.muted }}>
          {hint} ơi, bạn đang nghĩ gì?
        </Text>
      </Pressable>
      <View style={styles.iconActions} pointerEvents={disabled ? 'none' : 'auto'}>
        <Pressable
          onPress={() => !disabled && onOpen()}
          disabled={disabled}
          style={[styles.iconBtn, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}
          accessibilityLabel="Ảnh / video"
        >
          <FontAwesome name="image" size={16} color="#047857" />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  avatarSm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 15, color: '#FFF' },
  fakeInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
