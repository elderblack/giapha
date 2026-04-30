import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThumbsUp } from 'lucide-react'
import { role } from '../../design/roles'
import type { FeedCommentReactionRow, FeedCommentRow, FeedProfileLite } from './feedQueries'
import type { FeedReactionKind } from './reactionKinds'
import { FEED_REACTION_KINDS, FEED_REACTION_VI, reactionEmoji } from './reactionKinds'
import { feedUserProfilePath } from './feedProfileHref'
import { formatFeedRelativeVi } from './feedDate'
import { usePointerFine } from './usePointerFine'
import { useMinLg } from '../../hooks/useMinLg'

type CommentNode = FeedCommentRow & {
  profiles?: FeedProfileLite
  reactions?: FeedCommentReactionRow[]
}

type Props = {
  comment: CommentNode
  variant: 'feed' | 'theater'
  currentUserId: string | undefined
  onDelete: (id: string) => void
  onReply: () => void
  onReact: (kind: FeedReactionKind) => void
  disabled?: boolean
  /** Tên tài khoản được nhắc trong phản hồi (in đậm trước nội dung) */
  mentionName?: string | null
  mentionAuthorId?: string | null
  isReply?: boolean
}

function FeedCommentBlockInner({
  comment,
  variant,
  currentUserId,
  onDelete,
  onReply,
  onReact,
  disabled = false,
  mentionName = null,
  mentionAuthorId = null,
  isReply = false,
}: Props) {
  const finePointer = usePointerFine()
  const isLg = useMinLg()
  const [hoverZone, setHoverZone] = useState(false)
  const leaveTimerRef = useRef<number | null>(null)

  const reactions = comment.reactions ?? []
  const mineReact = reactions.find((r) => r.user_id === currentUserId)
  const del = Boolean(currentUserId && comment.author_id === currentUserId)
  const label = comment.profiles?.full_name ?? 'Thành viên'
  const initials = label.trim()?.[0]?.toUpperCase() ?? '?'

  const pickerEligible = Boolean(finePointer && currentUserId && isLg)
  const pickerOpen = pickerEligible && hoverZone

  const clearLeave = useCallback(() => {
    if (leaveTimerRef.current != null) {
      window.clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }, [])

  const scheduleLeave = useCallback(() => {
    if (!finePointer) return
    clearLeave()
    leaveTimerRef.current = window.setTimeout(() => setHoverZone(false), 210)
  }, [finePointer, clearLeave])

  useEffect(() => () => clearLeave(), [clearLeave])

  const pick = useCallback(
    (k: FeedReactionKind) => {
      void onReact(k)
      setHoverZone(false)
    },
    [onReact],
  )

  const onLikeClick = () => {
    if (disabled || !currentUserId) return
    const k = mineReact ? (mineReact.kind as FeedReactionKind) : 'like'
    void onReact(k)
  }

  const isFeed = variant === 'feed'
  const bubbleBg = isFeed ? 'bg-abnb-surfaceSoft/95' : 'bg-[#3a3b3c]'
  const ink = isFeed ? 'text-abnb-ink' : 'text-[#e4e6eb]'
  const bodyInk = isFeed ? 'text-abnb-body' : 'text-[#e4e6eb]/92'
  const metaInk = isFeed ? 'text-abnb-muted' : 'text-[#bcc0c7]'
  const linkInk = isFeed ? 'text-abnb-primary' : 'text-[#8cb4ff]'
  const nameCls = isFeed
    ? `text-[13px] font-semibold ${ink} underline-offset-2 hover:text-abnb-primary hover:underline`
    : `text-[13px] font-semibold ${ink} underline-offset-2 hover:underline`
  const delCls = isFeed
    ? 'text-[12px] font-semibold text-abnb-error hover:underline'
    : 'text-[12px] font-semibold text-red-400 hover:underline'
  const activeLikeCls = mineReact
    ? isFeed
      ? `${linkInk}`
      : 'text-[#adc9ff]'
    : `${metaInk} hover:underline`

  const avSize = isReply ? 'h-8 w-8' : 'h-9 w-9'
  const timeShort = formatFeedRelativeVi(comment.created_at)

  return (
    <div className={`flex gap-2 ${isReply ? 'mt-2' : ''}`}>
      <Link
        to={feedUserProfilePath(comment.author_id)}
        className={`shrink-0 self-start rounded-full outline-none ring-offset-2 transition hover:opacity-95 focus-visible:ring-2 ${
          isFeed ? 'ring-offset-abnb-surfaceCard ring-abnb-primary/25' : 'ring-offset-[#242526] ring-white/20'
        }`}
        aria-label={`Hồ sơ ${label}`}
      >
        {comment.profiles?.avatar_url ? (
          <img
            src={comment.profiles.avatar_url}
            alt=""
            className={`${avSize} rounded-full object-cover ring-1 ${
              isFeed ? 'ring-abnb-hairlineSoft/80' : 'ring-white/10'
            }`}
          />
        ) : (
          <span
            className={`flex ${avSize} items-center justify-center rounded-full text-[12px] font-bold uppercase ${
              isFeed ? 'bg-abnb-surfaceSoft text-abnb-muted ring-1 ring-abnb-hairlineSoft' : 'bg-white/12 text-[#bcc0c7]'
            }`}
          >
            {initials}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div
          className={`relative inline-block max-w-full rounded-2xl px-3 py-2 ${bubbleBg} ${
            isFeed ? 'ring-1 ring-abnb-hairlineSoft/40' : 'ring-1 ring-white/[0.06]'
          }`}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link to={feedUserProfilePath(comment.author_id)} className={nameCls}>
              {label}
            </Link>
          </div>
          <p className={`${role.bodySm} mt-0.5 whitespace-pre-wrap ${bodyInk}`}>
            {mentionName && mentionAuthorId ? (
              <>
                <Link
                  to={feedUserProfilePath(mentionAuthorId)}
                  className={`font-semibold ${ink} underline-offset-2 hover:underline`}
                >
                  {mentionName}
                </Link>{' '}
              </>
            ) : null}
            {comment.body}
          </p>
        </div>

        <div
          className={`mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] font-semibold sm:text-[13px] ${metaInk}`}
        >
          <span className="tabular-nums">{timeShort}</span>
          <span aria-hidden>·</span>

          <div
            className={`relative inline-flex items-center ${pickerOpen ? 'z-20' : ''}`}
            onMouseEnter={() => {
              if (!pickerEligible) return
              clearLeave()
              setHoverZone(true)
            }}
            onMouseLeave={() => {
              if (!pickerEligible) return
              scheduleLeave()
            }}
          >
            {pickerOpen ? (
              <div
                role="menu"
                aria-label="Chọn biểu tượng cảm xúc"
                className={`feed-react-picker animate-feed-picker-shell absolute bottom-full left-0 z-30 mb-1.5 flex cursor-default items-center rounded-full px-2 py-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.48)] ring-1 ring-white/[0.11] backdrop-blur-md ${
                  isFeed ? 'bg-[rgba(20,21,23,0.94)]' : 'bg-[rgba(10,11,13,0.96)]'
                }`}
                onMouseEnter={() => {
                  clearLeave()
                  setHoverZone(true)
                }}
                onMouseLeave={() => scheduleLeave()}
              >
                {FEED_REACTION_KINDS.map((k, idx) => (
                  <button
                    key={k}
                    type="button"
                    role="menuitem"
                    title={FEED_REACTION_VI[k]}
                    aria-label={FEED_REACTION_VI[k]}
                    disabled={disabled}
                    className={`feed-react-picker-chip rounded-full px-2 py-1 outline-none ring-0 transition-transform duration-200 hover:scale-[1.22] hover:bg-white/14 focus-visible:ring-2 focus-visible:ring-white/35 disabled:pointer-events-none disabled:opacity-35 ${
                      mineReact?.kind === k ? 'bg-white/[0.1]' : ''
                    }`}
                    style={{ animationDelay: `${idx * 42}ms` }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!currentUserId) return
                      pick(k)
                    }}
                  >
                    <span className="pointer-events-none select-none text-[1.35rem] leading-none">{reactionEmoji(k)}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              disabled={disabled || !currentUserId}
              title={mineReact ? FEED_REACTION_VI[mineReact.kind as FeedReactionKind] : FEED_REACTION_VI.like}
              aria-expanded={pickerOpen}
              aria-haspopup={pickerEligible ? 'menu' : undefined}
              className={`inline-flex min-h-[1.5rem] items-center gap-1 disabled:opacity-45 ${activeLikeCls}`}
              onClick={() => onLikeClick()}
            >
              {isLg ? (
                <>
                  {mineReact?.kind === 'like' || !mineReact ? (
                    <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
                  ) : (
                    <span className="text-[1rem] leading-none" aria-hidden>
                      {reactionEmoji(mineReact.kind as FeedReactionKind)}
                    </span>
                  )}
                  <span>
                    {mineReact ? FEED_REACTION_VI[mineReact.kind as FeedReactionKind] : 'Thích'}
                  </span>
                </>
              ) : (
                <span>{mineReact ? FEED_REACTION_VI[mineReact.kind as FeedReactionKind] : 'Thích'}</span>
              )}
            </button>
          </div>

          <span aria-hidden>·</span>
          <button
            type="button"
            className={`min-h-[1.5rem] hover:underline ${!currentUserId ? 'opacity-55' : ''} ${metaInk}`}
            onClick={() => {
              if (!currentUserId) return
              onReply()
            }}
          >
            Trả lời
          </button>

          {del ? (
            <>
              <span aria-hidden>·</span>
              <button type="button" className={delCls} onClick={() => onDelete(comment.id)}>
                Xoá
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export const FeedCommentBlock = memo(FeedCommentBlockInner)
