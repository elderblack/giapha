import FontAwesome from '@expo/vector-icons/FontAwesome'
import { ResizeMode, Video } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle, useWindowDimensions } from 'react-native'

import { FloatingFeedReactionPicker, type ReactionAnchorRect } from '@/components/feed/FloatingFeedReactionPicker'
import { FeedMediaLightbox } from '@/components/feed/FeedMediaLightbox'
import { Text } from '@/components/Themed'
import type { FeedPostState } from '@/lib/feed/feedQueries'
import { getFeedMediaPublicUrl } from '@/lib/feed/feedQueries'
import {
  FEED_REACTION_EMOJI,
  FEED_REACTION_VI,
  reactionEmoji,
  type FeedReactionKind,
} from '@/lib/feed/reactionKinds'
import { formatFeedRelativeVi } from '@/lib/feed/feedDate'
import { useFeedImageLayoutMobile } from '@/hooks/useFeedImageLayoutMobile'
import { usePalette } from '@/hooks/usePalette'
import { Font } from '@/theme/typography'

function reactionRibbon(post: FeedPostState): { emojis: string; count: number } {
  const count = post.reactions.length
  if (!count) return { emojis: '', count: 0 }
  const kinds = [...new Set(post.reactions.map((r) => r.kind))]
  kinds.sort(
    (a, b) =>
      post.reactions.filter((x) => x.kind === b).length - post.reactions.filter((x) => x.kind === a).length,
  )
  const emojis = kinds.slice(0, 4).map((k) => reactionEmoji(k)).join('')
  return { emojis, count }
}

export type FeedPostBodyMobileProps = {
  post: FeedPostState
  currentUserId: string | undefined
  busy: boolean
  toggleReact: (kind: FeedReactionKind) => void
  confirmDeletePost: () => void
  onCommentPress: () => void
  /** Bấm số đếm bình luận (như FB) — mặc định giống onCommentPress */
  onCommentCountPress?: () => void
  /** media rộng tối đa; không truyền thì lấy từ cửa sổ */
  imageMaxWOverride?: number
  /**
   * feedPoster (bảng tin): ô video dạng ảnh + mở lightbox khi chạm.
   * defer: chỉ ô play, mở bài chi tiết.
   * inline: player ngay trong bài (màn chi tiết).
   */
  videoMode?: 'defer' | 'inline' | 'feedPoster'
  /** Trên bảng tin (`feedPoster`): bài được chọn theo viewport — tự phát video đầu tiên mute. */
  embedAutoplayActive?: boolean
  /** Mở hồ sơ tác giả (avatar + tên). */
  onAuthorPress?: () => void
}

export const FeedPostBodyMobile = memo(function FeedPostBodyMobileInner({
  post,
  currentUserId,
  busy,
  toggleReact,
  confirmDeletePost,
  onCommentPress,
  onCommentCountPress,
  imageMaxWOverride,
  videoMode = 'inline',
  embedAutoplayActive = false,
  onAuthorPress,
}: FeedPostBodyMobileProps) {
  const p = usePalette()
  const profile = post.profiles
  const initials =
    profile?.full_name
      ?.trim()
      ?.split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join('')
      .toUpperCase() ?? '?'
  const mine = Boolean(currentUserId && post.author_id === currentUserId)
  const mineReact = post.reactions.find((r) => r.user_id === currentUserId)
  const ribbon = reactionRibbon(post)

  const reactAnchorRef = useRef<View>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerAnchor, setPickerAnchor] = useState<ReactionAnchorRect | null>(null)
  const [mediaViewerIndex, setMediaViewerIndex] = useState<number | null>(null)

  useEffect(() => {
    setMediaViewerIndex(null)
  }, [post.id])

  const { width: winW, height: winH } = useWindowDimensions()
  const imageMaxW = imageMaxWOverride ?? Math.min(winW - 48, 560)

  type MediaPreview = (typeof post.media)[0] & { url: string }

  const sortedPreviews = useMemo((): MediaPreview[] => {
    return [...post.media]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((m) => {
        const url = getFeedMediaPublicUrl(m.storage_path)
        return url ? ({ ...m, url } as MediaPreview) : null
      })
      .filter(Boolean) as MediaPreview[]
  }, [post.media])

  const onlyImages =
    sortedPreviews.length > 0 && sortedPreviews.every((x) => x.media_kind === 'image')

  const allImageCluster = sortedPreviews.length >= 2 && onlyImages

  const probeUrls = useMemo(
    () => (allImageCluster ? sortedPreviews.map((p) => p.url) : []),
    [allImageCluster, sortedPreviews],
  )
  const { layoutHint } = useFeedImageLayoutMobile(probeUrls)

  const lightboxSlides = useMemo(
    () =>
      sortedPreviews.map((m) => ({
        uri: m.url,
        kind: (m.media_kind === 'video' ? 'video' : 'image') as 'video' | 'image',
      })),
    [sortedPreviews],
  )

  const firstSoloImageId = onlyImages && sortedPreviews.length === 1 ? sortedPreviews[0].id : null
  const [soloImageDims, setSoloImageDims] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    setSoloImageDims(null)
  }, [firstSoloImageId])

  const feedPosterVideoTileH = useMemo(() => {
    const cap = Math.min(winH * 0.58, 480)
    return Math.min(Math.max(imageMaxW * (9 / 16), 200), cap)
  }, [imageMaxW, winH])

  const openViewerAt = useCallback(
    (sortedIdx: number) => {
      if (sortedIdx < 0 || sortedIdx >= sortedPreviews.length) return
      setMediaViewerIndex(sortedIdx)
    },
    [sortedPreviews.length],
  )

  const primaryVideoSortedIndex = useMemo(
    () => sortedPreviews.findIndex((x) => x.media_kind === 'video'),
    [sortedPreviews],
  )

  const feedPosterViewportAutoplay =
    videoMode === 'feedPoster' && embedAutoplayActive && primaryVideoSortedIndex >= 0

  const soloImageHeight = useMemo(() => {
    const cap = Math.min(winH * 0.75, 560)
    const minH = 200
    if (!soloImageDims || soloImageDims.w < 1) return Math.min(Math.max(imageMaxW * 0.65, minH), cap)
    const h = (imageMaxW * soloImageDims.h) / soloImageDims.w
    return Math.min(Math.max(h, minH), cap)
  }, [soloImageDims, imageMaxW, winH])
  const clusterHMul = layoutHint === 'portrait-row' ? 0.95 : 0.62
  const clusterHCap = layoutHint === 'portrait-row' ? 620 : 520
  const clusterHNorm = Math.min(Math.max(imageMaxW * clusterHMul, 188), Math.min(winH * 0.74, clusterHCap))

  const mediaGap = 3

  const hasStatsLine = ribbon.count > 0 || post.comments.length > 0
  const reactLabelShort = mineReact ? `${FEED_REACTION_EMOJI[mineReact.kind]} ${FEED_REACTION_VI[mineReact.kind]}` : 'Thích'

  const onCountComments = onCommentCountPress ?? onCommentPress

  function openReactionPalette() {
    reactAnchorRef.current?.measureInWindow((x, y, width, height) => {
      setPickerAnchor({ x, y, width, height })
      setPickerOpen(true)
    })
  }

  function quickReactTap() {
    if (!currentUserId || busy) return
    if (!mineReact) void toggleReact('like')
    else void toggleReact(mineReact.kind)
  }

  return (
    <View>
      <View style={styles.cardHead}>
        <Pressable
          onPress={onAuthorPress}
          disabled={!onAuthorPress}
          style={[styles.cardHeadMain, !onAuthorPress ? styles.cardHeadMainNoPress : null]}
          accessibilityRole={onAuthorPress ? 'button' : undefined}
          accessibilityLabel={onAuthorPress ? 'Hồ sơ tác giả' : undefined}
        >
          <View style={[styles.avatar, { borderColor: p.border }]}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
            ) : (
              <LinearGradient colors={[p.accent, '#C026D3']} style={styles.avatarImg} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}>
                <Text style={[styles.initialsTxt, { fontFamily: Font.bold }]}>{initials}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.bold, fontSize: 15, color: p.ink }} numberOfLines={1}>
              {profile?.full_name?.trim() || 'Thành viên họ'}
            </Text>
            <View style={styles.metaSubRow}>
              <Text style={{ fontFamily: Font.regular, fontSize: 13, color: p.muted }}>{formatFeedRelativeVi(post.created_at)}</Text>
              <Text style={{ fontFamily: Font.regular, fontSize: 13, color: p.muted }}> · </Text>
              <FontAwesome name="lock" size={11} color={p.muted} style={{ marginRight: 4 }} />
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: p.inkMuted }} numberOfLines={1}>
                {post.tree_name?.trim() ? post.tree_name.trim() : 'Chỉ dòng họ'}
              </Text>
            </View>
          </View>
        </Pressable>
        {mine ? (
          <Pressable hitSlop={10} onPress={confirmDeletePost} accessibilityLabel="Tuỳ chọn bài đăng">
            <FontAwesome name="ellipsis-h" color={p.muted} size={18} />
          </Pressable>
        ) : null}
      </View>

      {post.body ? (
        <Text style={[styles.body, { color: p.ink, fontFamily: Font.regular }]} selectable>
          {post.body}
        </Text>
      ) : null}

      {sortedPreviews.length ? (
        <View style={styles.mediaBlock}>
          {sortedPreviews.length === 1 && sortedPreviews[0].media_kind === 'video' ? (
            videoMode === 'feedPoster' ? (
              <Pressable
                onPress={() => openViewerAt(0)}
                accessibilityLabel="Xem video phóng to"
                style={{ alignSelf: 'center', borderRadius: 10, overflow: 'hidden' }}
              >
                <View style={{ width: imageMaxW, height: feedPosterVideoTileH, backgroundColor: '#000' }}>
                  <Video
                    source={{ uri: sortedPreviews[0].url }}
                    style={styles.mosaicCover}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={feedPosterViewportAutoplay}
                    isMuted
                    isLooping={feedPosterViewportAutoplay}
                    useNativeControls={false}
                  />
                  <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.videoPosterOverlay]}>
                    {feedPosterViewportAutoplay ? null : (
                      <FontAwesome name="play-circle" size={54} color="rgba(255,255,255,0.92)" />
                    )}
                  </View>
                </View>
              </Pressable>
            ) : videoMode === 'defer' ? (
              <Pressable
                key={sortedPreviews[0].id}
                onPress={onCommentPress}
                accessibilityLabel="Mở bài chi tiết để xem video"
                style={[styles.videoShell, { width: imageMaxW, borderColor: p.border }]}
              >
                <View style={[styles.videoDeferred, { backgroundColor: '#111' }]}>
                  <FontAwesome name="play-circle" size={56} color="rgba(255,255,255,0.9)" />
                  <Text style={{ marginTop: 8, fontFamily: Font.medium, fontSize: 13, color: '#e5e7eb' }}>Chạm để xem trong bài chi tiết</Text>
                </View>
              </Pressable>
            ) : (
              <View style={[styles.videoShell, { width: imageMaxW, borderColor: p.border }]}>
                <Video
                  source={{ uri: sortedPreviews[0].url }}
                  style={styles.videoPlayer}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={false}
                  isMuted={false}
                />
              </View>
            )
          ) : onlyImages && sortedPreviews.length === 1 ? (
            <Pressable
              onPress={() => openViewerAt(0)}
              accessibilityLabel="Xem ảnh phóng to"
              style={{ alignSelf: 'center' }}
            >
              <Image
                key={(sortedPreviews[0] as MediaPreview).id}
                source={{ uri: (sortedPreviews[0] as MediaPreview).url }}
                style={[
                  styles.singleHeroImg,
                  {
                    width: imageMaxW,
                    height: soloImageHeight,
                    backgroundColor: p.canvasMuted,
                  },
                ]}
                resizeMode="contain"
                onLoad={(ev) => {
                  const src = ev.nativeEvent.source
                  if (src?.width && src?.height) setSoloImageDims({ w: src.width, h: src.height })
                }}
              />
            </Pressable>
          ) : allImageCluster ? (
            (() => {
              const n = sortedPreviews.length
              const imgs = sortedPreviews as MediaPreview[]

              function ImageCell({ m, tileIndex, style }: { m: MediaPreview; tileIndex: number; style: StyleProp<ViewStyle> }) {
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xem ảnh phóng to"
                    onPress={() => openViewerAt(tileIndex)}
                    style={style}
                  >
                    <Image source={{ uri: m.url }} style={styles.mosaicCover} resizeMode="cover" accessibilityIgnoresInvertColors />
                  </Pressable>
                )
              }

              if (n === 2 || n === 3) {
                const rowH = clusterHNorm
                return (
                  <View style={[styles.clusterRow, { width: imageMaxW, height: rowH, gap: mediaGap, alignSelf: 'center' }]}>
                    {imgs.map((m, idx) => (
                      <ImageCell
                        key={m.id}
                        m={m}
                        tileIndex={idx}
                        style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', borderRadius: 8 }}
                      />
                    ))}
                  </View>
                )
              }

              if (n === 4) {
                const rowH = (clusterHNorm - mediaGap) / 2
                return (
                  <View style={{ width: imageMaxW, gap: mediaGap, alignSelf: 'center' }}>
                    <View style={[styles.clusterRow, { height: rowH, gap: mediaGap }]}>
                      <ImageCell tileIndex={0} m={imgs[0]} style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', borderRadius: 8 }} />
                      <ImageCell tileIndex={1} m={imgs[1]} style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', borderRadius: 8 }} />
                    </View>
                    <View style={[styles.clusterRow, { height: rowH, gap: mediaGap }]}>
                      <ImageCell tileIndex={2} m={imgs[2]} style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', borderRadius: 8 }} />
                      <ImageCell tileIndex={3} m={imgs[3]} style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', borderRadius: 8 }} />
                    </View>
                  </View>
                )
              }

              const cellSide = (imageMaxW - mediaGap) / 2
              return (
                <View
                  style={[
                    styles.clusterWrap,
                    { width: imageMaxW, columnGap: mediaGap, rowGap: mediaGap, alignSelf: 'center' },
                  ]}
                >
                  {imgs.map((m, idx) => (
                    <ImageCell
                      key={m.id}
                      m={m}
                      tileIndex={idx}
                      style={{
                        width: cellSide,
                        height: cellSide,
                        overflow: 'hidden',
                        borderRadius: 8,
                      }}
                    />
                  ))}
                </View>
              )
            })()
          ) : (
            <View style={{ gap: mediaGap, alignSelf: 'center', width: imageMaxW }}>
              {sortedPreviews.map((m, mediaIdx) =>
                m.media_kind === 'video' ? (
                  videoMode === 'feedPoster' ? (
                    <Pressable
                      key={m.id}
                      onPress={() => openViewerAt(mediaIdx)}
                      accessibilityLabel="Xem video phóng to"
                      style={[styles.videoShell, { width: imageMaxW, height: feedPosterVideoTileH, borderColor: p.border }]}
                    >
                      <Video
                        source={{ uri: m.url }}
                        style={styles.mosaicCover}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={
                          feedPosterViewportAutoplay && mediaIdx === primaryVideoSortedIndex
                        }
                        isMuted
                        isLooping={
                          feedPosterViewportAutoplay && mediaIdx === primaryVideoSortedIndex
                        }
                        useNativeControls={false}
                      />
                      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.videoPosterOverlay]}>
                        {feedPosterViewportAutoplay && mediaIdx === primaryVideoSortedIndex ? null : (
                          <FontAwesome name="play-circle" size={48} color="rgba(255,255,255,0.92)" />
                        )}
                      </View>
                    </Pressable>
                  ) : videoMode === 'defer' ? (
                    <Pressable
                      key={m.id}
                      onPress={onCommentPress}
                      accessibilityLabel="Mở bài chi tiết để xem video"
                      style={[styles.videoShell, { width: imageMaxW, borderColor: p.border }]}
                    >
                      <View style={[styles.videoDeferred, { backgroundColor: '#111' }]}>
                        <FontAwesome name="play-circle" size={56} color="rgba(255,255,255,0.9)" />
                        <Text style={{ marginTop: 8, fontFamily: Font.medium, fontSize: 13, color: '#e5e7eb' }}>Chạm để xem trong bài chi tiết</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <View key={m.id} style={[styles.videoShell, { width: imageMaxW, borderColor: p.border }]}>
                      <Video
                        source={{ uri: m.url }}
                        style={styles.videoPlayer}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay={false}
                        isMuted={false}
                      />
                    </View>
                  )
                ) : (
                  <Pressable
                    key={m.id}
                    onPress={() => openViewerAt(mediaIdx)}
                    accessibilityLabel="Xem ảnh phóng to"
                    style={{ alignSelf: 'center' }}
                  >
                    <Image
                      source={{ uri: m.url }}
                      style={[
                        styles.mixedStillImg,
                        {
                          width: imageMaxW,
                          maxHeight: Math.min(imageMaxW * 0.85, Math.min(winH * 0.52, 400)),
                          backgroundColor: p.canvasMuted,
                        },
                      ]}
                      resizeMode="contain"
                    />
                  </Pressable>
                ),
              )}
            </View>
          )}
        </View>
      ) : null}

      {hasStatsLine ? (
        <View style={[styles.statsRow, { borderTopColor: p.border }]}>
          <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13, color: p.muted }}>
            {ribbon.count > 0 ? `${ribbon.emojis} ${ribbon.count}` : ''}
          </Text>
          {post.comments.length > 0 ? (
            <Pressable onPress={onCountComments} hitSlop={8}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: p.muted }}>{`${post.comments.length} bình luận`}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.fbBar,
          {
            borderTopColor: p.border,
            borderTopWidth: hasStatsLine ? 0 : StyleSheet.hairlineWidth,
            marginTop: hasStatsLine ? 0 : 8,
          },
        ]}
      >
        <View ref={reactAnchorRef} collapsable={false} style={{ flex: 1 }}>
          <Pressable
            style={styles.fbBarBtn}
            disabled={busy}
            delayLongPress={340}
            onLongPress={() => {
              if (!currentUserId || busy) return
              openReactionPalette()
            }}
            onPress={quickReactTap}
            accessibilityLabel="Thích hoặc chọn cảm xúc — nhấn giữ để chọn thêm"
          >
            <FontAwesome
              name={mineReact ? 'thumbs-up' : 'thumbs-o-up'}
              size={18}
              color={mineReact ? p.accent : p.inkMuted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                fontFamily: Font.semiBold,
                fontSize: 14,
                color: mineReact ? p.accent : p.inkMuted,
              }}
              numberOfLines={1}
            >
              {reactLabelShort}
            </Text>
          </Pressable>
        </View>
        <View style={[styles.fbBarSep, { backgroundColor: p.border }]} />
        <Pressable style={styles.fbBarBtn} onPress={onCommentPress} accessibilityLabel="Bình luận">
          <FontAwesome name="comment-o" size={18} color={p.inkMuted} style={{ marginRight: 6 }} />
          <Text style={{ fontFamily: Font.semiBold, fontSize: 14, color: p.inkMuted }}>Bình luận</Text>
        </Pressable>
        <View style={[styles.fbBarSep, { backgroundColor: p.border }]} />
        <Pressable
          style={styles.fbBarBtn}
          onPress={() =>
            Alert.alert('Chia sẻ', 'Tính năng chia sẻ sang app khác sẽ bổ sung sau — bản xem trước đang là bảng tin riêng dòng họ.')
          }
          accessibilityLabel="Chia sẻ"
        >
          <FontAwesome name="send" size={17} color={p.inkMuted} style={{ marginRight: 6 }} />
          <Text style={{ fontFamily: Font.semiBold, fontSize: 14, color: p.inkMuted }}>Chia sẻ</Text>
        </Pressable>
      </View>

      <FloatingFeedReactionPicker
        visible={pickerOpen}
        anchor={pickerAnchor}
        onClose={() => {
          setPickerOpen(false)
          setPickerAnchor(null)
        }}
        onPick={(k) => void toggleReact(k)}
        surface={p.surfaceElevated}
        border={p.border}
        muted={p.muted}
      />

      <FeedMediaLightbox
        visible={mediaViewerIndex != null && lightboxSlides.length > 0}
        slides={lightboxSlides}
        initialIndex={mediaViewerIndex ?? 0}
        onClose={() => setMediaViewerIndex(null)}
        authorName={profile?.full_name?.trim() || 'Thành viên họ'}
        timeLabel={formatFeedRelativeVi(post.created_at)}
        reactionBusy={busy}
        currentUserId={currentUserId}
        reactLabelShort={reactLabelShort}
        mineReact={Boolean(mineReact)}
        onReactionPress={() => quickReactTap()}
        onCommentPress={() => {
          setMediaViewerIndex(null)
          onCommentPress()
        }}
        onSharePress={() =>
          Alert.alert(
            'Chia sẻ',
            'Tính năng chia sẻ sang app khác sẽ bổ sung sau — bản xem trước đang là bảng tin riêng dòng họ.',
          )
        }
        accent={p.accent}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardHeadMain: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10, minWidth: 0 },
  cardHeadMainNoPress: { flex: 1 },
  metaSubRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initialsTxt: { color: '#FFF', fontSize: 15 },
  body: { fontSize: 16, lineHeight: 23, marginTop: 12 },
  mediaBlock: { marginTop: 10, gap: 4, overflow: 'hidden', borderRadius: 8 },
  clusterRow: { flexDirection: 'row', alignSelf: 'stretch' },
  clusterWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  mosaicCover: { width: '100%', height: '100%' },
  singleHeroImg: { borderRadius: 10, alignSelf: 'center' },
  mixedStillImg: { borderRadius: 10, alignSelf: 'center' },
  videoShell: {
    alignSelf: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: '#000',
  },
  videoPlayer: { width: '100%', height: 260 },
  videoDeferred: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  videoPosterOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 2,
    minHeight: 28,
  },
  fbBar: { flexDirection: 'row', alignItems: 'stretch' },
  fbBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  fbBarSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
})
