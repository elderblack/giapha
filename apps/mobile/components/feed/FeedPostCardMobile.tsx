import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { FeedPostBodyMobile } from '@/components/feed/FeedPostBodyMobile'
import { usePalette } from '@/hooks/usePalette'
import type { FeedPostState } from '@/lib/feed/feedQueries'
import type { FeedReactionKind } from '@/lib/feed/reactionKinds'
import { getSupabase } from '@/lib/supabase'

export type FeedCardViewportPayload = {
  postId: string
  contentTop: number
  contentBottom: number
  hasEmbedVideo: boolean
}

export const FeedPostCardMobile = memo(function FeedPostCardMobileInner({
  post,
  currentUserId,
  onReload,
  winnerPostId = null,
  onReportViewport,
  onViewportUnmount,
}: {
  post: FeedPostState
  currentUserId: string | undefined
  onReload: () => void
  winnerPostId?: string | null
  onReportViewport?: (p: FeedCardViewportPayload) => void
  onViewportUnmount?: (postId: string) => void
}) {
  const p = usePalette()
  const sb = getSupabase()
  const router = useRouter()
  const mine = Boolean(currentUserId && post.author_id === currentUserId)
  const mineReact = post.reactions.find((r) => r.user_id === currentUserId)

  const [busy, setBusy] = useState(false)

  const hasEmbedVideo = useMemo(() => post.media.some((m) => m.media_kind === 'video'), [post.media])

  useEffect(() => () => onViewportUnmount?.(post.id), [post.id, onViewportUnmount])

  const openDetail = useCallback(() => {
    router.push(`/feed/${post.id}`)
  }, [router, post.id])

  async function toggleReact(kind: FeedReactionKind) {
    if (!sb || !currentUserId) return
    setBusy(true)
    try {
      if (mineReact?.kind === kind) {
        await sb.from('family_feed_post_reactions').delete().eq('post_id', post.id).eq('user_id', currentUserId)
      } else {
        await sb.from('family_feed_post_reactions').upsert({ post_id: post.id, user_id: currentUserId, kind }, {
          onConflict: 'post_id,user_id',
        } as never)
      }
      await onReload()
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = useCallback(() => {
    if (!sb || !mine) return
    Alert.alert('Xoá bài?', 'Bài sẽ không còn trong bảng tin dòng họ cho mọi người được xem.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          await sb.from('family_feed_posts').delete().eq('id', post.id)
          await onReload()
        },
      },
    ])
  }, [mine, sb, post.id, onReload])

  const openAuthorProfile = useCallback(() => {
    router.push(`/profile/${post.author_id}`)
  }, [router, post.author_id])

  return (
    <View
      style={[styles.card, { backgroundColor: p.surfaceElevated, borderColor: p.border }]}
      collapsable={false}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout
        onReportViewport?.({
          postId: post.id,
          contentTop: y,
          contentBottom: y + height,
          hasEmbedVideo,
        })
      }}
    >
      <FeedPostBodyMobile
        post={post}
        currentUserId={currentUserId}
        busy={busy}
        toggleReact={(k) => void toggleReact(k)}
        confirmDeletePost={confirmDelete}
        videoMode="feedPoster"
        embedAutoplayActive={winnerPostId === post.id && hasEmbedVideo}
        onCommentPress={openDetail}
        onCommentCountPress={openDetail}
        onAuthorPress={openAuthorProfile}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 14,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
})
