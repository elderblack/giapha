import FontAwesome from '@expo/vector-icons/FontAwesome'
import { ResizeMode, Video } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  InteractionManager,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { prefetchFeedLightboxSlides } from '@/lib/feed/prefetchFeedMedia'
import { Text } from '@/components/Themed'
import { Font } from '@/theme/typography'

export type FeedMediaLightboxSlide = { uri: string; kind: 'image' | 'video' }

export type FeedMediaLightboxProps = {
  visible: boolean
  slides: FeedMediaLightboxSlide[]
  initialIndex: number
  onClose: () => void
  authorName: string
  timeLabel: string
  reactionBusy: boolean
  currentUserId: string | undefined
  reactLabelShort: string
  mineReact: boolean
  onReactionPress: () => void
  onCommentPress: () => void
  onSharePress: () => void
  accent: string
}

export const FeedMediaLightbox = memo(function FeedMediaLightboxInner({
  visible,
  slides,
  initialIndex,
  onClose,
  authorName,
  timeLabel,
  reactionBusy,
  currentUserId,
  reactLabelShort,
  mineReact,
  onReactionPress,
  onCommentPress,
  onSharePress,
  accent,
}: FeedMediaLightboxProps) {
  const insets = useSafeAreaInsets()
  const { width: screenW, height: screenH } = useWindowDimensions()
  const listRef = useRef<FlatList<FeedMediaLightboxSlide>>(null)
  const [showChrome, setShowChrome] = useState(true)
  const [page, setPage] = useState(initialIndex)

  useEffect(() => {
    if (visible) {
      setShowChrome(true)
      setPage(initialIndex)
    }
  }, [visible, initialIndex])

  useEffect(() => {
    if (!visible || !slides.length) return
    const h = InteractionManager.runAfterInteractions(() => {
      prefetchFeedLightboxSlides(slides)
    })
    return () => h.cancel()
  }, [visible, slides])

  const scrollToIdx = useCallback(
    (idx: number, animated: boolean) => {
      if (!slides.length || screenW <= 0) return
      const safe = Math.max(0, Math.min(idx, slides.length - 1))
      listRef.current?.scrollToIndex({ index: safe, animated })
    },
    [slides.length, screenW],
  )

  useEffect(() => {
    if (!visible || !slides.length) return
    const id = requestAnimationFrame(() => scrollToIdx(initialIndex, false))
    return () => cancelAnimationFrame(id)
  }, [visible, initialIndex, slides.length, scrollToIdx])

  const slideH = Math.max(1, screenH)

  /** Chừa chỗ đáy để không che native controls (mute/fullscreen…) của expo-av. */
  const videoBottomReserve = showChrome
    ? Math.min(Math.max(insets.bottom, 12) + 172, Math.floor(screenH * 0.42))
    : 0

  /** Đẩy video xuống chút khỏi vùng sát mép/status + top bar chồng lên. */
  const videoTopPad = showChrome ? Math.round(Math.min(screenH * 0.025, 24)) : 8

  const currentSlide = slides[page]
  const nativeTopRightReserve =
    Math.max(insets.right, 12) + (currentSlide?.kind === 'video' ? 120 : 12)

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x
      const next = Math.round(x / screenW)
      setPage(Math.max(0, Math.min(next, slides.length - 1)))
    },
    [screenW, slides.length],
  )

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<FeedMediaLightboxSlide>) =>
      item.kind === 'image' ? (
        <Pressable
          style={[styles.slide, { width: screenW, height: slideH }]}
          onPress={() => setShowChrome((s) => !s)}
          accessibilityLabel="Ẩn hoặc hiện giao diện xem ảnh"
        >
          <Image source={{ uri: item.uri }} style={styles.fullImage} resizeMode="contain" />
        </Pressable>
      ) : (
        <View
          style={[
            styles.slide,
            { width: screenW, height: slideH, paddingTop: videoTopPad, paddingBottom: videoBottomReserve },
          ]}
        >
          <Video
            source={{ uri: item.uri }}
            style={styles.videoInSlide}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls={showChrome}
            shouldPlay={visible && index === page}
            isMuted={false}
            isLooping
            pointerEvents={showChrome ? 'auto' : 'none'}
          />
          {showChrome ? (
            <Pressable
              style={[
                styles.videoChromeDismissLayer,
                {
                  top: insets.top + 52,
                  left: Math.max(insets.left, 8) + 16,
                  right: Math.max(insets.right, 12) + 124,
                  bottom: Math.max(insets.bottom, 8) + Math.min(160, Math.floor(screenH * 0.23)),
                },
              ]}
              onPress={() => setShowChrome(false)}
              accessibilityLabel="Ẩn giao diện, chỉ xem media (chạm giữa màn hình)"
            />
          ) : (
            <Pressable
              style={[styles.videoTouchLayer, { zIndex: 4 }]}
              onPress={() => setShowChrome(true)}
              accessibilityLabel="Hiện giao diện xem video"
            />
          )}
        </View>
      ),
    [screenW, slideH, showChrome, visible, page, videoBottomReserve, videoTopPad, insets, screenH],
  )

  if (!slides.length) return null

  const initial = Math.min(initialIndex, slides.length - 1)

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar hidden={visible} />
      <View style={styles.root}>
        {showChrome ? (
          <View style={[styles.topBar, { paddingTop: insets.top + 6 }]} accessibilityRole="toolbar">
            <View style={styles.topBarLeft}>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Đóng">
                <FontAwesome name="times" size={26} color="#FFF" />
              </Pressable>
            </View>
            <Text
              style={[styles.counterTxt, { fontFamily: Font.semiBold, flex: 1, textAlign: 'center' }]}
              pointerEvents="none"
            >
              {slides.length > 1 ? `${page + 1} / ${slides.length}` : ' '}
            </Text>
            <View style={{ width: nativeTopRightReserve }} pointerEvents="none" />
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          extraData={[showChrome, page, visible, videoBottomReserve, videoTopPad]}
          data={slides}
          keyExtractor={(it, i) => `${i}-${it.kind}-${it.uri}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          renderItem={renderItem}
          initialScrollIndex={initial}
          getItemLayout={(_, index) => ({
            length: screenW,
            offset: screenW * index,
            index,
          })}
          onMomentumScrollEnd={onScrollEnd}
          onScrollToIndexFailed={({ index }) => requestAnimationFrame(() => scrollToIdx(index, false))}
          windowSize={5}
          maxToRenderPerBatch={3}
          initialNumToRender={2}
          removeClippedSubviews
        />

        {showChrome ? (
          <>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.88)']}
              pointerEvents="none"
              style={[styles.bottomFade, { paddingBottom: Math.max(insets.bottom, 10) + 52 }]}
            >
              <Text style={[styles.metaName, { fontFamily: Font.bold }]} numberOfLines={1}>
                {authorName}
              </Text>
              <Text style={[styles.metaTime, { fontFamily: Font.regular }]} numberOfLines={1}>
                {timeLabel}
                {' · '}Chỉ dòng họ
              </Text>
            </LinearGradient>
            <View
              style={[
                styles.actionBar,
                {
                  paddingBottom: Math.max(insets.bottom, 8),
                  borderTopColor: 'rgba(255,255,255,0.12)',
                },
              ]}
            >
              <Pressable
                style={styles.actionBtn}
                disabled={reactionBusy || !currentUserId}
                onPress={onReactionPress}
                accessibilityLabel="Thích"
              >
                <FontAwesome name={mineReact ? 'thumbs-up' : 'thumbs-o-up'} size={20} color={mineReact ? accent : '#E5E7EB'} />
                <Text style={[styles.actionTxt, { color: mineReact ? accent : '#E5E7EB', fontFamily: Font.semiBold }]}>
                  {reactLabelShort}
                </Text>
              </Pressable>
              <View style={styles.actionSep} />
              <Pressable style={styles.actionBtn} onPress={onCommentPress} accessibilityLabel="Bình luận">
                <FontAwesome name="comment-o" size={20} color="#E5E7EB" />
                <Text style={[styles.actionTxt, { color: '#E5E7EB', fontFamily: Font.semiBold }]}>Bình luận</Text>
              </Pressable>
              <View style={styles.actionSep} />
              <Pressable style={styles.actionBtn} onPress={onSharePress} accessibilityLabel="Chia sẻ">
                <FontAwesome name="send" size={18} color="#E5E7EB" />
                <Text style={[styles.actionTxt, { color: '#E5E7EB', fontFamily: Font.semiBold }]}>Chia sẻ</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    pointerEvents: 'box-none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  counterTxt: {
    color: '#FFF',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  slide: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  fullImage: { width: '100%', height: '100%' },
  /** Video co vùng an toàn phía trên overlay dưới — native controls bám mép đáy khối Video. */
  videoInSlide: { flex: 1, width: '100%', minHeight: 0 },
  videoTouchLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  /** Vùng chạm giữa để ẩn chrome; mép chừa để tiếng/mute/native bar vẫn bấm được. */
  videoChromeDismissLayer: {
    position: 'absolute',
    zIndex: 3,
    backgroundColor: 'transparent',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 48,
    zIndex: 8,
  },
  metaName: { color: '#FFF', fontSize: 16 },
  metaTime: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  actionSep: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'stretch' },
  actionTxt: { fontSize: 14 },
})
