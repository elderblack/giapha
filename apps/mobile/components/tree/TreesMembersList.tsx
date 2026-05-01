import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useMemo, useState } from 'react'
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'

import { Text } from '@/components/Themed'
import { usePalette } from '@/hooks/usePalette'
import type { TreeMemberRow } from '@/lib/tree/treeMemberRow'
import { memberInitial } from '@/lib/tree/treeUi'
import { Font } from '@/theme/typography'

type Props = {
  members: TreeMemberRow[]
  refreshing: boolean
  onRefresh: () => void
  onPressMember: (id: string) => void
  linkedSelfMemberId: string | null
}

export function TreesMembersList({
  members,
  refreshing,
  onRefresh,
  onPressMember,
  linkedSelfMemberId,
}: Props) {
  const p = usePalette()
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const sorted = [...members].sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
    const needle = q.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter((m) => m.full_name.toLowerCase().includes(needle))
  }, [members, q])

  return (
    <View style={styles.wrap}>
      <View style={[styles.searchRow, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
        <FontAwesome name="search" size={15} color={p.muted} style={{ marginRight: 8 }} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Tìm theo tên…"
          placeholderTextColor={p.muted}
          style={[styles.input, { color: p.ink, fontFamily: Font.regular }]}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} />}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 28, fontFamily: Font.medium, color: p.muted }}>
            {q.trim() ? 'Không có tên khớp ô tìm.' : 'Chưa có thành viên trong dữ liệu tải được.'}
          </Text>
        }
        renderItem={({ item }) => {
          const isSelf = linkedSelfMemberId === item.id
          const sub =
            item.lineage_generation != null
              ? `Đời ${item.lineage_generation}${item.gender ? ` · ${item.gender === 'male' ? 'Nam' : item.gender === 'female' ? 'Nữ' : ''}` : ''}`
              : item.gender
                ? item.gender === 'male'
                  ? 'Nam'
                  : item.gender === 'female'
                    ? 'Nữ'
                    : ''
                : '—'
          return (
            <Pressable
              onPress={() => onPressMember(item.id)}
              style={[styles.row, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={[styles.av, { borderColor: p.border }]} />
              ) : (
                <View style={[styles.av, styles.avPh, { borderColor: p.border, backgroundColor: p.accentMuted }]}>
                  <Text style={{ fontFamily: Font.bold, fontSize: 14, color: p.accent }}>{memberInitial(item.full_name)}</Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.semiBold, fontSize: 15, color: p.ink }}>
                  {item.full_name}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: Font.regular, fontSize: 12, color: p.muted, marginTop: 3 }}>
                  {sub}
                </Text>
              </View>
              {isSelf ? (
                <View style={[styles.badge, { borderColor: `${p.accent}55`, backgroundColor: `${p.accent}18` }]}>
                  <Text style={{ fontFamily: Font.bold, fontSize: 10, color: p.accent }}>BẠN</Text>
                </View>
              ) : (
                <FontAwesome name="chevron-right" color={p.muted} size={14} />
              )}
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 2 },
  listContent: { paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  av: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  avPh: { alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
})
