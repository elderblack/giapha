import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useHeaderHeight } from '@react-navigation/elements'
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/Themed'
import { FeedPostBodyMobile } from '@/components/feed/FeedPostBodyMobile'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { formatFeedRelativeVi } from '@/lib/feed/feedDate'
import { loadFeedPostById, type FeedCommentRow, type FeedCommentReactionRow, type FeedPostState } from '@/lib/feed/feedQueries'
import { prefetchFeedTreeMedia } from '@/lib/feed/prefetchFeedMedia'
import { FEED_REACTION_EMOJI, reactionEmoji, type FeedReactionKind } from '@/lib/feed/reactionKinds'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { Font } from '@/theme/typography'

type ReplyTarget = { topId: string; label: string } | null

type TopComment = FeedPostState['comments'][number]

function initialsFrom(profileName: string | null | undefined) {
  const n = profileName?.trim()?.split(/\s+/) ?? []
  if (n.length >= 2) return `${n[0]![0] ?? ''}${n[n.length - 1]![0] ?? ''}`.toUpperCase()
  const s = profileName?.trim()?.[0]
  return s ? s.toUpperCase() : '?'
}

const CommentBar = memo(function CommentBarInner({
  name,
  body,
  time,
  isReply,
  mentionLead,
  avatarUrl,
  reactions,
  currentUserId,
  busy,
  onReply,
  onToggleReaction,
  canDelete,
  onRequestDelete,
}: {
  name: string
  body: string
  time: string
  isReply: boolean
  /** Giống web: tên tài khoản được “gắn” trước nội dung phản hồi trong luồng. */
  mentionLead?: string | null
  avatarUrl: string | null | undefined
  reactions: FeedCommentReactionRow[]
  currentUserId: string | undefined
  busy: boolean
  onReply: () => void
  onToggleReaction: () => void
  canDelete: boolean
  onRequestDelete: () => void
}) {
  const p = usePalette()
  const mineRx = reactions.find((r) => r.user_id === currentUserId)
  const cnt = reactions.length
  const rxKinds = [...new Set(reactions.map((r) => r.kind))]
  const chipEmoji = rxKinds.length ? reactionEmoji(rxKinds[0]!) : FEED_REACTION_EMOJI.like

  return (
    <View style={[styles.cRow, isReply ? styles.cRowReply : undefined]}>
      <View style={[styles.cAvatar, isReply ? styles.cAvatarSm : undefined, { borderColor: p.border }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 99 }} />
        ) : (
          <LinearGradient
            colors={[p.accent, '#9333EA']}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 99 }}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={{ fontFamily: Font.bold, fontSize: isReply ? 11 : 12, color: '#FFF' }}>{initialsFrom(name)}</Text>
          </LinearGradient>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={[styles.cBubble, { backgroundColor: p.canvasMuted }]}>
          <Text style={{ fontFamily: Font.semiBold, fontSize: 14, color: p.ink }}>{name}</Text>
          <Text style={{ marginTop: 4, fontFamily: Font.regular, fontSize: 15, color: p.ink, lineHeight: 21 }} selectable>
            {mentionLead?.trim() ? (
              <Text style={{ fontFamily: Font.semiBold, color: p.accent }}>{mentionLead.trim()} </Text>
            ) : null}
            {body}
          </Text>
        </View>
        <View style={styles.cMetaRow}>
          <Text style={{ fontFamily: Font.semiBold, fontSize: 12, color: p.muted }}>{time}</Text>
          <Text style={{ marginHorizontal: 6, fontSize: 12, color: p.muted }}>·</Text>
          <Pressable onPress={onReply} disabled={busy} hitSlop={6}>
            <Text style={{ fontFamily: Font.semiBold, fontSize: 12, color: p.inkMuted }}>Trả lời</Text>
          </Pressable>
          <Text style={{ marginHorizontal: 6, fontSize: 12, color: p.muted }}>·</Text>
          <Pressable onPress={onToggleReaction} disabled={busy} hitSlop={6}>
            <Text
              style={{
                fontFamily: Font.semiBold,
                fontSize: 12,
                color: mineRx ? p.accent : p.inkMuted,
              }}
            >
              Thích
            </Text>
          </Pressable>
          {canDelete ? (
            <>
              <Text style={{ marginHorizontal: 6, fontSize: 12, color: p.muted }}>·</Text>
              <Pressable onPress={onRequestDelete} hitSlop={6}>
                <Text style={{ fontFamily: Font.semiBold, fontSize: 12, color: p.danger }}>Xoá</Text>
              </Pressable>
            </>
          ) : null}
        </View>
        {cnt > 0 ? (
          <Pressable style={styles.rxChip} onPress={onToggleReaction} disabled={busy}>
            <Text style={{ fontSize: 12 }}>{`${chipEmoji} ${cnt}`}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
})

const CommentThreadMobile = memo(function CommentThreadMobileInner({
  top,
  currentUserId,
  busy,
  onReplyInThread,
  onToggleCommentReaction,
  onDeleteComment,
}: {
  top: TopComment
  currentUserId: string | undefined
  busy: boolean
  /** `replyingAs` chỉ có khi nhấn Trả lời từ một phản hồi lồng — vẫn gắn parent_comment_id = top.id như web. */
  onReplyInThread: (threadTop: FeedCommentRow, replyingAs?: FeedCommentRow) => void
  onToggleCommentReaction: (commentId: string, kind: FeedReactionKind) => void
  onDeleteComment: (commentId: string) => void
}) {
  const topMine = Boolean(currentUserId && top.author_id === currentUserId)

  return (
    <View style={styles.thread}>
      <CommentBar
        name={top.profiles?.full_name?.trim() ?? 'Thành viên'}
        body={top.body}
        time={formatFeedRelativeVi(top.created_at)}
        isReply={false}
        avatarUrl={top.profiles?.avatar_url}
        reactions={top.reactions ?? []}
        currentUserId={currentUserId}
        busy={busy}
        onReply={() => onReplyInThread(top)}
        onToggleReaction={() => void onToggleCommentReaction(top.id, 'like')}
        canDelete={topMine}
        onRequestDelete={() =>
          Alert.alert('Xoá bình luận?', undefined, [
            { text: 'Huỷ', style: 'cancel' },
            { text: 'Xoá', style: 'destructive', onPress: () => onDeleteComment(top.id) },
          ])
        }
      />
      {(top.replies ?? []).map((r) => {
        const rm = Boolean(currentUserId && r.author_id === currentUserId)
        return (
          <CommentBar
            key={r.id}
            name={r.profiles?.full_name?.trim() ?? 'Thành viên'}
            body={r.body}
            time={formatFeedRelativeVi(r.created_at)}
            isReply
            mentionLead={top.profiles?.full_name?.trim() ?? null}
            avatarUrl={r.profiles?.avatar_url}
            reactions={r.reactions ?? []}
            currentUserId={currentUserId}
            busy={busy}
            onReply={() => onReplyInThread(top, r)}
            onToggleReaction={() => void onToggleCommentReaction(r.id, 'like')}
            canDelete={rm}
            onRequestDelete={() =>
              Alert.alert('Xoá bình luận?', undefined, [
                { text: 'Huỷ', style: 'cancel' },
                { text: 'Xoá', style: 'destructive', onPress: () => onDeleteComment(r.id) },
              ])
            }
          />
        )
      })}
    </View>
  )
})

export default function FeedPostDetailScreen() {
  const p = usePalette()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const headerH = useHeaderHeight()
  const { width } = useWindowDimensions()
  const { user } = useAuth()
  const sb = getSupabase()
  const raw = useLocalSearchParams<{ postId?: string | string[] }>()
  const postId = typeof raw.postId === 'string' ? raw.postId : Array.isArray(raw.postId) ? raw.postId[0] : undefined

  const [post, setPost] = useState<FeedPostState | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadErr, setReloadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null)

  const inputRef = useRef<TextInput>(null)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const imageMaxW = width - 24

  const scheduleReload = useCallback((fn: () => void, ms = 360) => {
    if (debRef.current != null) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => {
      debRef.current = null
      fn()
    }, ms)
  }, [])

  useEffect(() => () => {
    if (debRef.current != null) clearTimeout(debRef.current)
  }, [])

  const load = useCallback(async () => {
    if (!postId) return
    if (!hasSupabaseCredentials()) {
      setPost(null)
      setReloadErr('Chưa cấu hình Supabase.')
      setLoading(false)
      return
    }
    setReloadErr(null)
    const next = await loadFeedPostById(postId)
    setPost(next)
    setLoading(false)
  }, [postId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  useEffect(() => {
    if (!post) return
    const h = InteractionManager.runAfterInteractions(() => {
      prefetchFeedTreeMedia([post])
    })
    return () => h.cancel()
  }, [post])

  useEffect(() => {
    if (!sb || !post?.id || !hasSupabaseCredentials()) return
    const slug = `post-detail-live-${post.id}`
    const ch = sb.channel(slug)
    const bump = () => scheduleReload(() => void load())

    void ch
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_feed_comments', filter: `post_id=eq.${post.id}` },
        bump,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_feed_post_reactions', filter: `post_id=eq.${post.id}` },
        bump,
      )
      .subscribe()

    const ch2 = sb.channel(`${slug}-cr`)
    void ch2
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_feed_comment_reactions' }, bump)
      .subscribe()

    return () => {
      void sb.removeChannel(ch)
      void sb.removeChannel(ch2)
    }
  }, [sb, post?.id, load, scheduleReload])

  const mine = Boolean(user?.id && post?.author_id === user.id)

  async function reloadAfterWrite() {
    await load()
  }

  async function togglePostReact(kind: FeedReactionKind) {
    if (!sb || !user?.id || !post?.id) return
    const mineRx = post.reactions.find((r) => r.user_id === user.id)
    setBusy(true)
    try {
      if (mineRx?.kind === kind) {
        await sb.from('family_feed_post_reactions').delete().eq('post_id', post.id).eq('user_id', user.id)
      } else {
        await sb.from('family_feed_post_reactions').upsert({ post_id: post.id, user_id: user.id, kind }, {
          onConflict: 'post_id,user_id',
        } as never)
      }
      await reloadAfterWrite()
    } finally {
      setBusy(false)
    }
  }

  const confirmDeletePost = useCallback(() => {
    if (!sb || !mine || !post?.id) return
    Alert.alert('Xoá bài?', 'Bài sẽ không còn trong bảng tin dòng họ cho mọi người được xem.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          await sb.from('family_feed_posts').delete().eq('id', post.id)
          router.back()
        },
      },
    ])
  }, [mine, sb, post?.id, router])

  async function toggleCommentReaction(commentId: string, kind: FeedReactionKind) {
    if (!sb || !user?.id || !post) return
    let mineKind: FeedReactionKind | undefined
    outer: for (const c of post.comments) {
      if (c.id === commentId) {
        mineKind = c.reactions.find((r) => r.user_id === user.id)?.kind
        break outer
      }
      const hit = c.replies.find((r) => r.id === commentId)
      if (hit) {
        mineKind = hit.reactions.find((r) => r.user_id === user.id)?.kind
        break outer
      }
    }
    setBusy(true)
    try {
      if (mineKind === kind) {
        await sb.from('family_feed_comment_reactions').delete().eq('comment_id', commentId).eq('user_id', user.id)
      } else {
        await sb.from('family_feed_comment_reactions').upsert({ comment_id: commentId, user_id: user.id, kind }, {
          onConflict: 'comment_id,user_id',
        } as never)
      }
      await reloadAfterWrite()
    } finally {
      setBusy(false)
    }
  }

  async function deleteComment(commentId: string) {
    if (!sb) return
    setBusy(true)
    try {
      await sb.from('family_feed_comments').delete().eq('id', commentId)
      await reloadAfterWrite()
    } finally {
      setBusy(false)
    }
  }

  async function sendComment() {
    const body = draft.trim()
    if (!body || !sb || !user?.id || !post?.id) return
    const parent_comment_id = replyTo?.topId ?? null
    setBusy(true)
    try {
      await sb.from('family_feed_comments').insert({
        post_id: post.id,
        author_id: user.id,
        parent_comment_id,
        body,
      })
      setDraft('')
      setReplyTo(null)
      await reloadAfterWrite()
    } finally {
      setBusy(false)
    }
  }

  function focusComposer() {
    inputRef.current?.focus()
  }

  if (!postId) {
    return (
      <View style={[styles.center, { paddingTop: 24 }]}>
        <Text style={{ color: p.danger }}>Thiếu mã bài viết.</Text>
      </View>
    )
  }

  if (loading || (!post && !reloadErr && hasSupabaseCredentials())) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: p.canvas }]}>
        <ActivityIndicator color={p.accent} />
        <Text style={{ marginTop: 12, color: p.muted, fontFamily: Font.medium }}>Đang tải…</Text>
      </View>
    )
  }

  if (!hasSupabaseCredentials() || reloadErr) {
    return (
      <View style={[styles.center, { flex: 1, paddingHorizontal: 24 }]}>
        <FontAwesome name="plug" size={40} color={p.muted} />
        <Text style={{ marginTop: 14, fontFamily: Font.bold, fontSize: 18, color: p.ink, textAlign: 'center' }}>
          {reloadErr ?? 'Chưa cấu hình Supabase'}
        </Text>
      </View>
    )
  }

  if (!post) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <Text style={{ color: p.muted, fontFamily: Font.medium }}>Không tìm thấy bài viết.</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: p.canvas }]} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerH + insets.top}
      >
        <FlatList
          style={styles.flex}
          data={post.comments}
          keyExtractor={(item) => item.id}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <Text style={[styles.ph, { marginTop: 8, marginBottom: 12, fontFamily: Font.medium, fontSize: 14, color: p.muted }]}>
              Chưa có bình luận. Hãy là người đầu tiên.
            </Text>
          }
          ListHeaderComponent={
            <View>
              <View style={[styles.ph, styles.headPadTop]}>
                <FeedPostBodyMobile
                  post={post}
                  currentUserId={user?.id}
                  busy={busy}
                  toggleReact={(k) => void togglePostReact(k)}
                  confirmDeletePost={confirmDeletePost}
                  videoMode="inline"
                  imageMaxWOverride={imageMaxW}
                  onCommentPress={() => focusComposer()}
                  onCommentCountPress={() => focusComposer()}
                  onAuthorPress={() => router.push(`/profile/${post.author_id}`)}
                />
              </View>
              <Text style={[styles.ph, styles.commentSectionTitle, { color: p.inkMuted, fontFamily: Font.semiBold }]}>
                Bình luận · {post.comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0)}
              </Text>
            </View>
          }
          renderItem={({ item: top }) => (
            <View style={[styles.ph, styles.threadSep, { borderBottomColor: p.border }]}>
              <CommentThreadMobile
                top={top}
                currentUserId={user?.id}
                busy={busy}
                onReplyInThread={(threadTop, nested) => {
                  setReplyTo({
                    topId: threadTop.id,
                    label: nested?.profiles?.full_name?.trim() ?? threadTop.profiles?.full_name?.trim() ?? 'Ai đó',
                  })
                  focusComposer()
                }}
                onToggleCommentReaction={(id, kind) => void toggleCommentReaction(id, kind)}
                onDeleteComment={(cid) => void deleteComment(cid)}
              />
            </View>
          )}
          ItemSeparatorComponent={() => null}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
        <View style={[styles.composeWrap, { backgroundColor: p.surfaceElevated, borderTopColor: p.border, paddingBottom: insets.bottom + 6 }]}>
          {replyTo ? (
            <View style={[styles.replyBanner, { backgroundColor: p.canvasMuted }]}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: Font.medium, fontSize: 12, color: p.muted }}>
                Trả lời · {replyTo.label}
              </Text>
              <Pressable hitSlop={8} onPress={() => setReplyTo(null)}>
                <FontAwesome name="times-circle" size={22} color={p.muted} />
              </Pressable>
            </View>
          ) : null}
          <View style={[styles.composeRow, { borderColor: p.border, backgroundColor: p.canvasMuted }]}>
            <TextInput
              ref={inputRef}
              placeholder={replyTo ? `Viết cho ${replyTo.label}…` : 'Viết bình luận…'}
              placeholderTextColor={p.muted}
              style={[styles.input, { color: p.ink, fontFamily: Font.regular }]}
              multiline={false}
              value={draft}
              onChangeText={setDraft}
              editable={Boolean(user?.id) && !busy}
              returnKeyType="send"
              onSubmitEditing={() => void sendComment()}
              blurOnSubmit={false}
            />
            <Pressable
              onPress={() => void sendComment()}
              disabled={!draft.trim() || busy}
              accessibilityLabel="Gửi"
              style={{ opacity: draft.trim() && !busy ? 1 : 0.35 }}
            >
              <FontAwesome name="send" size={20} color={p.accent} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  headPadTop: { paddingTop: 6 },
  ph: { paddingHorizontal: 12 },
  commentSectionTitle: { fontSize: 13, letterSpacing: 0.15, paddingTop: 6, paddingBottom: 12 },
  threadSep: { paddingBottom: 16, marginBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  thread: { gap: 0 },
  cRow: { flexDirection: 'row', gap: 8, flex: 1 },
  cRowReply: { marginLeft: 18, marginTop: 4 },
  cAvatar: { width: 36, height: 36, borderRadius: 999, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  cAvatarSm: { width: 30, height: 30 },
  cBubble: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, maxWidth: '100%', alignSelf: 'flex-start' },
  cMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingLeft: 2,
    marginTop: 4,
  },
  rxChip: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  composeWrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginBottom: 6 },
  composeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10 },
  input: { flex: 1, fontSize: 15, paddingVertical: 11, paddingHorizontal: 6, maxHeight: 80 },
})
