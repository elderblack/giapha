import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native'

import { useAppStackScreenOptions } from '@/components/navigation/AppStackHeader'
import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import type { ChatThreadPreview } from '@/lib/chat/types'
import { fetchChatThreads } from '@/lib/chat/fetchThreads'
import { markFamilyChatConversationRead } from '@/lib/chat/markRead'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { Font } from '@/theme/typography'

export default function ChatThreadsScreen() {
  const p = usePalette()
  const router = useRouter()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const scope = useRef(`mt-${Math.random().toString(36).slice(2, 11)}`)
  const [threads, setThreads] = useState<ChatThreadPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [pullBusy, setPullBusy] = useState(false)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!sb || !uid) {
        setLoading(false)
        return
      }
      const silent = opts?.silent === true
      if (!silent) setLoading(true)
      try {
        const next = await fetchChatThreads(sb, uid)
        setThreads(next)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [sb, uid],
  )

  const firstFocus = useRef(true)

  useFocusEffect(
    useCallback(() => {
      void load({ silent: !firstFocus.current })
      firstFocus.current = false
    }, [load]),
  )

  useEffect(() => {
    if (!sb || !uid || !hasSupabaseCredentials()) return
    const ch = sb
      .channel(`family-chat-threads-mobile:${uid}:${scope.current}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'family_chat_messages' }, () => {
        void load({ silent: true })
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'family_chat_participants', filter: `user_id=eq.${uid}` },
        () => void load({ silent: true }),
      )
      .subscribe()
    return () => void sb.removeChannel(ch)
  }, [sb, uid, load])

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)')
  }, [router])

  const stackHeader = useAppStackScreenOptions(goBack)
  const listHeaderOpts = useMemo(
    () => ({
      ...stackHeader,
      title: 'Tin nhắn' as const,
    }),
    [stackHeader],
  )

  async function openThread(convId: string) {
    if (!sb || !uid) return
    await markFamilyChatConversationRead(sb, uid, convId)
    router.push(`/chat/${convId}`)
  }

  if (!hasSupabaseCredentials() || !sb) {
    return (
      <>
        <Stack.Screen options={listHeaderOpts} />
        <View style={[styles.center, { backgroundColor: p.canvas }]}>
          <Text style={{ color: p.muted, fontFamily: Font.medium }}>Chưa cấu hình Supabase.</Text>
        </View>
      </>
    )
  }

  if (!uid) {
    return (
      <>
        <Stack.Screen options={listHeaderOpts} />
        <View style={[styles.center, { backgroundColor: p.canvas }]}>
          <Text style={{ color: p.muted, fontFamily: Font.medium }}>Cần đăng nhập.</Text>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={listHeaderOpts} />
      <View style={[styles.wrap, { backgroundColor: p.canvas }]}>
        {loading && threads.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={p.accent} />
          </View>
        ) : (
          <FlatList
          data={threads}
          keyExtractor={(t) => t.conversation.id}
          refreshControl={
            <RefreshControl
              refreshing={pullBusy}
              onRefresh={() => {
                setPullBusy(true)
                void load({ silent: true }).finally(() => setPullBusy(false))
              }}
              tintColor={p.accent}
            />
          }
          contentContainerStyle={threads.length === 0 ? styles.emptyBox : styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: p.muted, fontFamily: Font.regular }]}>Chưa có cuộc trò chuyện.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void openThread(item.conversation.id)}
              style={[styles.row, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}
            >
              <View style={[styles.avatar, { backgroundColor: p.accentMuted }]}>
                {!item.isGroup && item.otherUser.avatar_url ? (
                  <Image source={{ uri: item.otherUser.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <FontAwesome name={item.isGroup ? 'users' : 'user'} size={22} color={p.accent} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.title, { color: p.ink, fontFamily: Font.bold }]} numberOfLines={1}>
                    {item.threadTitle}
                  </Text>
                  {item.unreadCount > 0 ? (
                    <View style={[styles.badge, { backgroundColor: p.accent }]}>
                      <Text style={{ color: '#FFF', fontFamily: Font.bold, fontSize: 11 }}>
                        {item.unreadCount > 9 ? '9+' : item.unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.preview, { color: p.muted, fontFamily: Font.regular }]} numberOfLines={2}>
                  {previewLine(item)}
                </Text>
              </View>
            </Pressable>
          )}
          />
        )}
      </View>
    </>
  )
}

function previewLine(t: ChatThreadPreview): string {
  const m = t.lastMessage
  if (!m) return 'Chưa có tin nhắn'
  if (m.body?.trim()) return m.body.trim()
  if (m.attachment_kind === 'image') return 'Đã gửi ảnh'
  return 'Tin nhắn'
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 20, gap: 8 },
  emptyBox: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  empty: { textAlign: 'center', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { fontSize: 13.5, marginTop: 4 },
})
