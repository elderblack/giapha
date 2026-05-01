import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PickMemberSheet, type MemberPickOption } from '@/components/tree/PickMemberSheet'
import { Text } from '@/components/Themed'
import { usePalette } from '@/hooks/usePalette'
import type { TreeMemberRow } from '@/lib/tree/treeMemberRow'
import { Font } from '@/theme/typography'

export type MemberAddDraft = {
  full_name: string
  gender: string | null
  birth_date: string | null
  death_date: string | null
  notes: string | null
  phone: string | null
  lineage_generation: number | null
  father_id: string | null
  mother_id: string | null
}

type Props = {
  visible: boolean
  peerMembers: TreeMemberRow[]
  supportsPhoneColumn: boolean
  onClose: () => void
  onSubmit: (draft: MemberAddDraft) => Promise<string | null>
}

function FieldLbl({ children }: { children: string }) {
  const p = usePalette()
  return (
    <Text style={{ fontFamily: Font.semiBold, fontSize: 12, color: p.muted, marginBottom: 6 }}>{children}</Text>
  )
}

export function TreeMemberAddModal({ visible, peerMembers, supportsPhoneColumn, onClose, onSubmit }: Props) {
  const p = usePalette()
  const inset = useSafeAreaInsets()
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('')
  const [death, setDeath] = useState('')
  const [notes, setNotes] = useState('')
  const [phone, setPhone] = useState('')
  const [lineageGEN, setLineageGEN] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [fatherId, setFatherId] = useState<string | null>(null)
  const [motherId, setMotherId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [pick, setPick] = useState<null | 'father' | 'mother'>(null)

  useEffect(() => {
    if (!visible) return
    setName('')
    setBirth('')
    setDeath('')
    setNotes('')
    setPhone('')
    setLineageGEN('')
    setGender('')
    setFatherId(null)
    setMotherId(null)
    setErr(null)
    setBusy(false)
    setPick(null)
  }, [visible])

  const sortedPeers = useMemo(() => [...peerMembers].sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')), [peerMembers])

  const pickFatherOpts = useMemo((): MemberPickOption[] => {
    const opts: MemberPickOption[] = [{ id: null, name: '(Không chọn)' }]
    for (const m of sortedPeers) {
      if (motherId != null && m.id === motherId) continue
      opts.push({ id: m.id, name: m.full_name })
    }
    return opts
  }, [sortedPeers, motherId])

  const pickMotherOpts = useMemo((): MemberPickOption[] => {
    const opts: MemberPickOption[] = [{ id: null, name: '(Không chọn)' }]
    for (const m of sortedPeers) {
      if (fatherId != null && m.id === fatherId) continue
      opts.push({ id: m.id, name: m.full_name })
    }
    return opts
  }, [sortedPeers, fatherId])

  async function handleSave() {
    const n = name.trim()
    if (n.length < 2) {
      setErr('Tên cần ít nhất 2 ký tự.')
      return
    }
    let lineage_generation: number | null = null
    const lgRaw = lineageGEN.trim()
    if (lgRaw !== '') {
      const num = Number.parseInt(lgRaw, 10)
      if (!Number.isFinite(num) || num < 0) {
        setErr('Đời trong phả là số ≥ 0 hoặc để trống.')
        return
      }
      lineage_generation = num
    }
    const draft: MemberAddDraft = {
      full_name: n,
      gender: gender === '' ? null : gender,
      birth_date: birth.trim() || null,
      death_date: death.trim() || null,
      notes: notes.trim() || null,
      phone: supportsPhoneColumn ? phone.trim() || null : null,
      lineage_generation,
      father_id: fatherId,
      mother_id: motherId,
    }
    setBusy(true)
    setErr(null)
    const msg = await onSubmit(draft)
    setBusy(false)
    if (msg) {
      setErr(msg)
      return
    }
    onClose()
  }

  const fatherLbl = fatherId ? peerMembers.find((m) => m.id === fatherId)?.full_name ?? '—' : '(Không chọn)'
  const motherLbl = motherId ? peerMembers.find((m) => m.id === motherId)?.full_name ?? '—' : '(Không chọn)'

  return (
    <>
      <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.overlay, { backgroundColor: `${p.canvas}BB` }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
          <View
            style={[
              styles.sheet,
              { backgroundColor: p.surfaceElevated, borderColor: p.border, marginBottom: 8 + inset.bottom },
            ]}
          >
            <View style={[styles.hdr, { borderBottomColor: p.border }]}>
              <Pressable accessibilityLabel="Huỷ" hitSlop={10} onPress={onClose}>
                <Text style={{ color: p.accent, fontFamily: Font.semiBold, fontSize: 16 }}>Huỷ</Text>
              </Pressable>
              <Text style={{ color: p.ink, fontFamily: Font.bold, fontSize: 17 }}>Thêm thành viên</Text>
              <Pressable
                accessibilityLabel="Lưu"
                hitSlop={10}
                disabled={busy}
                onPress={() => void handleSave()}
                style={{ minWidth: 52, alignItems: 'flex-end' }}
              >
                {busy ? (
                  <ActivityIndicator color={p.accent} size="small" />
                ) : (
                  <Text style={{ color: p.accent, fontFamily: Font.bold, fontSize: 16 }}>Thêm</Text>
                )}
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.form}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {err ? <Text style={[styles.err, { color: p.danger, fontFamily: Font.medium }]}>{err}</Text> : null}

              <FieldLbl>Họ tên</FieldLbl>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Họ và tên đầy đủ"
                placeholderTextColor={p.muted}
                autoCorrect={false}
                style={[styles.input, { borderColor: p.border, color: p.ink, fontFamily: Font.regular, backgroundColor: p.canvasMuted }]}
              />

              <FieldLbl>Giới tính</FieldLbl>
              <View style={styles.genRow}>
                {(['female', 'male'] as const).map((k) => {
                  const lbl = k === 'male' ? 'Nam' : 'Nữ'
                  const on = gender === k
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setGender(on ? '' : k)}
                      style={[styles.genChip, { borderColor: on ? p.accent : p.border, backgroundColor: on ? `${p.accent}22` : p.canvasMuted }]}
                    >
                      <Text style={{ fontFamily: Font.semiBold, color: on ? p.accent : p.ink }}>{lbl}</Text>
                    </Pressable>
                  )
                })}
                <Pressable onPress={() => setGender('')} style={[styles.genChip, { borderColor: p.border, backgroundColor: p.canvasMuted }]}>
                  <Text style={{ fontFamily: Font.medium, color: p.muted, fontSize: 13 }}>Xóa</Text>
                </Pressable>
              </View>

              <FieldLbl>Sinh (YYYY-MM-DD)</FieldLbl>
              <TextInput
                value={birth}
                onChangeText={setBirth}
                placeholder="Tuỳ chọn"
                placeholderTextColor={p.muted}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                style={[styles.input, { borderColor: p.border, color: p.ink, fontFamily: Font.regular, backgroundColor: p.canvasMuted }]}
              />

              <FieldLbl>Mất (YYYY-MM-DD)</FieldLbl>
              <TextInput
                value={death}
                onChangeText={setDeath}
                placeholder="Tuỳ chọn — khi không còn"
                placeholderTextColor={p.muted}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                style={[styles.input, { borderColor: p.border, color: p.ink, fontFamily: Font.regular, backgroundColor: p.canvasMuted }]}
              />

              <FieldLbl>Đời trong phả</FieldLbl>
              <TextInput
                value={lineageGEN}
                onChangeText={setLineageGEN}
                placeholder="Tuỳ chọn"
                placeholderTextColor={p.muted}
                keyboardType="number-pad"
                style={[styles.input, { borderColor: p.border, color: p.ink, fontFamily: Font.regular, backgroundColor: p.canvasMuted }]}
              />

              <FieldLbl>Cha</FieldLbl>
              <Pressable
                accessibilityRole="button"
                style={[styles.pickerTap, { borderColor: p.border, backgroundColor: p.canvasMuted }]}
                onPress={() => setPick('father')}
              >
                <Text style={{ flex: 1, color: p.ink, fontFamily: Font.regular }} numberOfLines={2}>{fatherLbl}</Text>
                <FontAwesome name="chevron-down" color={p.muted} size={14} />
              </Pressable>

              <FieldLbl>Mẹ</FieldLbl>
              <Pressable
                accessibilityRole="button"
                style={[styles.pickerTap, { borderColor: p.border, backgroundColor: p.canvasMuted }]}
                onPress={() => setPick('mother')}
              >
                <Text style={{ flex: 1, color: p.ink, fontFamily: Font.regular }} numberOfLines={2}>{motherLbl}</Text>
                <FontAwesome name="chevron-down" color={p.muted} size={14} />
              </Pressable>

              {supportsPhoneColumn ? (
                <>
                  <FieldLbl>Điện thoại</FieldLbl>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Tuỳ chọn"
                    placeholderTextColor={p.muted}
                    keyboardType="phone-pad"
                    style={[styles.input, { borderColor: p.border, color: p.ink, fontFamily: Font.regular, backgroundColor: p.canvasMuted }]}
                  />
                </>
              ) : null}

              <FieldLbl>Ghi chú</FieldLbl>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Tuỳ chọn"
                placeholderTextColor={p.muted}
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.notesArea,
                  { borderColor: p.border, color: p.ink, fontFamily: Font.regular, backgroundColor: p.canvasMuted },
                ]}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PickMemberSheet
        visible={pick === 'father'}
        title="Chọn cha"
        options={pickFatherOpts}
        onPick={(id) => setFatherId(id)}
        onClose={() => setPick(null)}
      />
      <PickMemberSheet
        visible={pick === 'mother'}
        title="Chọn mẹ"
        options={pickMotherOpts}
        onPick={(id) => setMotherId(id)}
        onClose={() => setPick(null)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginHorizontal: 10,
    maxHeight: Platform.OS === 'ios' ? '88%' : '92%',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  hdr: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  form: {
    padding: 18,
    paddingBottom: 32,
    gap: 0,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    marginBottom: 16,
  },
  notesArea: { minHeight: 90, paddingTop: 12 },
  err: {
    marginBottom: 14,
    fontSize: 14,
  },
  genRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  genChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
})
