import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { role } from '../../design/roles'
import { useMaxLg } from '../../hooks/useMaxLg'
import type { FeedCommentRow, FeedPostState } from './feedQueries'
import type { FeedReactionKind } from './reactionKinds'
import { FeedReactionBar } from './FeedReactionBar'
import { FeedCommentBlock } from './FeedCommentBlock'
import { feedUserProfilePath } from './feedProfileHref'
import { formatFeedDt } from './feedDate'

const MOBILE_THEATER_COMMENT_PAGE = 8
const THEATER_DESKTOP_REPLY_PREVIEW = 1

export type FeedPostViewerSidebarProps = {
  post: FeedPostState
  currentUserId: string | undefined
  showTreeLink: boolean
  localBusy: boolean
  mineReact: FeedPostState['reactions'][number] | undefined
  onReact: (kind: FeedReactionKind) => void
  draftTop: string
  setDraftTop: (v: string) => void
  draftReply: string
  setDraftReply: (v: string) => void
  replyToId: string | null
  setReplyToId: (v: string | null) => void
  onSubmitTop: () => void
  onSubmitReply: (top: FeedCommentRow) => void
  onDeleteComment: (id: string) => void
  onReactComment: (commentId: string, kind: FeedReactionKind) => void
}

/**
 * Desktop: panel có thanh cảm xúc. Mobile sheet: chỉ bài + bình luận (thanh like/comment nổi trên ảnh); cuộn tải thêm bình luận gốc từng lượt.
 */
export function FeedPostPhotoViewerSidebar({
  post,
  currentUserId,
  showTreeLink,
  localBusy,
  mineReact,
  onReact,
  draftTop,
  setDraftTop,
  draftReply,
  setDraftReply,
  replyToId,
  setReplyToId,
  onSubmitTop,
  onSubmitReply,
  onDeleteComment,
  onReactComment,
}: FeedPostViewerSidebarProps) {
  const isMobileSheet = useMaxLg()
  const [bodyExpanded, setBodyExpanded] = useState(false)
  const [visibleTopCount, setVisibleTopCount] = useState(MOBILE_THEATER_COMMENT_PAGE)
  const [theaterRepliesExpanded, setTheaterRepliesExpanded] = useState<Record<string, boolean>>({})
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const commentsScrollRef = useRef<HTMLDivElement | null>(null)

  const profile = post.profiles
  const initials = profile?.full_name?.trim()?.[0]?.toUpperCase() ?? '?'
  const bodyLong =
    Boolean(post.body) &&
    ((post.body?.length ?? 0) > 280 || (post.body?.split('\n').length ?? 0) > 5)

  useEffect(() => {
    if (isMobileSheet) {
      queueMicrotask(() => setVisibleTopCount(MOBILE_THEATER_COMMENT_PAGE))
    }
  }, [post.id, isMobileSheet])

  useEffect(() => {
    setTheaterRepliesExpanded({})
  }, [post.id])

  const commentsToRender = isMobileSheet
    ? post.comments.slice(0, Math.min(visibleTopCount, post.comments.length))
    : post.comments
  const hasMoreTops = isMobileSheet && visibleTopCount < post.comments.length

  useEffect(() => {
    if (!isMobileSheet || !hasMoreTops) return
    const root = commentsScrollRef.current
    const node = loadMoreSentinelRef.current
    if (!root || !node) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisibleTopCount((c) => Math.min(c + MOBILE_THEATER_COMMENT_PAGE, post.comments.length))
          }
        }
      },
      { root, rootMargin: '80px', threshold: 0 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [isMobileSheet, hasMoreTops, visibleTopCount, post.comments.length])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#242526] pb-[env(safe-area-inset-bottom,0px)]">
      <div
        ref={commentsScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-y]"
      >
        <div className="border-b border-white/[0.08] px-4 py-2.5 lg:py-3">
          <p className="text-[12px] font-medium text-[#b0b3b8] lg:text-[13px]">Ảnh trong bài viết</p>
        </div>

        <div className="border-b border-white/[0.08] px-4 pb-4 pt-3">
          <div className="flex gap-3">
            <Link
              to={feedUserProfilePath(post.author_id)}
              className="shrink-0 rounded-full outline-none ring-offset-2 ring-offset-[#242526] transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[#bcc0c7]/35"
              aria-label={`Hồ sơ ${profile?.full_name?.trim() || 'thành viên'}`}
            >
              <ViewerAvatar url={profile?.avatar_url ?? null} label={initials} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-snug">
                <Link
                  to={feedUserProfilePath(post.author_id)}
                  className="text-[#e4e6eb] underline-offset-2 hover:underline"
                >
                  {profile?.full_name ?? 'Thành viên'}
                </Link>
              </p>
              <p className="text-[12px] text-[#b0b3b8]">{formatFeedDt(post.created_at)}</p>
              {showTreeLink && post.tree_name ? (
                <p className="mt-1">
                  <Link
                    to={`/app/trees/${post.family_tree_id}/overview`}
                    className="text-[12px] font-semibold text-[#e4e6eb]/80 hover:underline"
                  >
                    · {post.tree_name}
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
          {post.body ? (
            <div className="mt-3">
              <p
                className={`${role.bodySm} whitespace-pre-wrap text-[#e4e6eb]/95 ${
                  !bodyExpanded && bodyLong ? 'line-clamp-4' : ''
                }`}
              >
                {post.body}
              </p>
              {bodyLong ? (
                <button
                  type="button"
                  className="mt-1.5 text-[13px] font-semibold text-[#8cb4ff] hover:underline"
                  onClick={() => setBodyExpanded((v) => !v)}
                >
                  {bodyExpanded ? 'Thu gọn' : 'Xem thêm'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-0 px-4 py-3">
          {post.comments.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#8a8d92] lg:py-8">
              Chưa có bình luận — hãy là người đầu tiên.
            </p>
          ) : (
            <>
              {commentsToRender.map((c) => {
                const repliesAll =
                  isMobileSheet || theaterRepliesExpanded[c.id]
                    ? c.replies
                    : c.replies.slice(0, THEATER_DESKTOP_REPLY_PREVIEW)
                const hasMoreReplies =
                  !isMobileSheet &&
                  !theaterRepliesExpanded[c.id] &&
                  c.replies.length > THEATER_DESKTOP_REPLY_PREVIEW
                return (
                  <div key={c.id} className="mb-3 px-0 py-1 last:mb-0">
                    <FeedCommentBlock
                      comment={c}
                      currentUserId={currentUserId}
                      onDelete={onDeleteComment}
                      onReply={() => {
                        setReplyToId(c.id)
                        setDraftReply('')
                        document.getElementById(`feed-comment-anchor-${post.id}`)?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'nearest',
                        })
                      }}
                      onReact={(k) => onReactComment(c.id, k)}
                      disabled={localBusy}
                      variant="theater"
                    />
                    <div className="ml-10 border-l border-white/10 pl-3">
                      {repliesAll.map((r) => (
                        <FeedCommentBlock
                          key={r.id}
                          comment={r}
                          currentUserId={currentUserId}
                          onDelete={onDeleteComment}
                          onReply={() => {
                            setReplyToId(c.id)
                            setDraftReply('')
                            document.getElementById(`feed-comment-anchor-${post.id}`)?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            })
                          }}
                          onReact={(k) => onReactComment(r.id, k)}
                          disabled={localBusy}
                          variant="theater"
                          isReply
                          mentionName={c.profiles?.full_name ?? null}
                          mentionAuthorId={c.author_id}
                        />
                      ))}
                      {hasMoreReplies ? (
                        <button
                          type="button"
                          className="mt-1 py-1 text-left text-[13px] font-semibold text-[#bcc0c7] hover:text-[#e4e6eb]"
                          onClick={() =>
                            setTheaterRepliesExpanded((prev) => ({
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
              {hasMoreTops ? (
                <div ref={loadMoreSentinelRef} className="h-8 w-full shrink-0" aria-hidden />
              ) : null}
            </>
          )}
        </div>
      </div>

      {!isMobileSheet ? (
        <div className="shrink-0 border-t border-white/[0.12] bg-[#242526] px-3 sm:px-4">
          <FeedReactionBar
            reactions={post.reactions}
            mineReact={mineReact}
            currentUserId={currentUserId}
            disabled={localBusy}
            onReact={onReact}
            variant="theater"
            density="compact"
            commentCount={commentCount(post)}
            commentsActive={false}
            onToggleComments={() => {
              document.getElementById(`feed-comment-anchor-${post.id}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              })
            }}
          />
        </div>
      ) : null}

      {currentUserId ? (
        <div
          id={`feed-comment-anchor-${post.id}`}
          className="shrink-0 border-t border-white/[0.1] bg-[#242526] px-3 py-3 sm:px-4"
        >
          <textarea
            className={`${role.bodySm} min-h-[72px] w-full rounded-xl border border-white/[0.12] bg-[#3a3b3c] px-3 py-2 text-[#e4e6eb] placeholder:text-[#8a8d92] lg:min-h-[76px]`}
            placeholder={
              replyToId ? `Trả lời ${replyHint(post, replyToId)}…` : 'Viết bình luận…'
            }
            value={replyToId ? draftReply : draftTop}
            onChange={(e) => (replyToId ? setDraftReply(e.target.value) : setDraftTop(e.target.value))}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={localBusy || !(replyToId ? draftReply.trim() : draftTop.trim()).length}
              className={`${role.btnPrimary} !h-auto !min-h-[2.85rem]`}
              onClick={() => {
                if (replyToId) {
                  const top = post.comments.find((x) => x.id === replyToId)
                  if (top) onSubmitReply(top)
                } else void onSubmitTop()
              }}
            >
              {replyToId ? 'Gửi trả lời' : 'Gửi'}
            </button>
            {replyToId ? (
              <button
                type="button"
                className={`${role.link} text-[13px] font-semibold !text-[#bcc0c7]`}
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
    </div>
  )
}

function ViewerAvatar({ url, label }: { url: string | null; label: string }) {
  if (url) {
    return (
      <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/10" />
    )
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-[14px] font-bold uppercase text-[#bcc0c7] ring-2 ring-white/15">
      {label}
    </span>
  )
}

function commentCount(p: FeedPostState): number {
  let n = p.comments.length
  for (const c of p.comments) n += c.replies.length
  return n
}

function replyHint(post: FeedPostState, id: string) {
  return post.comments.find((c) => c.id === id)?.profiles?.full_name ?? ''
}
