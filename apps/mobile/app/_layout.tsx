import 'react-native-gesture-handler'
import { enableFreeze } from 'react-native-screens'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import {
  DarkTheme as NavDark,
  DefaultTheme as NavLight,
  ThemeProvider,
  type Theme,
} from '@react-navigation/native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useFonts } from 'expo-font'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter'
import * as SplashScreen from 'expo-splash-screen'
import { Audio } from 'expo-av'
import { useEffect, useMemo } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useColorScheme } from '@/components/useColorScheme'
import { AuthProvider } from '@/context/AuthProvider'
import { useAuth } from '@/context/useAuth'
import { getPalette } from '@/theme/palette'

export { ErrorBoundary } from 'expo-router'

/** Tắt freeze để đổi tab / vào chi tiết rồi quay lại — ảnh & video không bị bung lại như reload. */
enableFreeze(false)

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    ...FontAwesome.font,
  })

  useEffect(() => {
    if (fontError) throw fontError
  }, [fontError])

  if (!loaded) {
    return null
  }

  return (
    <AuthProvider>
      <AuthGateNav />
    </AuthProvider>
  )
}

function AuthGateNav() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const palette = useMemo(() => getPalette(scheme), [scheme])
  const { session, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  const navTheme: Theme = useMemo(
    () => ({
      ...(scheme === 'dark' ? NavDark : NavLight),
      colors: {
        ...(scheme === 'dark' ? NavDark.colors : NavLight.colors),
        primary: palette.accent,
        background: palette.canvas,
        card: palette.surfaceElevated,
        text: palette.ink,
        border: palette.border,
        notification: palette.accent,
      },
    }),
    [scheme, palette],
  )

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [loading])

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (loading) return
    if (!segments?.length) return

    const atSignIn = segments[0] === 'sign-in'

    if (!session) {
      if (!atSignIn) router.replace('/sign-in')
      return
    }
    if (atSignIn) {
      router.replace('/(tabs)')
    }
  }, [loading, session, segments, router])

  if (loading) {
    return null
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.canvas },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="chat" />
          <Stack.Screen name="feed" />
          <Stack.Screen name="profile" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
