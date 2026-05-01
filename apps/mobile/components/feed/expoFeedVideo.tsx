import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

/** Thumbnail trong compose — tĩnh, tắt tiếng, không controls. */
export function ComposeVideoThumbnail({ uri, style }: { uri: string; style: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true
    p.pause()
  })
  return <VideoView player={player} style={style} contentFit="cover" nativeControls={false} />
}

/** Bảng tin: cover, mute, chỉ autoplay khi `playing`; loop khi đang autoplay (giống isLooping gắn với viewport). */
export function FeedMutedCoverLoopVideo({
  uri,
  playing,
  style,
}: {
  uri: string
  playing: boolean
  style?: StyleProp<ViewStyle>
}) {
  const player = useVideoPlayer(uri)
  useEffect(() => {
    player.muted = true
    player.loop = playing
    if (playing) player.play()
    else player.pause()
  }, [player, playing, uri])
  return <VideoView player={player} style={style} contentFit="cover" nativeControls={false} />
}

/** Chi tiết bài: chứa trong khung cố định, có native controls, mặc định dừng cho đến khi người dùng Play. */
export function FeedInlineDetailVideo({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = false
    p.pause()
  })
  return <VideoView player={player} style={style} contentFit="contain" nativeControls />
}

/** Full-bleed reel: unmuted loop, chỉ play khi `isActive`. */
export function FeedReelPlayer({
  uri,
  isActive,
  style,
}: {
  uri: string
  isActive: boolean
  style?: StyleProp<ViewStyle>
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = false
    p.loop = true
  })
  useEffect(() => {
    if (isActive) player.play()
    else player.pause()
  }, [player, isActive, uri])
  return <VideoView player={player} style={style ?? StyleSheet.absoluteFillObject} contentFit="cover" nativeControls={false} />
}

/** Lightbox: contain, có/không native controls theo chrome; chỉ page hiện tại được play. */
export function LightboxVideoSlide({
  uri,
  play,
  showChrome,
  style,
}: {
  uri: string
  play: boolean
  showChrome: boolean
  style?: StyleProp<ViewStyle>
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = false
    p.loop = true
  })
  useEffect(() => {
    if (play) player.play()
    else player.pause()
  }, [player, play, uri])
  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls={showChrome}
    />
  )
}
