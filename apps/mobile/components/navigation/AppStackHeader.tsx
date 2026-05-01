import FontAwesome from '@expo/vector-icons/FontAwesome'
import { HeaderButton } from '@react-navigation/elements'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'

import { usePalette } from '@/hooks/usePalette'
import type { ThemePalette } from '@/theme/palette'
import { Font } from '@/theme/typography'

export const APP_STACK_BACK_ICON_SIZE = 23

export type AppStackBackButtonProps = {
  onPress: () => void
  tintColor?: string
  iconSize?: number
  accessibilityLabel?: string
}

/** Nút quay lại (chevron trái) — dùng trong `headerLeft` hoặc màn tùy chỉnh. */
export function AppStackBackButton({
  onPress,
  tintColor,
  iconSize = APP_STACK_BACK_ICON_SIZE,
  accessibilityLabel = 'Quay lại',
}: AppStackBackButtonProps) {
  const color = tintColor ?? '#000'
  return (
    <HeaderButton
      accessibilityLabel={accessibilityLabel}
      tintColor={tintColor}
      pressOpacity={0.35}
      onPress={onPress}
      style={styles.headerBtnOuter}
    >
      <FontAwesome
        name="chevron-left"
        size={iconSize}
        color={color}
        style={styles.chevronGlyph}
      />
    </HeaderButton>
  )
}

/** Nút quay lại nổi trên ảnh bìa / nội dung — không vùng nền (chỉ icon). */
export function FloatingBackOverMedia({
  onPress,
  topOffset,
  iconColor = '#FFFFFF',
  iconSize = 24,
  accessibilityLabel = 'Quay lại',
}: {
  onPress: () => void
  topOffset: number
  iconColor?: string
  iconSize?: number
  accessibilityLabel?: string
}) {
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
      <Pressable
        onPress={onPress}
        hitSlop={14}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        style={[styles.floatingBackBtn, { top: topOffset + 2, left: 6 }]}
      >
        <FontAwesome name="chevron-left" size={iconSize} color={iconColor} style={styles.floatingBackGlyph} />
      </Pressable>
    </View>
  )
}

function headerTitleStyleForPalette(p: Pick<ThemePalette, 'ink'>) {
  return {
    fontFamily: Font.semiBold,
    fontSize: 17 as const,
    color: p.ink,
  }
}

/** `screenOptions` mặc định Stack (màu, title, nút back tùy biến). */
export function useAppStackScreenOptions(onBackPress?: () => void) {
  const p = usePalette()
  const router = useRouter()

  return useMemo(() => {
    const handleBack =
      onBackPress ??
      (() => {
        router.back()
      })

    return {
      headerShown: true,
      headerBackVisible: false,
      headerTintColor: p.accent,
      headerStyle: { backgroundColor: p.surfaceElevated },
      headerShadowVisible: false,
      headerTitleStyle: headerTitleStyleForPalette(p),
      headerLeft: ({ tintColor }: { tintColor?: string }) => (
        <AppStackBackButton tintColor={tintColor ?? p.accent} onPress={handleBack} />
      ),
    }
  }, [onBackPress, p, router])
}

const styles = StyleSheet.create({
  headerBtnOuter: Platform.select({
    ios: {
      marginLeft: 2,
      marginRight: -2,
      alignSelf: 'center',
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    default: {
      alignSelf: 'center',
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 2,
      marginHorizontal: -2,
    },
  }),
  /** FontAwesome chevron lệch so với title hệ — chỉnh vài điểm ảnh. */
  chevronGlyph: Platform.select({
    ios: {
      transform: [{ translateY: -1 }],
    },
    default: {
      transform: [{ translateY: 0.25 }],
      marginVertical: -1,
    },
  }),
  floatingBackBtn: {
    position: 'absolute',
    paddingVertical: 10,
    paddingHorizontal: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  floatingBackGlyph: Platform.select({
    ios: {
      transform: [{ translateX: -1 }],
    },
    default: {},
  }),
})
