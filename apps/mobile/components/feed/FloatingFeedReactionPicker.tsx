import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated'

import { FEED_REACTION_KINDS, FEED_REACTION_EMOJI, FEED_REACTION_VI, type FeedReactionKind } from '@/lib/feed/reactionKinds'

const CHIP = 54
const PAD_X = 14
const ROW_V_PAD = 10

export type ReactionAnchorRect = { x: number; y: number; width: number; height: number }

type Props = {
  visible: boolean
  anchor: ReactionAnchorRect | null
  onClose: () => void
  onPick: (k: FeedReactionKind) => void
  surface: string
  border: string
  muted: string
}

export function FloatingFeedReactionPicker({ visible, anchor, onClose, onPick, surface, border, muted }: Props) {
  const { width: winW, height: winH } = useWindowDimensions()
  const rowW = FEED_REACTION_KINDS.length * CHIP + PAD_X * 2
  const centerX = anchor ? anchor.x + anchor.width / 2 : winW / 2
  let left = centerX - rowW / 2
  left = Math.min(Math.max(left, 8), winW - rowW - 8)
  const top = anchor ? Math.max(56, anchor.y - 92) : winH * 0.28
  const pillBottom = top + ROW_V_PAD * 2 + CHIP

  if (!visible || anchor == null) return null

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={StyleSheet.absoluteFill}>
          <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} accessibilityLabel="Đóng" />
        </Animated.View>

        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            style={[
              styles.pill,
              {
                left,
                top,
                width: rowW,
                backgroundColor: surface,
                borderColor: border,
              },
              Platform.OS === 'ios'
                ? { shadowColor: '#000', shadowOpacity: 0.26, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }
                : { elevation: 14 },
            ]}
          >
            <View style={styles.pillInner}>
              {FEED_REACTION_KINDS.map((k, idx) => (
                <Animated.View key={k} entering={FadeIn.delay(38 * idx + 36).duration(280)} style={styles.chipWrap}>
                  <Pressable
                    accessibilityLabel={`Cảm xúc ${FEED_REACTION_VI[k]}`}
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={() => {
                      onPick(k)
                      onClose()
                    }}
                    style={styles.chipTap}
                  >
                    <Text style={styles.chipEmoji}>{FEED_REACTION_EMOJI[k]}</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(200).duration(260)} exiting={FadeOut.duration(140)} style={[styles.hintBox, { top: pillBottom + 6 }]}>
            <Text style={[styles.hint, { color: muted }]}>Nhấn để chọn cảm xúc</Text>
          </Animated.View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(20,21,26,0.24)' },
  pill: {
    position: 'absolute',
    paddingVertical: ROW_V_PAD,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillInner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  chipWrap: { alignItems: 'center', justifyContent: 'center' },
  chipTap: { width: CHIP, height: CHIP, alignItems: 'center', justifyContent: 'center' },
  chipEmoji: { fontSize: 32, lineHeight: 38 },
  hintBox: { position: 'absolute', left: 12, right: 12 },
  hint: { textAlign: 'center', fontSize: 13, fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }) },
})
