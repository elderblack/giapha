import { ScrollView, StyleSheet, View } from 'react-native'

import { SkeletonBone } from '@/components/SkeletonBone'
import { usePalette } from '@/hooks/usePalette'

/** Bố cục gợi ý Trang chủ / Phả hệ / Sidebar web — chỉ RN, không Spinner. */
export function TreesTabSkeleton() {
  const p = usePalette()

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { backgroundColor: p.canvas }]}
      style={{ backgroundColor: p.canvas }}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Đang tải dòng họ…"
    >
      <SkeletonBone style={styles.kicker} />
      <SkeletonBone style={styles.title} />
      <SkeletonBone style={styles.chartCard} />

      <View style={styles.row}>
        <SkeletonBone style={styles.sideAvatar} />
        <View style={styles.sideTextCol}>
          <SkeletonBone style={styles.lineSm} />
          <SkeletonBone style={styles.lineMd} />
        </View>
      </View>

      <SkeletonBone style={styles.sectionHead} />

      {[0, 1, 2, 3].map((k) => (
        <View key={k} style={styles.memberRow}>
          <SkeletonBone style={styles.memberAvatar} />
          <View style={styles.memberTextCol}>
            <SkeletonBone style={styles.memberLineA} />
            <SkeletonBone style={styles.memberLineB} />
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  kicker: {
    height: 14,
    width: '36%',
    maxWidth: 140,
    borderRadius: 6,
    marginBottom: 10,
  },
  title: {
    height: 26,
    width: '72%',
    maxWidth: 260,
    borderRadius: 8,
    marginBottom: 16,
  },
  chartCard: {
    width: '100%',
    aspectRatio: 1.05,
    borderRadius: 16,
    marginBottom: 20,
    maxHeight: 280,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  sideAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  sideTextCol: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
  },
  lineSm: {
    height: 12,
    width: '55%',
    borderRadius: 5,
  },
  lineMd: {
    height: 14,
    width: '88%',
    borderRadius: 5,
  },
  sectionHead: {
    height: 16,
    width: '40%',
    borderRadius: 6,
    marginBottom: 14,
  },
  memberRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberTextCol: {
    flex: 1,
    gap: 6,
  },
  memberLineA: {
    height: 14,
    width: '48%',
    borderRadius: 5,
  },
  memberLineB: {
    height: 11,
    width: '76%',
    borderRadius: 4,
  },
})
