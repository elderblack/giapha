import { Link } from 'react-router-dom'
import { role } from '../../design/roles'
import type { FeedCommentRow, FeedPostState } from './feedQueries'
import type { FeedReactionKind } from './reactionKinds'
import { FeedReactionBar } from './FeedReactionBar'
import { FeedCommentLine } from './FeedCommentLine'
import { feedUserProfilePath } from './feedProfileHref'
import { formatFeedDt } from './feedDate'

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
}

/**
 * Panel phải trong lightbox kiểu Facebook: tác giả, nội dung, cảm xúc, danh sách bình luận.
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
}: FeedPostViewerSidebarProps) {
  const profile = post.profiles
  const initials = profile?.full_name?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex min-h-full flex-col pb-[env(safe-area-inset-bottom)]">
      <div className="border-b border-white/[0.08] px-4 py-3">
        <p className="text-[13px] text-[#b0b3b8]">Ảnh trong bài viết</p>
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
          <p className={`${role.bodySm} mt-3 whitespace-pre-wrap text-[#e4e6eb]/95`}>{post.body}</p>
        ) : null}
      </div>

      <div className="border-b border-white/[0.08] px-4">
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
            document.getElementById(`feed-comment-anchor-${post.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }}
        />
      </div>

      <div className="flex min-h-[12rem] flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
        {post.comments.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[#8a8d92]">
            Chưa có bình luận nào — hãy là người đầu tiên bình luận phía dưới.
          </p>
        ) : (
          post.comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-[#3a3b3c]/95 px-3 py-2">
              <FeedCommentLine
                comment={c}
                currentUserId={currentUserId}
                onDelete={onDeleteComment}
                variant="theater"
              />
              <div className="ml-2 mt-2 space-y-2 border-l border-white/10 pl-3">
                {c.replies.map((r) => (
                  <FeedCommentLine
                    key={r.id}
                    comment={{ ...r, replies: [], profiles: r.profiles }}
                    currentUserId={currentUserId}
                    onDelete={onDeleteComment}
                    variant="theater"
                  />
                ))}
                {currentUserId ? (
                  <button
                    type="button"
                    className={`${role.link} text-[13px] font-semibold !text-[#bcc0c7]`}
                    onClick={() => {
                      setReplyToId(c.id)
                      setDraftReply('')
                    }}
                  >
                    Trả lời
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {currentUserId ? (
        <div id={`feed-comment-anchor-${post.id}`} className="sticky bottom-0 border-t border-white/[0.1] bg-[#242526] px-4 py-3">
          <textarea
            className={`${role.bodySm} min-h-[76px] w-full rounded-xl border border-white/[0.12] bg-[#3a3b3c] px-3 py-2 text-[#e4e6eb] placeholder:text-[#8a8d92]`}
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
