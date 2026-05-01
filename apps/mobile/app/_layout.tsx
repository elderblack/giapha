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
import * as Linking from 'expo-linking'
import { Audio } from 'expo-av'
import { useEffect, useMemo } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useColorScheme } from '@/components/useColorScheme'
import { AuthProvider } from '@/context/AuthProvider'
import { useAuth } from '@/context/useAuth'
import { consumeSupabaseAuthUrl } from '@/lib/auth/authDeepLink'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { getPalette } from '@/theme/palette'

const PUBLIC_AUTH_SEGMENTS = new Set(['sign-in', 'forgot-password', 'reset-password'])

export { ErrorBoundary } from 'expo-router'

/** Tắt freeze để đổi tab / vào chi tiết rồi quay lại — ảnh & video không bị bung lại như reload. */
enableFreeze(false)

void SplashScreen.preventAutoHideAsync().catch(() => {})

/** Tránh gọi hideAsync nhiều lần (React Strict Mode / remount) — lần 2 trên iOS hay lỗi “No native splash screen registered”. */
let splashHidden = false
function hideSplashScreenOnce() {
  if (splashHidden) return
  splashHidden = true
  void SplashScreen.hideAsync().catch(() => {})
}

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
      hideSplashScreenOnce()
    }
  }, [loading])

  useEffect(() => {
    // expo-av SDK 54: log deprecation — khi ổn định có thể chuyển silent mode sang expo-audio.
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (loading) return
    if (!hasSupabaseCredentials()) return
    const sb = getSupabase()
    if (!sb) return

    let cancelled = false
    const openResetIfAuth = async (url: string) => {
      const r = await consumeSupabaseAuthUrl(sb, url)
      if (cancelled || !r.consumed) return
      router.replace('/reset-password')
    }

    void Linking.getInitialURL().then((url) => {
      if (url) void openResetIfAuth(url)
    })
    const sub = Linking.addEventListener('url', ({ url }) => void openResetIfAuth(url))
    return () => {
      cancelled = true
      sub.remove()
    }
  }, [loading, router])

  useEffect(() => {
    if (loading) return
    if (!segments?.length) return
    const root = segments[0]
    if (!session) {
      if (!PUBLIC_AUTH_SEGMENTS.has(root)) {
        router.replace('/sign-in')
      }
      return
    }
    if (root === 'sign-in' || root === 'forgot-password') {
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
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="chat" />
          <Stack.Screen name="feed" />
          <Stack.Screen name="profile" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
