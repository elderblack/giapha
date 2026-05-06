import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useMemo, useState } from 'react'
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'

import { Text } from '@/components/Themed'
import { usePalette } from '@/hooks/usePalette'
import { computeMemberGenerations } from '@/lib/tree/familyTreeGenerations'
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

type GenderFilter = 'all' | 'male' | 'female' | 'other'
type LinkedFilter = 'all' | 'linked' | 'unlinked'

export function TreesMembersList({
  members,
  refreshing,
  onRefresh,
  onPressMember,
  linkedSelfMemberId,
}: Props) {
  const p = usePalette()
  const [q, setQ] = useState('')
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [genFilter, setGenFilter] = useState<number | null>(null)
  const [linkedFilter, setLinkedFilter] = useState<LinkedFilter>('all')

  const genMap = useMemo(() => computeMemberGenerations(members), [members])
  const genOptions = useMemo(() => {
    const s = new Set<number>()
    for (const m of members) {
      s.add(genMap.get(m.id) ?? 0)
    }
    return [...s].sort((a, b) => a - b)
  }, [members, genMap])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = members.filter((m) => {
      if (genderFilter !== 'all' && (m.gender ?? '') !== genderFilter) return false
      if (genFilter != null && (genMap.get(m.id) ?? 0) !== genFilter) return false
      if (linkedFilter === 'linked' && !m.linked_profile_id) return false
      if (linkedFilter === 'unlinked' && m.linked_profile_id) return false
      return true
    })
    if (needle) {
      list = list.filter((m) => {
        if (m.full_name.toLowerCase().includes(needle)) return true
        const ph = m.phone?.trim().toLowerCase()
        if (ph && ph.includes(needle)) return true
        const notes = m.notes?.trim().toLowerCase()
        if (notes && notes.includes(needle)) return true
        return false
      })
    }
    list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
    return list
  }, [members, q, genderFilter, genFilter, linkedFilter, genMap])

  const filtersActive = genderFilter !== 'all' || genFilter != null || linkedFilter !== 'all'

  const chip = (opts: {
    label: string
    onPress: () => void
    selected: boolean
    key?: string
  }) => (
    <Pressable
      key={opts.key ?? opts.label}
      onPress={opts.onPress}
      style={[
        styles.chip,
        {
          borderColor: opts.selected ? p.accent : p.border,
          backgroundColor: opts.selected ? `${p.accent}22` : p.surfaceElevated,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: opts.selected ? Font.semiBold : Font.medium,
          fontSize: 12,
          color: opts.selected ? p.accent : p.ink,
        }}
      >
        {opts.label}
      </Text>
    </Pressable>
  )

  return (
    <View style={styles.wrap}>
      <View style={[styles.searchRow, { borderColor: p.border, backgroundColor: p.surfaceElevated }]}>
        <FontAwesome name="search" size={15} color={p.muted} style={{ marginRight: 8 }} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Tìm theo tên, SĐT hoặc ghi chú…"
          placeholderTextColor={p.muted}
          style={[styles.input, { color: p.ink, fontFamily: Font.regular }]}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.filterBlock}>
        <View style={styles.filterHead}>
          <Text style={{ fontFamily: Font.semiBold, fontSize: 12, color: p.muted }}>Lọc nhanh</Text>
          {(q.trim() !== '' || filtersActive) && (
            <Pressable
              onPress={() => {
                setQ('')
                setGenderFilter('all')
                setGenFilter(null)
                setLinkedFilter('all')
              }}
              hitSlop={8}
            >
              <Text style={{ fontFamily: Font.semiBold, fontSize: 12, color: p.accent }}>Xóa</Text>
            </Pressable>
          )}
        </View>
        <Text style={{ fontFamily: Font.medium, fontSize: 11, color: p.muted, marginBottom: 6 }}>Giới tính</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {chip({ label: 'Tất cả', selected: genderFilter === 'all', onPress: () => setGenderFilter('all') })}
          {chip({ label: 'Nam', selected: genderFilter === 'male', onPress: () => setGenderFilter('male') })}
          {chip({ label: 'Nữ', selected: genderFilter === 'female', onPress: () => setGenderFilter('female') })}
          {chip({ label: 'Khác', selected: genderFilter === 'other', onPress: () => setGenderFilter('other') })}
        </ScrollView>
        <Text style={{ fontFamily: Font.medium, fontSize: 11, color: p.muted, marginBottom: 6, marginTop: 8 }}>
          Thế hệ (sơ đồ)
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {chip({
            label: 'Tất cả',
            selected: genFilter === null,
            onPress: () => setGenFilter(null),
          })}
          {genOptions.map((n) =>
            chip({
              key: `g-${n}`,
              label: `Thế hệ ${n}`,
              selected: genFilter === n,
              onPress: () => setGenFilter(n),
            }),
          )}
        </ScrollView>
        <Text style={{ fontFamily: Font.medium, fontSize: 11, color: p.muted, marginBottom: 6, marginTop: 8 }}>
          Tài khoản
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {chip({ label: 'Tất cả', selected: linkedFilter === 'all', onPress: () => setLinkedFilter('all') })}
          {chip({
            label: 'Đã liên kết',
            selected: linkedFilter === 'linked',
            onPress: () => setLinkedFilter('linked'),
          })}
          {chip({
            label: 'Chưa liên kết',
            selected: linkedFilter === 'unlinked',
            onPress: () => setLinkedFilter('unlinked'),
          })}
        </ScrollView>
        <Text style={{ fontFamily: Font.regular, fontSize: 11, color: p.muted, marginTop: 8 }}>
          Hiển thị {rows.length} / {members.length}
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} />}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 28, fontFamily: Font.medium, color: p.muted }}>
            {members.length === 0
              ? 'Chưa có thành viên trong dữ liệu tải được.'
              : 'Không có thành viên khớp tìm kiếm hoặc bộ lọc.'}
          </Text>
        }
        renderItem={({ item }) => {
          const isSelf = linkedSelfMemberId === item.id
          const chartGen = genMap.get(item.id) ?? 0
          const sub =
            item.lineage_generation != null
              ? `Đời ${item.lineage_generation} · Thế hệ ${chartGen}${
                  item.gender
                    ? ` · ${item.gender === 'male' ? 'Nam' : item.gender === 'female' ? 'Nữ' : item.gender === 'other' ? 'Khác' : ''}`
                    : ''
                }`
              : `Thế hệ ${chartGen}${
                  item.gender
                    ? ` · ${item.gender === 'male' ? 'Nam' : item.gender === 'female' ? 'Nữ' : item.gender === 'other' ? 'Khác' : ''}`
                    : ''
                }`
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
  filterBlock: { marginBottom: 12 },
  filterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, paddingRight: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
