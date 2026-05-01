import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { getSupabase } from '../../lib/supabase'
import { role } from '../../design/roles'
import { type FeedReactionKind } from './reactionKinds'
import { FeedReactionBar } from './FeedReactionBar'
import { getFeedMediaPublicUrl, type FeedCommentRow, type FeedPostState } from './feedQueries'
import { useFeedMediaDisplayUrls } from './useFeedMediaDisplayUrls'
import { FeedAttachmentGrid, type FeedAttachmentItem } from './FeedAttachmentGrid'
import { FeedPostPhotoViewer } from './FeedPostPhotoViewer'
import { FeedPostPhotoViewerSidebar } from './FeedPostPhotoViewerSidebar'
import { formatFeedDt } from './feedDate'
import { FeedCommentBlock } from './FeedCommentBlock'
import { feedUserProfilePath } from './feedProfileHref'
import { useMinLg } from '../../hooks/useMinLg'

const FEED_DESKTOP_COMMENT_PREVIEW = 2
const FEED_DESKTOP_REPLY_PREVIEW = 1

export const FeedPostCard = memo(function FeedPostCardInner({
  post,
  currentUserId,
  onReload,
  showTreeLink = false,
  onDeleted,
}: {
  post: FeedPostState
  currentUserId: string | undefined
  onReload: () => void
  showTreeLink?: boolean
  onDeleted?: () => void
}) {
  const sb = getSupabase()
  const profile = post.profiles
  const feedMediaUrls = useFeedMediaDisplayUrls(post.media)
  const initials = profile?.full_name?.trim()?.[0]?.toUpperCase() ?? '?'
  const [commentOpen, setCommentOpen] = useState(false)
  const [draftTop, setDraftTop] = useState('')
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [draftReply, setDraftReply] = useState('')
  const [localBusy, setLocalBusy] = useState(false)
  const [photoViewerIdx, setPhotoViewerIdx] = useState<number | null>(null)
  const [bodyExpanded, setBodyExpanded] = useState(false)
  const [theaterMobileCommentsOpen, setTheaterMobileCommentsOpen] = useState(false)
  const [previewRepliesExpanded, setPreviewRepliesExpanded] = useState<Record<string, boolean>>({})

  const isLg = useMinLg()
  const bodyLong =
    Boolean(post.body) &&
    ((post.body?.length ?? 0) > 220 || (post.body?.split('\n').length ?? 0) > 4)
  const mine = Boolean(currentUserId && post.author_id === currentUserId)
  const mineReact = post.reactions.find((r) => r.user_id === currentUserId)

  const toggleCommentsOpen = useCallback(() => setCommentOpen((v) => !v), [])
  const openPhotoAtIndex = useCallback((idx: number) => setPhotoViewerIdx(idx), [])

  const attachmentItems = useMemo(() => {
    const items: FeedAttachmentItem[] = []
    for (const m of post.media) {
      const sp = m.storage_path.trim()
      const url = feedMediaUrls[sp] ?? getFeedMediaPublicUrl(sp)
      if (!url) continue
      items.push({ key: m.id, url, kind: m.media_kind })
    }
    return items
  }, [post.media, feedMediaUrls])

  async function react(kind: FeedReactionKind) {
    if (!sb || !currentUserId) return
    setLocalBusy(true)
    try {
      if (mineReact?.kind === kind) {
        await sb.from('family_feed_post_reactions').delete().eq('post_id', post.id).eq('user_id', currentUserId)
      } else {
        await sb.from('family_feed_post_reactions').upsert(
          { post_id: post.id, user_id: currentUserId, kind },
          { onConflict: 'post_id,user_id' },
        )
      }
      await onReload()
    } finally {
      setLocalBusy(false)
    }
  }

  async function removePost() {
    if (!sb || !mine || !confirm('Xoá bài viết này khỏi bảng tin?')) return
    await sb.from('family_feed_posts').delete().eq('id', post.id)
    if (onDeleted) {
      onDeleted()
      return
    }
    await onReload()
  }

  async function submitTopComment(bodyRaw: string) {
    const body = bodyRaw.trim()
    if (!body || !sb || !currentUserId) return
    setLocalBusy(true)
    try {
      await sb.from('family_feed_comments').insert({
        post_id: post.id,
        author_id: currentUserId,
        parent_comment_id: null,
        body,
      })
      setDraftTop('')
      setDraftReply('')
      setReplyToId(null)
      await onReload()
    } finally {
      setLocalBusy(false)
    }
  }

  async function submitReplyNested(top: FeedCommentRow, bodyRaw: string) {
    const body = bodyRaw.trim()
    if (!body || !sb || !currentUserId) return
    if (top.parent_comment_id != null) return
    setLocalBusy(true)
    try {
      await sb.from('family_feed_comments').insert({
        post_id: post.id,
        author_id: currentUserId,
        parent_comment_id: top.id,
        body,
      })
      setDraftReply('')
      setReplyToId(null)
      await onReload()
    } finally {
      setLocalBusy(false)
    }
  }

  async function deleteComment(id: string) {
    if (!sb || !confirm('Xoá bình luận?')) return
    await sb.from('family_feed_comments').delete().eq('id', id)
    await onReload()
  }

  const reactOnComment = useCallback(
    async (commentId: string, kind: FeedReactionKind) => {
      if (!sb || !currentUserId) return
      let mineKind: FeedReactionKind | undefined
      for (const c of post.comments) {
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
        await onReload()
      } finally {
        setLocalBusy(false)
      }
    },
    [sb, currentUserId, post.comments, onReload],
  )

  useEffect(() => {
    setPreviewRepliesExpanded({})
  }, [post.id])

  return (
    <>
    <article className={`${role.cardElevated} !rounded-abnb-xl overflow-hidden px-5 py-5 transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-abnb-lg`}>
      <header className="flex items-start gap-3">
        <Link
          to={feedUserProfilePath(post.author_id)}
          className="shrink-0 rounded-full outline-none ring-offset-2 ring-offset-abnb-surfaceCard transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-abnb-primary/35"
          aria-label={`Hồ sơ ${profile?.full_name?.trim() || 'thành viên'}`}
        >
          <Avatar url={profile?.avatar_url ?? null} label={initials} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold leading-tight text-abnb-ink">
                <Link
                  to={feedUserProfilePath(post.author_id)}
                  className="text-abnb-ink underline-offset-2 hover:text-abnb-primary hover:underline"
                >
                  {profile?.full_name ?? 'Thành viên'}
                </Link>
              </p>
              <p className="text-[11px] font-medium text-abnb-muted">{formatFeedDt(post.created_at)}</p>
              {showTreeLink && post.tree_name ? (
                <p className="mt-1.5">
                  <Link
                    to={`/app/trees/${post.family_tree_id}/overview`}
                    className={`${role.linkMuted} text-[12px] font-semibold`}
                  >
                    · {post.tree_name}
                  </Link>
                </p>
              ) : null}
            </div>
            {mine ? (
              <button
                type="button"
                onClick={() => void removePost()}
                className="rounded-full border border-transparent p-2 text-abnb-muted transition-colors hover:border-abnb-hairlineSoft hover:bg-abnb-surfaceSoft hover:text-abnb-error"
                title="Xoá bài"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {post.body ? (
            <div className="mt-2">
              <p
                className={`${role.bodySm} whitespace-pre-wrap text-abnb-body ${
                  !bodyExpanded && bodyLong ? 'line-clamp-4' : ''
                }`}
              >
                {post.body}
              </p>
              {bodyLong ? (
                <button
                  type="button"
                  className="mt-1.5 text-left text-[13px] font-semibold text-abnb-primary hover:underline"
                  onClick={() => setBodyExpanded((v) => !v)}
                >
                  {bodyExpanded ? 'Thu gọn' : 'Xem thêm'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {attachmentItems.length > 0 ? (
        <div className="mt-4">
          <FeedAttachmentGrid items={attachmentItems} onMediaOpen={openPhotoAtIndex} />
        </div>
      ) : null}

      <FeedReactionBar
        reactions={post.reactions}
        mineReact={mineReact}
        currentUserId={currentUserId}
        disabled={localBusy}
        onReact={(k) => void react(k)}
        variant="feed"
        commentCount={commentCount(post)}
        commentsActive={commentOpen}
        onToggleComments={toggleCommentsOpen}
      />

      {isLg && !commentOpen && post.comments.length > 0 ? (
        <section className="mt-5 space-y-4 border-t border-abnb-hairlineSoft/60 pt-4">
          {post.comments.length > FEED_DESKTOP_COMMENT_PREVIEW ? (
            <button
              type="button"
              className="w-full rounded-abnb-lg py-1.5 text-left text-[13px] font-semibold text-abnb-muted hover:bg-abnb-surfaceSoft/80 hover:text-abnb-primary"
              onClick={() => setCommentOpen(true)}
            >
              Xem thêm bình luận
            </button>
          ) : null}
          {post.comments.slice(0, FEED_DESKTOP_COMMENT_PREVIEW).map((c) => {
            const repliesAllOut = previewRepliesExpanded[c.id]
            const visReplies = repliesAllOut ? c.replies : c.replies.slice(0, FEED_DESKTOP_REPLY_PREVIEW)
            const hasMoreReplies = !repliesAllOut && c.replies.length > FEED_DESKTOP_REPLY_PREVIEW
            return (
              <div key={`preview-${c.id}`} className="rounded-abnb-lg px-0 py-1">
                <FeedCommentBlock
                  comment={c}
                  currentUserId={currentUserId}
                  onDelete={(id) => void deleteComment(id)}
                  onReply={() => {
                    setCommentOpen(true)
                    setReplyToId(c.id)
                    setDraftReply('')
                  }}
                  onReact={(k) => void reactOnComment(c.id, k)}
                  disabled={localBusy}
                  variant="feed"
                />
                <div className="ml-10 border-l border-abnb-hairlineSoft/90 pl-3">
                  {visReplies.map((r) => (
                    <FeedCommentBlock
                      key={r.id}
                      comment={r}
                      currentUserId={currentUserId}
                      onDelete={(id) => void deleteComment(id)}
                      onReply={() => {
                        setCommentOpen(true)
                        setReplyToId(c.id)
                        setDraftReply('')
                      }}
                      onReact={(k) => void reactOnComment(r.id, k)}
                      disabled={localBusy}
                      variant="feed"
                      isReply
                      mentionName={c.profiles?.full_name ?? null}
                      mentionAuthorId={c.author_id}
                    />
                  ))}
                  {hasMoreReplies ? (
                    <button
                      type="button"
                      className="mt-1 py-1 text-left text-[13px] font-semibold text-abnb-muted hover:text-abnb-primary"
                      onClick={() =>
                        setPreviewRepliesExpanded((prev) => ({
                          ...prev,
                          [c.id]: true,
                        }))
                      }
                    >
                      Xem phản hồi khác
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </section>
      ) : null}

      {commentOpen ? (
        <section className="mt-5 space-y-5 border-t border-abnb-hairlineSoft/60 pt-4">
          {post.comments.map((c) => (
            <div key={c.id} className="rounded-abnb-lg px-0 py-1">
              <FeedCommentBlock
                comment={c}
                currentUserId={currentUserId}
                onDelete={(id) => void deleteComment(id)}
                onReply={() => {
                  setReplyToId(c.id)
                  setDraftReply('')
                }}
                onReact={(k) => void reactOnComment(c.id, k)}
                disabled={localBusy}
                variant="feed"
              />

              <div className="ml-10 space-y-0 border-l border-abnb-hairlineSoft/90 pl-3">
                {c.replies.map((r) => (
                  <FeedCommentBlock
                    key={r.id}
                    comment={r}
                    currentUserId={currentUserId}
                    onDelete={(id) => void deleteComment(id)}
                    onReply={() => {
                      setReplyToId(c.id)
                      setDraftReply('')
                    }}
                    onReact={(k) => void reactOnComment(r.id, k)}
                    disabled={localBusy}
                    variant="feed"
                    isReply
                    mentionName={c.profiles?.full_name ?? null}
                    mentionAuthorId={c.author_id}
                  />
                ))}
              </div>
            </div>
          ))}

          {currentUserId ? (
            <div className="flex flex-col gap-3 pt-3">
              <textarea
                className={`${role.bodySm} min-h-[80px] w-full rounded-abnb-lg border border-abnb-hairlineSoft px-3 py-2`}
                placeholder={
                  replyToId ? `Trả lời ${replyHint(post, replyToId)}…` : 'Viết bình luận mới…'
                }
                value={replyToId ? draftReply : draftTop}
                onChange={(e) => (replyToId ? setDraftReply(e.target.value) : setDraftTop(e.target.value))}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={localBusy || !(replyToId ? draftReply.trim() : draftTop.trim()).length}
                  className={`${role.btnPrimary} !h-auto shrink-0 !min-h-[2.85rem]`}
                  onClick={() => {
                    if (replyToId) {
                      const top = post.comments.find((x) => x.id === replyToId)
                      if (top) void submitReplyNested(top, draftReply)
                    } else void submitTopComment(draftTop)
                  }}
                >
                  {replyToId ? 'Gửi trả lời' : 'Gửi bình luận'}
                </button>
                {replyToId ? (
                  <button
                    type="button"
                    className={`${role.link} text-[13px] font-semibold`}
                    onClick={() => {
                      setReplyToId(null)
                      setDraftReply('')
                    }}
                  >
                    Huỷ trả lời
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </article>

    {photoViewerIdx !== null && attachmentItems.length > 0 ? (
      <FeedPostPhotoViewer
        open
        onClose={() => {
          setPhotoViewerIdx(null)
          setTheaterMobileCommentsOpen(false)
        }}
        startIndex={photoViewerIdx}
        items={attachmentItems}
        mobileCommentsOpen={theaterMobileCommentsOpen}
        onMobileCommentsOpenChange={setTheaterMobileCommentsOpen}
        mobileFloatingBar={
          <FeedReactionBar
            reactions={post.reactions}
            mineReact={mineReact}
            currentUserId={currentUserId}
            disabled={localBusy}
            onReact={(k) => void react(k)}
            variant="theater"
            density="compact"
            commentCount={commentCount(post)}
            commentsActive={theaterMobileCommentsOpen}
            onToggleComments={() => setTheaterMobileCommentsOpen((v) => !v)}
          />
        }
        sidebar={
          <FeedPostPhotoViewerSidebar
            post={post}
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
          />
        }
      />
    ) : null}
    </>
  )
})

function replyHint(post: FeedPostState, id: string) {
  return post.comments.find((c) => c.id === id)?.profiles?.full_name ?? ''
}

function commentCount(p: FeedPostState): number {
  let n = p.comments.length
  for (const c of p.comments) n += c.replies.length
  return n
}

function Avatar({ url, label }: { url: string | null; label: string }) {
  if (url) {
    return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover shadow-abnb-inner ring-1 ring-abnb-hairlineSoft" />
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-abnb-surfaceSoft text-[14px] font-bold uppercase text-abnb-muted shadow-abnb-inner ring-1 ring-abnb-hairlineSoft">
      {label}
    </span>
  )
}
