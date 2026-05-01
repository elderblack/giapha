import { Stack } from 'expo-router'

import { useAppStackScreenOptions } from '@/components/navigation/AppStackHeader'

export default function ProfileStackLayout() {
  const screenOptions = useAppStackScreenOptions()
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="edit" options={{ title: 'Chỉnh sửa thông tin' }} />
      <Stack.Screen
        name="[userId]"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  )
}
