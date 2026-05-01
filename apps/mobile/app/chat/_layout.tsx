import { Stack } from 'expo-router'

import { useAppStackScreenOptions } from '@/components/navigation/AppStackHeader'

export default function ChatLayout() {
  const screenOptions = useAppStackScreenOptions()
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Tin nhắn' }} />
      <Stack.Screen name="[conversationId]" options={{ title: 'Đoạn chat' }} />
    </Stack>
  )
}
