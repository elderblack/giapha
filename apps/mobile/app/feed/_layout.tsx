import { Stack } from 'expo-router'

import { useAppStackScreenOptions } from '@/components/navigation/AppStackHeader'

export default function FeedLayout() {
  const screenOptions = useAppStackScreenOptions()
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="[postId]" options={{ title: 'Bài viết' }} />
      <Stack.Screen name="reels" options={{ headerShown: false, animation: 'fade' }} />
    </Stack>
  )
}
