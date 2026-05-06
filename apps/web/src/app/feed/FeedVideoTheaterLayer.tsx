import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from '../../lib/supabase'
import { MessageCircle, MoreHorizontal, Share2, ThumbsUp } from 'lucide-react'
import { buildFeedAttachmentItems } from './FeedAttachmentGrid'
import { FeedPostPhotoViewer } from './FeedPostPhotoViewer'
import { FeedPostPhotoViewerSidebar } from './FeedPostPhotoViewerSidebar'
import { FeedReactionBar } from './FeedReactionBar'
import {
  loadFeedPostComments,
  type FeedCommentRow,
  type FeedPostState,
} from './feedQueries'
import type { FeedReactionKind } from './reactionKinds'

export type FeedVideoTheaterSlide = { postId: string; attachmentIndex: number }

export function buildFeedVideoSlides(
  posts: FeedPostState[],
  urlByPath: Record<string, string>,
): FeedVideoTheaterSlide[] {
  const slides: FeedVideoTheaterSlide[] = []
  for (const p of posts) {
    const items = buildFeedAttachmentItems(p.media, urlByPath)
    items.forEach((it, idx) => {
      if (it.kind === 'video') slides.push({ postId: p.id, attachmentIndex: idx })
    })
  }
  return slides
}

function countTreeComments(p: FeedPostState): number {
  let n = p.comments.length
  for (const c of p.comments) n += c.replies.length
  return n
}

function compactCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`.replace('.0', '')
  if (n >= 10_000) return `${Math.round(n / 1000)}K`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}K`.replace('.0', '')
  return String(n)
}

type Props = {
  open: boolean
  slideIndex: number
  videoSlides: FeedVideoTheaterSlide[]
  posts: FeedPostState[]
  urlByPath: Record<string, string>
  currentUserId: string | undefined
  showTreeLink?: boolean
  onClose: () => void
  onSlideIndexChange: (i: number) => void
  onInvalidateFeed: (postId: string) => void | Promise<void>
}

export function FeedVideoTheaterLayer({
  open,
  slideIndex,
  videoSlides,
  posts,
  urlByPath,
  currentUserId,
  showTreeLink = false,
  onClose,
  onSlideIndexChange,
  onInvalidateFeed,
}: Props) {
  const sb = getSupabase()
  const slide = videoSlides[slideIndex]
  const livePost = slide ? posts.find((p) => p.id === slide.postId) : undefined

  const [theaterMobileCommentsOpen, setTheaterMobileCommentsOpen] = useState(false)
  const [draftTop, setDraftTop] = useState('')
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [draftReply, setDraftReply] = useState('')
  const [localBusy, setLocalBusy] = useState(false)
  const [commentPhase, setCommentPhase] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [commentOverride, setCommentOverride] = useState<FeedPostState['comments'] | null>(null)

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => setTheaterMobileCommentsOpen(false))
    }
  }, [open])

  useEffect(() => {
    setCommentPhase('idle')
    setCommentOverride(null)
  }, [livePost?.id])

  const attachmentItems = useMemo(
    () => (livePost ? buildFeedAttachmentItems(livePost.media, urlByPath) : []),
    [livePost, urlByPath],
  )

  const startIndex = slide && attachmentItems.length ? clampIndex(slide.attachmentIndex, attachmentItems.length) : 0

  const mineReact = livePost?.reactions.find((r) => r.user_id === currentUserId)
  const likeCount = livePost?.reactions.length ?? 0
  const commentCountHint = livePost ? countTreeComments(livePost) : 0

  const revealComments = useCallback(async () => {
    if (!livePost || commentPhase !== 'idle') return
    setCommentPhase('loading')
    try {
      const rows = await loadFeedPostComments(livePost.id)
      setCommentOverride(rows)
      setCommentPhase('ready')
    } catch {
      setCommentPhase('idle')
    }
  }, [livePost, commentPhase])

  const postForSidebar: FeedPostState | undefined = useMemo(() => {
    if (!livePost) return undefined
    const comments =
      commentPhase === 'ready' ? (commentOverride ?? livePost.comments) : ([] as FeedPostState['comments'])
    return { ...livePost, comments }
  }, [livePost, commentPhase, commentOverride])

  async function react(kind: FeedReactionKind) {
    if (!sb || !currentUserId || !livePost) return
    setLocalBusy(true)
    try {
      const mr = livePost.reactions.find((r) => r.user_id === currentUserId)
      if (mr?.kind === kind) {
        await sb.from('family_feed_post_reactions').delete().eq('post_id', livePost.id).eq('user_id', currentUserId)
      } else {
        await sb.from('family_feed_post_reactions').upsert(
          { post_id: livePost.id, user_id: currentUserId, kind },
          { onConflict: 'post_id,user_id' },
        )
      }
      await onInvalidateFeed(livePost.id)
    } finally {
      setLocalBusy(false)
    }
  }

  async function submitTopComment(bodyRaw: string) {
    const body = bodyRaw.trim()
    if (!body || !sb || !currentUserId || !livePost) return
    setLocalBusy(true)
    try {
      await sb.from('family_feed_comments').insert({
        post_id: livePost.id,
        author_id: currentUserId,
        parent_comment_id: null,
        body,
      })
      setDraftTop('')
      setDraftReply('')
      setReplyToId(null)
      await onInvalidateFeed(livePost.id)
      const rows = await loadFeedPostComments(livePost.id)
      setCommentOverride(rows)
      setCommentPhase('ready')
    } finally {
      setLocalBusy(false)
    }
  }

  async function submitReplyNested(top: FeedCommentRow, bodyRaw: string) {
    const body = bodyRaw.trim()
    if (!body || !sb || !currentUserId || !livePost) return
    if (top.parent_comment_id != null) return
    setLocalBusy(true)
    try {
      await sb.from('family_feed_comments').insert({
        post_id: livePost.id,
        author_id: currentUserId,
        parent_comment_id: top.id,
        body,
      })
      setDraftReply('')
      setReplyToId(null)
      await onInvalidateFeed(livePost.id)
      const rows = await loadFeedPostComments(livePost.id)
      setCommentOverride(rows)
      setCommentPhase('ready')
    } finally {
      setLocalBusy(false)
    }
  }

  async function deleteComment(id: string) {
    if (!sb || !confirm('Xoá bình luận?')) return
    await sb.from('family_feed_comments').delete().eq('id', id)
    if (livePost) await onInvalidateFeed(livePost.id)
    if (livePost) {
      const rows = await loadFeedPostComments(livePost.id)
      setCommentOverride(rows)
      setCommentPhase('ready')
    }
  }

  const reactOnComment = useCallback(
    async (commentId: string, kind: FeedReactionKind) => {
      if (!sb || !currentUserId || !livePost) return
      const src = commentOverride ?? livePost.comments
      let mineKind: FeedReactionKind | undefined
      for (const c of src) {
        if (c.id === commentId) {
          mineKind = c.reactions.find((r) => r.user_id === currentUserId)?.kind
          break
        }
        const hit = c.replies.find((r) => r.id === commentId)
        if (hit) {
          mineKind = hit.reactions.find((r) => r.user_id === currentUserId)?.kind
          break
        }
      }
      setLocalBusy(true)
      try {
        if (mineKind === kind) {
          await sb.from('family_feed_comment_reactions').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
        } else {
          await sb.from('family_feed_comment_reactions').upsert(
            { comment_id: commentId, user_id: currentUserId, kind },
            { onConflict: 'comment_id,user_id' },
          )
        }
        await onInvalidateFeed(livePost.id)
        const rows = await loadFeedPostComments(livePost.id)
        setCommentOverride(rows)
        setCommentPhase('ready')
      } finally {
        setLocalBusy(false)
      }
    },
    [sb, currentUserId, livePost, commentOverride, onInvalidateFeed],
  )

  const canReelPrev = slideIndex > 0
  const canReelNext = slideIndex >= 0 && slideIndex < videoSlides.length - 1

  if (!open || !slide || !livePost || !postForSidebar || attachmentItems.length === 0) return null

  return (
    <FeedPostPhotoViewer
      open
      onClose={onClose}
      startIndex={startIndex}
      items={attachmentItems}
      verticalReel={
        videoSlides.length > 1
          ? {
              canPrev: canReelPrev,
              canNext: canReelNext,
              onPrev: () => canReelPrev && onSlideIndexChange(slideIndex - 1),
              onNext: () => canReelNext && onSlideIndexChange(slideIndex + 1),
            }
          : undefined
      }
      mobileCommentsOpen={theaterMobileCommentsOpen}
      onMobileCommentsOpenChange={setTheaterMobileCommentsOpen}
      showVerticalReelButtons
      rightRail={
        <div className="flex flex-col items-center gap-4 pb-1 text-white">
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[12px] font-semibold text-white/95"
            onClick={() => void react(mineReact?.kind ?? 'like')}
            aria-label={`Thích, ${likeCount}`}
            title="Thích"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/50">
              <ThumbsUp className="h-5 w-5" aria-hidden />
            </span>
            <span className="tabular-nums text-white/90">{compactCount(likeCount)}</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[12px] font-semibold text-white/95"
            onClick={() => {
              if (theaterMobileCommentsOpen) {
                setTheaterMobileCommentsOpen(false)
                return
              }
              void revealComments()
              setTheaterMobileCommentsOpen(true)
            }}
            aria-label={`Bình luận, ${commentCountHint}`}
            title="Bình luận"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/50">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </span>
            <span className="tabular-nums text-white/90">{compactCount(commentCountHint)}</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[12px] font-semibold text-white/95"
            onClick={() => void sharePost(livePost.id)}
            aria-label="Chia sẻ"
            title="Chia sẻ"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/50">
              <Share2 className="h-5 w-5" aria-hidden />
            </span>
            <span className="tabular-nums text-white/90" aria-hidden />
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[12px] font-semibold text-white/95"
            onClick={() => window.alert('Sắp có thêm tuỳ chọn.')}
            aria-label="Tuỳ chọn"
            title="Tuỳ chọn"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/50">
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </span>
            <span className="tabular-nums text-white/70" aria-hidden />
          </button>
        </div>
      }
      sidebar={
        <FeedPostPhotoViewerSidebar
          post={postForSidebar}
          currentUserId={currentUserId}
          showTreeLink={showTreeLink}
          localBusy={localBusy}
          mineReact={mineReact}
          onReact={(k) => void react(k)}
          draftTop={draftTop}
          setDraftTop={setDraftTop}
          draftReply={draftReply}
          setDraftReply={setDraftReply}
          replyToId={replyToId}
          setReplyToId={setReplyToId}
          onSubmitTop={() => void submitTopComment(draftTop)}
          onSubmitReply={(top) => void submitReplyNested(top, draftReply)}
          onDeleteComment={(id) => void deleteComment(id)}
          onReactComment={(cid, k) => void reactOnComment(cid, k)}
          theaterLazyComments={{
            phase: commentPhase,
            hintCount: countTreeComments(livePost),
            onReveal: () => void revealComments(),
          }}
        />
      }
    />
  )
}

function clampIndex(i: number, len: number) {
  if (len <= 0) return 0
  if (Number.isNaN(i) || !Number.isFinite(i)) return 0
  return Math.max(0, Math.min(i, len - 1))
}

async function sharePost(postId: string) {
  const url = `${window.location.origin}/app/home?post=${encodeURIComponent(postId)}`
  try {
    if (navigator.share) {
      await navigator.share({ url })
      return
    }
  } catch {
    // ignore -> fallback copy
  }
  try {
    await navigator.clipboard.writeText(url)
    window.alert('Đã copy liên kết.')
  } catch {
    window.prompt('Copy liên kết:', url)
  }
}
