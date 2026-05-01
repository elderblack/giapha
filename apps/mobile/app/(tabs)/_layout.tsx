import React from 'react'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Tabs } from 'expo-router'
import { Platform, StyleSheet } from 'react-native'

import { useColorScheme } from '@/components/useColorScheme'
import Colors from '@/constants/Colors'
import { ProfileTabBarIcon } from '@/components/ProfileTabBarIcon'
import { usePalette } from '@/hooks/usePalette'

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const base = Colors[colorScheme ?? 'light']
  const p = usePalette()

  return (
    <Tabs
      screenOptions={{
        /** Giữ subtree tab sống (không freeze) — khớp enableFreeze(false) ở root. */
        freezeOnBlur: false,
        headerShown: false,
        tabBarActiveTintColor: base.tint,
        tabBarInactiveTintColor: p.muted,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: { marginBottom: 0 },
        tabBarItemStyle: { justifyContent: 'center' },
        tabBarStyle: {
          backgroundColor: p.surfaceElevated,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: p.border,
          paddingTop: Platform.OS === 'ios' ? 6 : 4,
          elevation: Platform.OS === 'android' ? 8 : 0,
          ...(Platform.OS === 'ios'
            ? {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -1 },
                shadowOpacity: p.scheme === 'dark' ? 0.22 : 0.06,
                shadowRadius: 2,
              }
            : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang nhà',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome size={focused ? 24 : 22} name="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trees"
        options={{
          title: 'Dòng họ',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome size={focused ? 24 : 22} name="sitemap" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Thông báo',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome size={focused ? 24 : 22} name={focused ? 'bell' : 'bell-o'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: 'Kết nối',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome size={focused ? 24 : 22} name="users" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ focused }) => <ProfileTabBarIcon focused={focused} />,
        }}
      />
    </Tabs>
  )
}
