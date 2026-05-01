import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/Themed'
import { usePalette } from '@/hooks/usePalette'
import type { TreeMemberRow } from '@/lib/tree/treeMemberRow'
import { Font } from '@/theme/typography'

type Props = {
  visible: boolean
  member: TreeMemberRow | null
  fatherName?: string | null
  motherName?: string | null
  spouseName?: string | null
  isLinkedSelf: boolean
  onClose: () => void
  canEditMembers?: boolean
  onPressEdit?: () => void
  canUseClaim?: boolean
  userId?: string | null
  myLinkedMemberId?: string | null
  linkBusyId?: string | null
  linkMsg?: string | null
  onClaim?: (memberId: string) => void
  onUnlink?: (memberId: string) => void
  /**
   * Overlay View trong parent (không dùng Modal). Cần khi chi tiết mở từ bên trong Modal phả đồ fullscreen —
   * Modal chồng Modal trên iOS thường không hiển thị sheet dù ô đã được chọn.
   */
  embeddedInParent?: boolean
}

function Row({ label, value }: { label: string; value: string }) {
  const p = usePalette()
  return (
    <View style={[styles.detailRow, { borderBottomColor: p.border }]}>
      <Text style={[styles.dtLabel, { color: p.muted, fontFamily: Font.medium }]}>{label}</Text>
      <Text style={[styles.dtValue, { color: p.ink, fontFamily: Font.regular }]}>{value}</Text>
    </View>
  )
}

export function TreeMemberPeekModal({
  visible,
  member,
  fatherName,
  motherName,
  spouseName,
  isLinkedSelf,
  onClose,
  canEditMembers = false,
  onPressEdit,
  canUseClaim = false,
  userId = null,
  myLinkedMemberId = null,
  linkBusyId = null,
  linkMsg = null,
  onClaim,
  onUnlink,
  embeddedInParent = false,
}: Props) {
  const p = usePalette()
  const inset = useSafeAreaInsets()

  if (!visible) return null

  const gen = member && member.lineage_generation != null ? `Đời ${member.lineage_generation}` : null
  const gender =
    member && member.gender === 'male' ? 'Nam' : member && member.gender === 'female' ? 'Nữ' : member?.gender ?? '—'

  const sheetContent = (
    <>
      <View style={[styles.sheetHandleZone, { borderBottomColor: p.border }]}>
        <View style={[styles.sheetHandleBar, { backgroundColor: p.muted + '77' }]} />
        <Pressable hitSlop={12} accessibilityLabel="Đóng chi tiết" onPress={onClose} style={styles.closeBtn}>
          <FontAwesome name="times-circle" size={26} color={p.muted} />
        </Pressable>
      </View>
      {!member ? (
        <>
          <Text style={[styles.title, { color: p.ink, fontFamily: Font.extraBold }]}>Không mở được chi tiết</Text>
          <Text style={{ marginTop: 12, marginBottom: 8, fontFamily: Font.medium, fontSize: 14, color: p.muted, lineHeight: 20 }}>
            Hồ sơ người này chưa khớp với danh sách đang tải. Chọn lại trên phả đồ hoặc kéo xuống để làm mới danh sách.
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: p.ink, fontFamily: Font.extraBold }]} numberOfLines={2}>
            {member.full_name}
          </Text>
          <View style={styles.tagRow}>
            {isLinkedSelf ? (
              <View style={[styles.tag, { borderColor: p.accent + '77', backgroundColor: p.accentMuted }]}>
                <Text style={[styles.tagTxt, { color: p.accent, fontFamily: Font.semiBold }]}>Bạn</Text>
              </View>
            ) : null}
            {gen ? (
              <View style={[styles.tag, { borderColor: p.border, backgroundColor: p.canvasMuted }]}>
                <Text style={[styles.tagTxt, { color: p.muted, fontFamily: Font.semiBold }]}>{gen}</Text>
              </View>
            ) : null}
          </View>
          {member.linked_profile_id && !isLinkedSelf ? (
            <View style={[styles.linkedBanner, { backgroundColor: p.canvasMuted, borderColor: p.border }]}>
              <FontAwesome name="link" color={p.accent} size={13} />
              <Text style={{ marginLeft: 8, flex: 1, fontFamily: Font.medium, fontSize: 12, color: p.muted }}>
                Người này đã gắn tài khoản trong hệ thống (không phải bạn).
              </Text>
            </View>
          ) : null}
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Row label="Giới tính" value={gender} />
            {member.birth_date ? <Row label="Sinh" value={member.birth_date} /> : null}
            {member.death_date ? <Row label="Mất" value={member.death_date} /> : null}
            <Row label="Cha (trên nhánh đã tải)" value={fatherName?.trim() || '—'} />
            <Row label="Mẹ (trên nhánh đã tải)" value={motherName?.trim() || '—'} />
            {spouseName ? <Row label="Phối ngẫu" value={spouseName} /> : null}
            {member.phone ? <Row label="Điện thoại" value={member.phone} /> : null}
            {member.notes?.trim() ? (
              <View style={styles.noteBlock}>
                <Text style={[styles.dtLabel, { color: p.muted, fontFamily: Font.medium, marginBottom: 6 }]}>Ghi chú</Text>
                <Text style={[styles.noteBody, { color: p.ink, fontFamily: Font.regular }]}>{member.notes.trim()}</Text>
              </View>
            ) : null}
          </ScrollView>

          {linkMsg ? (
            <Text style={[styles.linkMsg, { color: p.danger, fontFamily: Font.medium }]}>{linkMsg}</Text>
          ) : null}

          {canEditMembers && onPressEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chỉnh sửa thành viên"
              onPress={onPressEdit}
              style={[styles.primaryBtn, { backgroundColor: p.accentMuted, borderColor: p.accent + '77' }]}
            >
              <FontAwesome name="pencil" size={16} color={p.accent} />
              <Text style={[styles.primaryBtnLbl, { color: p.accent, fontFamily: Font.semiBold }]}>Chỉnh sửa…</Text>
            </Pressable>
          ) : null}

          {userId != null && canUseClaim ? (
            <View style={styles.linkBlock}>
              {!member.linked_profile_id && !myLinkedMemberId ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={linkBusyId != null}
                  onPress={() => onClaim?.(member.id)}
                  style={[
                    styles.secondaryBtn,
                    {
                      borderColor: p.border,
                      backgroundColor: p.canvasMuted,
                      opacity: linkBusyId != null ? 0.55 : 1,
                    },
                  ]}
                >
                  <FontAwesome name="user" size={16} color={p.ink} />
                  <Text style={{ marginLeft: 8, fontFamily: Font.semiBold, color: p.ink, fontSize: 14 }}>
                    Đây là tôi — liên kết tài khoản
                  </Text>
                </Pressable>
              ) : null}
              {member.linked_profile_id != null && member.linked_profile_id === userId ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={linkBusyId != null}
                  onPress={() => onUnlink?.(member.id)}
                  style={[
                    styles.outlineBtn,
                    { borderColor: p.border },
                    linkBusyId != null ? { opacity: 0.55 } : null,
                  ]}
                >
                  <Text style={{ fontFamily: Font.semiBold, color: p.muted, fontSize: 14 }}>Huỷ liên kết</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </>
  )

  const sheetWrap = (
    <Pressable
      style={[styles.sheet, { backgroundColor: p.surfaceElevated, borderColor: p.border, paddingBottom: 16 + inset.bottom }]}
      onPress={(e) => e.stopPropagation()}
    >
      {sheetContent}
    </Pressable>
  )

  if (embeddedInParent) {
    return (
      <View pointerEvents="box-none" style={styles.embedAnchor}>
        <Pressable
          style={[styles.overlay, styles.overlayAbs, { backgroundColor: `${p.canvas}BB` }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng (chạm nền mờ)"
        >
          {sheetWrap}
        </Pressable>
      </View>
    )
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={[styles.overlay, { backgroundColor: `${p.canvas}BB` }]} onPress={onClose} accessibilityRole="button">
        {sheetWrap}
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  embedAnchor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 800,
    elevation: 30,
  },
  overlayAbs: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '86%',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetHandleZone: {
    alignItems: 'center',
    paddingBottom: 8,
    marginHorizontal: -8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetHandleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
    marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute',
    right: 4,
    top: 4,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 8 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagTxt: { fontSize: 12 },
  scroll: {
    flexGrow: 0,
    maxHeight: '100%',
    marginHorizontal: -4,
    marginTop: 4,
  },
  detailRow: {
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  dtLabel: { fontSize: 12 },
  dtValue: { fontSize: 15, lineHeight: 22 },
  noteBlock: { paddingVertical: 14 },
  noteBody: { fontSize: 14, lineHeight: 21 },
  linkedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 4,
    marginTop: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  linkMsg: {
    marginTop: 8,
    fontSize: 13,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  primaryBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  primaryBtnLbl: { fontSize: 15 },
  linkBlock: { marginTop: 10, gap: 8 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  outlineBtn: {
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
})
