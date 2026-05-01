import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { formatNotificationDate } from '@/lib/notifications/formatSummary'
import { getSupabase } from '@/lib/supabase'
import { Font } from '@/theme/typography'
import {
  collectProfileIdsFromNotificationRows,
  mobileNotificationNavigateTo,
  notificationDisplay,
} from '../../../../shared/appNotifications'

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
  const router = useRouter()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const [rows, setRows] = useState<AppNotificationRow[]>([])
  const [nameById, setNameById] = useState<Record<string, string>>({})
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

  const loadNamesForRows = useCallback(
    async (list: AppNotificationRow[]) => {
      if (!sb) return {}
      const ids = collectProfileIdsFromNotificationRows(list)
      if (!ids.length) return {}
      const { data: profs } = await sb.from('profiles').select('id, full_name').in('id', ids)
      if (!profs) return {}
      return Object.fromEntries(
        (profs as { id: string; full_name: string | null }[]).map((row) => [
          row.id,
          row.full_name?.trim() ?? '',
        ]),
      )
    },
    [sb],
  )

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
          const names = await loadNamesForRows(list)
          if (cancelled) return
          setRows(list)
          setNameById(names)
          const unreadIds = list.filter((r) => !r.read_at).map((r) => r.id)
          if (unreadIds.length) {
            await sb.from('family_notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
            const after = await fetchList()
            if (cancelled) return
            const namesAfter = await loadNamesForRows(after)
            if (cancelled) return
            setRows(after)
            setNameById(namesAfter)
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
            if (cancelled) return
            const names = await loadNamesForRows(next)
            if (cancelled) return
            setRows(next)
            setNameById(names)
          },
        )
        .subscribe()

      return () => {
        cancelled = true
        void sb.removeChannel(ch)
      }
    }, [sb, uid, fetchList, loadNamesForRows]),
  )

  const onPull = useCallback(() => {
    setPullBusy(true)
    void (async () => {
      const list = await fetchList()
      const names = await loadNamesForRows(list)
      setRows(list)
      setNameById(names)
      setPullBusy(false)
    })()
  }, [fetchList, loadNamesForRows])

  const onRowPress = useCallback(
    async (item: AppNotificationRow) => {
      const href = mobileNotificationNavigateTo(item)
      if (item.read_at == null && sb) {
        await sb.from('family_notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id)
        setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, read_at: new Date().toISOString() } : r)))
      }
      if (href) router.push(href as never)
    },
    [router, sb],
  )

  if (!sb || !uid) {
    return (
      <SafeAreaView style={[styles.center, { flex: 1, backgroundColor: p.canvas }]} edges={['top', 'left', 'right']}>
        <Text style={{ color: p.muted, fontFamily: Font.medium }}>Cần đăng nhập.</Text>
      </SafeAreaView>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Thông báo', headerBackTitle: 'Lại', headerTintColor: p.accent }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas }} edges={['top', 'left', 'right']}>
      {loading && rows.length === 0 ? (
        <View style={[styles.center, { backgroundColor: p.canvas, flex: 1 }]}>
          <ActivityIndicator size="large" color={p.accent} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, rows.length === 0 && styles.emptyList]}
          refreshControl={<RefreshControl refreshing={pullBusy} onRefresh={onPull} tintColor={p.accent} />}
          ListEmptyComponent={
            <Text style={[styles.emptyTxt, { color: p.muted, fontFamily: Font.regular }]}>Chưa có thông báo.</Text>
          }
          renderItem={({ item }) => {
            const { title, detail } = notificationDisplay(item.kind, item.payload, nameById)
            const href = mobileNotificationNavigateTo(item)
            return (
              <Pressable
                onPress={() => void onRowPress(item)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderColor: p.border,
                    backgroundColor: item.read_at ? p.surfaceElevated : p.accentMuted,
                    opacity: pressed ? 0.88 : item.read_at ? 0.92 : 1,
                  },
                ]}
              >
                <FontAwesome name="circle" size={6} color={item.read_at ? p.muted : p.accent} style={styles.dot} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: p.ink, fontFamily: Font.semiBold }]}>{title}</Text>
                  {detail ? (
                    <Text
                      style={[
                        styles.rowHint,
                        { color: href ? p.accent : p.muted, fontFamily: Font.medium },
                      ]}
                    >
                      {href ? detail : `Không mở nhanh — ${detail}`}
                    </Text>
                  ) : null}
                  <Text style={[styles.rowTime, { color: p.muted, fontFamily: Font.regular }]}>
                    {formatNotificationDate(item.created_at)}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color={p.muted} style={styles.chevron} />
              </Pressable>
            )
          }}
        />
      )}
      </SafeAreaView>
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
  dot: { marginTop: 7 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  rowHint: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  rowTime: { fontSize: 12, marginTop: 6 },
  chevron: { marginTop: 4, marginLeft: 4 },
})
