import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Stack, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native'

import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { formatNotificationDate, notificationSummary } from '@/lib/notifications/formatSummary'
import { getSupabase } from '@/lib/supabase'
import { Font } from '@/theme/typography'

type AppNotificationRow = {
  id: string
  kind: string
  payload: Record<string, unknown>
  family_tree_id: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationsScreen() {
  const p = usePalette()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const [rows, setRows] = useState<AppNotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pullBusy, setPullBusy] = useState(false)

  const fetchList = useCallback(async (): Promise<AppNotificationRow[]> => {
    if (!sb || !uid) return []
    const { data, error } = await sb
      .from('family_notifications')
      .select('id,kind,payload,family_tree_id,read_at,created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error || !data) return []
    return data as AppNotificationRow[]
  }, [sb, uid])

  /** Màn hình toàn phần: vào là tải, đánh dấu đã đọc những tin chưa đọc, rồi đăng ký realtime. */
  useFocusEffect(
    useCallback(() => {
      if (!sb || !uid) {
        setLoading(false)
        return () => {}
      }

      let cancelled = false

      const mount = async () => {
        setLoading(true)
        try {
          const list = await fetchList()
          if (cancelled) return
          setRows(list)
          const unreadIds = list.filter((r) => !r.read_at).map((r) => r.id)
          if (unreadIds.length) {
            await sb.from('family_notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
            const after = await fetchList()
            if (!cancelled) setRows(after)
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      }
      void mount()

      const ch = sb
        .channel(`family-notifications-mobile-${uid}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'family_notifications',
            filter: `user_id=eq.${uid}`,
          },
          async () => {
            const next = await fetchList()
            if (!cancelled) setRows(next)
          },
        )
        .subscribe()

      return () => {
        cancelled = true
        void sb.removeChannel(ch)
      }
    }, [sb, uid, fetchList]),
  )

  const onPull = useCallback(() => {
    setPullBusy(true)
    void fetchList()
      .then((list) => setRows(list))
      .finally(() => setPullBusy(false))
  }, [fetchList])

  if (!sb || !uid) {
    return (
      <View style={[styles.center, { backgroundColor: p.canvas }]}>
        <Text style={{ color: p.muted, fontFamily: Font.medium }}>Cần đăng nhập.</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Thông báo', headerBackTitle: 'Lại', headerTintColor: p.accent }} />
      {loading && rows.length === 0 ? (
        <View style={[styles.center, { backgroundColor: p.canvas }]}>
          <ActivityIndicator size="large" color={p.accent} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, rows.length === 0 && styles.emptyList]}
          refreshControl={<RefreshControl refreshing={pullBusy} onRefresh={onPull} tintColor={p.accent} />}
          ListEmptyComponent={
            <Text style={[styles.emptyTxt, { color: p.muted, fontFamily: Font.regular }]}>Chưa có thông báo.</Text>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.row,
                {
                  borderColor: p.border,
                  backgroundColor: item.read_at ? p.surfaceElevated : p.accentMuted,
                  opacity: item.read_at ? 0.92 : 1,
                },
              ]}
            >
              <FontAwesome name="circle" size={6} color={item.read_at ? p.muted : p.accent} style={styles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: p.ink, fontFamily: Font.semiBold }]}>
                  {notificationSummary(item.kind)}
                </Text>
                <Text style={[styles.rowTime, { color: p.muted, fontFamily: Font.regular }]}>
                  {formatNotificationDate(item.created_at)}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 16, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  emptyTxt: { textAlign: 'center', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { marginTop: 6 },
  rowTitle: { fontSize: 14, lineHeight: 20 },
  rowTime: { fontSize: 12, marginTop: 6 },
})
