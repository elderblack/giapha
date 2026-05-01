import FontAwesome from '@expo/vector-icons/FontAwesome'
import { ResizeMode, Video } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { memo, useCallback, useMemo, useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/Themed'
import type { FeedPostState } from '@/lib/feed/feedQueries'
import { getFeedMediaPublicUrl } from '@/lib/feed/feedQueries'
import { formatFeedRelativeVi } from '@/lib/feed/feedDate'
import {
  FEED_REACTION_EMOJI,
  FEED_REACTION_VI,
  type FeedReactionKind,
} from '@/lib/feed/reactionKinds'
import { usePalette } from '@/hooks/usePalette'
import { getSupabase } from '@/lib/supabase'
import { Font } from '@/theme/typography'

export const FeedReelItem = memo(function FeedReelItemInner({
  post,
  height,
  isActive,
  currentUserId,
  onComments,
  onBack,
  onAfterReact,
}: {
  post: FeedPostState
  height: number
  isActive: boolean
  currentUserId: string | undefined
  onComments: () => void
  onBack: () => void
  onAfterReact?: () => void
}) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const sb = getSupabase()
  const profile = post.profiles
  const mineReact = post.reactions.find((r) => r.user_id === currentUserId)
  const [reactBusy, setReactBusy] = useState(false)

  const videoUrl = useMemo(() => {
    const sorted = [...post.media].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const v = sorted.find((m) => m.media_kind === 'video')
    if (!v) return null
    return getFeedMediaPublicUrl(v.storage_path)
  }, [post.media])

  const initials =
    profile?.full_name
      ?.trim()
      ?.split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join('')
      .toUpperCase() ?? '?'

  const toggleReact = useCallback(
    async (kind: FeedReactionKind) => {
      if (!sb || !currentUserId) return
      setReactBusy(true)
      try {
        if (mineReact?.kind === kind) {
          await sb.from('family_feed_post_reactions').delete().eq('post_id', post.id).eq('user_id', currentUserId)
        } else {
          await sb.from('family_feed_post_reactions').upsert({ post_id: post.id, user_id: currentUserId, kind }, {
            onConflict: 'post_id,user_id',
          } as never)
        }
        onAfterReact?.()
      } finally {
        setReactBusy(false)
      }
    },
    [sb, currentUserId, mineReact?.kind, post.id, onAfterReact],
  )

  const reactLabelShort = mineReact ? `${FEED_REACTION_EMOJI[mineReact.kind]} ${FEED_REACTION_VI[mineReact.kind]}` : 'Thích'

  if (!videoUrl) {
    return (
      <View style={[styles.page, { height, backgroundColor: '#000' }]}>
        <Text style={{ color: '#fff', fontFamily: Font.medium }}>Không có video</Text>
      </View>
    )
  }

  return (
    <View style={[styles.page, { height }]}>
      <Video
        source={{ uri: videoUrl }}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isActive}
        isLooping
        isMuted={false}
        useNativeControls={false}
      />

      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={styles.gradTop} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.gradBot} pointerEvents="none" />

      <Pressable style={[styles.backBtn, { top: insets.top + 6 }]} onPress={onBack} hitSlop={12} accessibilityLabel="Đóng">
        <FontAwesome name="chevron-down" size={26} color="#FFF" />
      </Pressable>

      <View style={styles.rightRail}>
        <Pressable
          style={styles.railBtn}
          disabled={reactBusy || !currentUserId}
          onPress={() => void toggleReact(mineReact?.kind ?? 'like')}
          accessibilityLabel="Thích"
        >
          <FontAwesome
            name={mineReact ? 'thumbs-up' : 'thumbs-o-up'}
            size={26}
            color={mineReact ? p.accent : '#FFF'}
          />
          <Text style={styles.railLbl}>{reactLabelShort}</Text>
        </Pressable>
        <Pressable style={styles.railBtn} onPress={onComments} accessibilityLabel="Bình luận">
          <FontAwesome name="comment-o" size={26} color="#FFF" />
          <Text style={styles.railLbl}>{post.comments.length || ''}</Text>
        </Pressable>
      </View>

      <View style={styles.captionBlock}>
        <View style={styles.authorRow}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <LinearGradient colors={[p.accent, '#C026D3']} style={styles.avatar} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.avatarTxt}>{initials}</Text>
            </LinearGradient>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {profile?.full_name?.trim() || 'Thành viên họ'}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatFeedRelativeVi(post.created_at)}
              {post.tree_name ? ` · ${post.tree_name}` : ''}
            </Text>
          </View>
        </View>
        {post.body ? (
          <Text style={styles.body} numberOfLines={4}>
            {post.body}
          </Text>
        ) : null}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  page: { width: '100%', backgroundColor: '#000', position: 'relative' },
  video: { ...StyleSheet.absoluteFillObject },
  gradTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 140 },
  gradBot: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 280 },
  backBtn: {
    position: 'absolute',
    left: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightRail: { position: 'absolute', right: 8, bottom: 120, alignItems: 'center', gap: 22 },
  railBtn: { alignItems: 'center', gap: 4 },
  railLbl: { color: '#FFF', fontSize: 11, fontFamily: Font.semiBold },
  captionBlock: { position: 'absolute', left: 14, right: 72, bottom: 36 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#FFF', fontFamily: Font.bold, fontSize: 14 },
  name: { color: '#FFF', fontFamily: Font.bold, fontSize: 16 },
  meta: { color: 'rgba(255,255,255,0.85)', fontFamily: Font.regular, fontSize: 13, marginTop: 2 },
  body: { color: '#FFF', fontFamily: Font.regular, fontSize: 15, lineHeight: 22 },
})
