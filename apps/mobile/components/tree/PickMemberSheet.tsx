import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/Themed'
import { usePalette } from '@/hooks/usePalette'
import { Font } from '@/theme/typography'

export type MemberPickOption = { id: string | null; name: string }

type Props = {
  visible: boolean
  title: string
  options: MemberPickOption[]
  onPick: (id: string | null) => void
  onClose: () => void
}

export function PickMemberSheet({ visible, title, options, onPick, onClose }: Props) {
  const p = usePalette()
  const inset = useSafeAreaInsets()

  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: `${p.canvas}CC` }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: p.surfaceElevated, borderColor: p.border, paddingBottom: 12 + inset.bottom }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handleRow, { borderBottomColor: p.border }]}>
            <Text style={[styles.sheetTitle, { color: p.ink, fontFamily: Font.semiBold }]}>{title}</Text>
            <Pressable hitSlop={12} accessibilityLabel="Đóng danh sách" onPress={onClose}>
              <FontAwesome name="times-circle" size={26} color={p.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.list} nestedScrollEnabled>
            {options.map((o) => (
              <Pressable
                key={o.id ?? '__none'}
                accessibilityRole="button"
                style={[styles.row, { borderBottomColor: p.border }]}
                onPress={() => {
                  onPick(o.id)
                  onClose()
                }}
              >
                <Text style={[styles.rowText, { color: p.ink, fontFamily: Font.regular }]} numberOfLines={2}>
                  {o.name}
                </Text>
                <FontAwesome name="chevron-right" color={p.muted} size={13} />
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '70%',
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 17, flex: 1, marginRight: 10 },
  list: {
    flexGrow: 0,
    maxHeight: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, fontSize: 15 },
})
