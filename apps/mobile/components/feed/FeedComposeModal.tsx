import FontAwesome from '@expo/vector-icons/FontAwesome'
import * as ImagePicker from 'expo-image-picker'
import { ComposeVideoThumbnail } from '@/components/feed/expoFeedVideo'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'

import { Text } from '@/components/Themed'
import { usePalette } from '@/hooks/usePalette'
import { Font } from '@/theme/typography'

type DraftAsset = ImagePicker.ImagePickerAsset

export type FeedComposeTreeOption = { id: string; name: string }

export type FeedComposePublishResult = { ok: true } | { ok: false; error: string }

const PICKER_BASE = {
  allowsEditing: false,
  copyToCacheDirectory: true,
  quality: 0.88 as const,
  videoMaxDuration: 180,
  videoExportPreset: ImagePicker.VideoExportPreset.MEDIUM_QUALITY,
} as const

/** iOS: tránh HEIC — JPEG/PNG tương thích web & RN Image từ URL. */
const PICKER_IOS_COMPAT =
  Platform.OS === 'ios'
    ? ({
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      } satisfies Partial<ImagePicker.ImagePickerOptions>)
    : ({} satisfies Partial<ImagePicker.ImagePickerOptions>)

export function FeedComposeModal({
  visible,
  onClose,
  busy,
  onPublish,
  avatarUrl,
  initials,
  trees,
  selectedTreeId,
  onTreeChange,
  initialLibrary = null,
}: {
  visible: boolean
  onClose: () => void
  busy: boolean
  onPublish: (body: string, assets: DraftAsset[]) => Promise<FeedComposePublishResult>
  avatarUrl: string | null
  initials: string
  trees?: FeedComposeTreeOption[]
  selectedTreeId?: string | null
  onTreeChange?: (treeId: string) => void
  /** Khi mở modal: tự mở thư viện (một lần) — ví dụ lối tắt «Clip». */
  initialLibrary?: 'all' | 'video' | null
}) {
  const p = usePalette()
  const [draft, setDraft] = useState('')
  const [assets, setAssets] = useState<DraftAsset[]>([])
  const autoPickDoneRef = useRef(false)

  const resetLocal = useCallback(() => {
    setDraft('')
    setAssets([])
  }, [])

  const handleClose = useCallback(() => {
    resetLocal()
    onClose()
  }, [onClose, resetLocal])

  const pickPhotos = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Quyền truy cập', 'Cần quyền thư viện ảnh để đính kèm media.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      ...PICKER_BASE,
      ...PICKER_IOS_COMPAT,
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 8,
    })
    if (!result.canceled && result.assets.length) {
      setAssets((prev) => [...prev, ...result.assets].slice(0, 12))
    }
  }, [])

  const pickVideos = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Quyền truy cập', 'Cần quyền thư viện để chọn video.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      ...PICKER_BASE,
      ...PICKER_IOS_COMPAT,
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      selectionLimit: 4,
    })
    if (!result.canceled && result.assets.length) {
      setAssets((prev) => [...prev, ...result.assets].slice(0, 12))
    }
  }, [])

  useEffect(() => {
    if (!visible) {
      autoPickDoneRef.current = false
      return
    }
    if (!initialLibrary || autoPickDoneRef.current || busy) return
    autoPickDoneRef.current = true
    void (initialLibrary === 'video' ? pickVideos() : pickPhotos())
  }, [visible, initialLibrary, busy, pickPhotos, pickVideos])

  const submit = async () => {
    if (__DEV__) {
      console.log('[feed-compose] submit', {
        draftLen: draft.trim().length,
        assetCount: assets.length,
        assetTypes: assets.map((a) => a.type ?? null),
        mimeTypes: assets.map((a) => a.mimeType ?? null),
      })
    }
    const result = await onPublish(draft, assets)
    if (__DEV__) console.log('[feed-compose] result', result)
    if (result.ok) {
      resetLocal()
      handleClose()
    } else if (result.error) {
      Alert.alert('Không đăng được', result.error)
    }
  }

  const canPublish = Boolean(draft.trim().length || assets.length) && !busy

  const audienceTrees = trees ?? []
  const singleTreeName = audienceTrees.length === 1 ? audienceTrees[0].name : null
  const multiTrees = audienceTrees.length > 1
  const selectedTreeName =
    audienceTrees.find((t) => t.id === selectedTreeId)?.name ??
    audienceTrees[0]?.name ??
    null

  const openTreePicker = () => {
    if (!multiTrees || !onTreeChange || busy) return
    const buttons = audienceTrees.map((t) => ({
      text: t.name,
      onPress: () => onTreeChange(t.id),
    }))
    Alert.alert('Đăng vào dòng họ', 'Chọn dòng họ nhận bài đăng.', [
      ...buttons,
      { text: 'Huỷ', style: 'cancel' },
    ])
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.wrap, { backgroundColor: p.canvas }]}
      >
        <View style={[styles.sheetHeader, { borderBottomColor: p.border }]}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={{ fontFamily: Font.semiBold, color: p.muted, fontSize: 16 }}>Huỷ</Text>
          </Pressable>
          <Text style={{ fontFamily: Font.bold, color: p.ink, fontSize: 17 }}>Bài viết trong dòng họ</Text>
          <Pressable
            onPress={() => void submit()}
            disabled={!canPublish}
            hitSlop={12}
            style={{
              opacity: canPublish ? 1 : 0.38,
              backgroundColor: p.accent,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 8,
            }}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={{ fontFamily: Font.bold, color: '#FFF', fontSize: 14 }}>Đăng</Text>
            )}
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollInner}>
          <View style={styles.authorRow}>
            <View style={[styles.sheetAvatar, { borderColor: p.border }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.sheetAvatarImg} />
              ) : (
                <LinearGradient colors={[p.accent, '#DD2476']} style={styles.sheetAvatarImg} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}>
                  <Text style={[styles.sheetInitials, { fontFamily: Font.bold }]}>{initials}</Text>
                </LinearGradient>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={multiTrees ? 'Chọn dòng họ đăng bài' : 'Đối tượng: chỉ dòng họ'}
                onPress={() => {
                  if (multiTrees) openTreePicker()
                  else
                    Alert.alert(
                      'Chỉ dòng họ',
                      'Ảnh và bài viết chỉ được thành viên trong dòng họ này xem trong bảng tin.',
                    )
                }}
                style={({ pressed }) => [
                  styles.audiencePill,
                  { backgroundColor: p.canvasMuted, borderColor: p.border, opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <FontAwesome name="lock" size={12} color={p.muted} style={{ marginRight: 6 }} />
                <Text style={{ fontFamily: Font.semiBold, color: p.inkMuted, fontSize: 13 }} numberOfLines={1}>
                  {selectedTreeName ? selectedTreeName : singleTreeName ? singleTreeName : 'Chỉ dòng họ'}
                </Text>
                <FontAwesome name="angle-down" size={13} color={p.muted} style={{ marginLeft: 4 }} />
              </Pressable>
              <Text style={{ fontFamily: Font.bold, color: p.ink, fontSize: 16, marginTop: 8 }}>
                {selectedTreeName ? `Đăng vào ${selectedTreeName}` : 'Đăng vào dòng họ'}
              </Text>
              <Text style={{ fontFamily: Font.regular, color: p.muted, fontSize: 13, marginTop: 2 }}>
                Ai trong dòng họ được xem bài cũng đọc được bài này trên bảng tin
              </Text>
            </View>
          </View>

          <TextInput
            editable={!busy}
            multiline
            placeholder="Bạn đang nghĩ gì…?"
            placeholderTextColor={p.muted}
            selectionColor={p.accent}
            style={[styles.input, { color: p.ink, fontFamily: Font.regular }, { marginTop: 16 }]}
            value={draft}
            onChangeText={setDraft}
          />

          {assets.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
              {assets.map((a, idx) => {
                const isVideo =
                  a.type === 'video' ||
                  (typeof a.mimeType === 'string' && a.mimeType.startsWith('video')) ||
                  (typeof a.duration === 'number' && a.duration > 0)
                return (
                  <View key={`${a.uri}-${idx}`} style={styles.thumbWrap}>
                    {isVideo ? (
                      <View style={styles.thumbVidBox}>
                        <ComposeVideoThumbnail uri={a.uri} style={styles.thumb} />
                        <View style={[styles.playBadge, { backgroundColor: `${p.accent}E6` }]}>
                          <FontAwesome name="film" color="#FFF" size={14} />
                        </View>
                      </View>
                    ) : (
                      <Image source={{ uri: a.uri }} style={styles.thumb} />
                    )}
                    <Pressable
                      accessibilityLabel="Bỏ"
                      style={[styles.rmThumb, { backgroundColor: p.inkMuted }]}
                      disabled={busy}
                      onPress={() => setAssets((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <FontAwesome name="times" color="#FFF" size={14} />
                    </Pressable>
                  </View>
                )
              })}
            </ScrollView>
          ) : null}

          <View style={styles.addMediaGrid}>
            <Pressable
              style={[styles.addMediaRow, { backgroundColor: p.surfaceElevated, borderColor: p.border }]}
              onPress={() => void pickPhotos()}
              disabled={busy}
            >
              <FontAwesome name="photo" size={20} color={p.accent} />
              <Text style={{ marginLeft: 10, fontFamily: Font.medium, color: p.ink }}>Ảnh &amp; video</Text>
            </Pressable>
            <Pressable
              style={[styles.addMediaRow, { backgroundColor: p.surfaceElevated, borderColor: p.border }]}
              onPress={() => void pickVideos()}
              disabled={busy}
            >
              <FontAwesome name="video-camera" size={20} color={p.accent} />
              <Text style={{ marginLeft: 10, fontFamily: Font.medium, color: p.ink }}>Chỉ video</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollInner: { padding: 18, paddingBottom: 40 },
  authorRow: { flexDirection: 'row', alignItems: 'flex-start' },
  audiencePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetAvatarImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  sheetInitials: { fontSize: 19, color: '#FFF' },
  input: { fontSize: 18, lineHeight: 26, minHeight: 120, textAlignVertical: 'top' },
  thumbRow: { marginTop: 14, maxHeight: 108 },
  thumbWrap: { marginRight: 10, width: 100, height: 100 },
  thumbVidBox: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden' },
  playBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: { width: 100, height: 100, borderRadius: 12 },
  rmThumb: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMediaGrid: { marginTop: 14, gap: 10 },
  addMediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
