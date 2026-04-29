import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, ThumbsUp } from 'lucide-react'
import type { FeedReactionKind } from './reactionKinds'
import {
  FEED_REACTION_KINDS,
  FEED_REACTION_VI,
  reactionEmoji,
} from './reactionKinds'
import type { FeedPostState } from './feedQueries'
import { usePointerFine } from './usePointerFine'

type Props = {
  reactions: FeedPostState['reactions']
  mineReact: FeedPostState['reactions'][number] | undefined
  currentUserId: string | undefined
  disabled: boolean
  onReact: (kind: FeedReactionKind) => void | Promise<void>
  variant: 'feed' | 'theater'
  commentCount: number
  commentsActive?: boolean
  onToggleComments: () => void
  density?: 'default' | 'compact'
}

/** Chỉ icon; với pointer: fine — hover vào ô thích bung dải emoji phía trên (giống Facebook). */
function FeedReactionBarInner({
  reactions,
  mineReact,
  currentUserId,
  disabled,
  onReact,
  variant,
  commentCount,
  commentsActive,
  onToggleComments,
  density = 'default',
}: Props) {
  const finePointer = usePointerFine()

  const [hoverZone, setHoverZone] = useState(false)
  const leaveTimerRef = useRef<number | null>(null)

  const pickerEligible = Boolean(finePointer && currentUserId)
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

  const totalRx = reactions.length
  const distKinds = useMemo(() => {
    const seen = new Set<string>()
    const ordered: FeedReactionKind[] = []
    for (const r of reactions) {
      const kind = r.kind as FeedReactionKind
      if (!seen.has(kind)) {
        seen.add(kind)
        ordered.push(kind)
      }
    }
    return ordered.slice(0, 3)
  }, [reactions])

  const isFeed = variant === 'feed'
  const barBorder = isFeed ? 'border-abnb-hairlineSoft/85' : 'border-[#393a3f]'
  const baseBtn =
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 transition-[background-color,color,transform] duration-150 active:scale-[0.96] disabled:opacity-45 disabled:pointer-events-none'
  const mute = isFeed ? 'text-abnb-muted hover:bg-abnb-surfaceSoft/90' : 'text-[#bcc0c7] hover:bg-white/[0.08]'
  const activeComment = commentsActive
    ? isFeed
      ? 'bg-abnb-surfaceSoft text-abnb-ink ring-1 ring-abnb-hairlineSoft'
      : 'bg-white/12 text-[#e4e6eb]'
    : mute

  const likeActiveCls = mineReact
    ? isFeed
      ? 'bg-abnb-primary/[0.1] text-abnb-primary ring-1 ring-abnb-primary/25'
      : 'bg-white/[0.1] text-[#adc9ff]'
    : ''

  const isLikeKind = mineReact?.kind === 'like'

  const topBar =
    density === 'compact'
      ? 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-0 pb-4 pt-3'
      : `mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-2 ${barBorder}`

  return (
    <div className={topBar}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className={`relative isolate flex shrink-0 items-center ${pickerOpen ? 'z-20' : ''}`}
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
              className={`feed-react-picker animate-feed-picker-shell absolute bottom-full left-0 z-30 mb-2 flex cursor-default items-center rounded-full px-2 py-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.48)] ring-1 ring-white/[0.11] backdrop-blur-md ${
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
                  <span className="pointer-events-none select-none text-[1.4rem] leading-none">{reactionEmoji(k)}</span>
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
            className={`${baseBtn} min-h-[2.5rem] min-w-[2.75rem] ${likeActiveCls || mute}`}
            onClick={() => onLikeClick()}
          >
            {mineReact ? (
              isLikeKind ? (
                <ThumbsUp className="h-[1.2rem] w-[1.2rem] fill-current" aria-hidden strokeWidth={2.3} stroke="currentColor" />
              ) : (
                <span className="text-[1.2rem] leading-none" aria-hidden>
                  {reactionEmoji(mineReact.kind as FeedReactionKind)}
                </span>
              )
            ) : (
              <ThumbsUp className="h-[1.15rem] w-[1.15rem]" aria-hidden strokeWidth={2.25} />
            )}
          </button>
        </div>

        <button
          type="button"
          disabled={disabled || !currentUserId}
          onClick={() => onToggleComments()}
          className={`${baseBtn} min-h-[2.5rem] ${activeComment}`}
          aria-expanded={commentsActive}
          title={`${commentCount} bình luận`}
          aria-label={`Bình luận, ${commentCount}`}
        >
          <MessageCircle className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.1} aria-hidden />
          <span className="min-w-[1.25ch] text-[13px] font-semibold tabular-nums">{commentCount}</span>
        </button>
      </div>

      {totalRx > 0 ? (
        <div
          className={`flex shrink-0 items-center gap-1 ${isFeed ? 'text-abnb-muted' : 'text-[#b0b3b8]'}`}
          aria-label={`${totalRx} biểu tượng cảm xúc`}
        >
          <span className="flex -space-x-1 rtl:space-x-reverse">
            {distKinds.map((k) => (
              <span
                key={`pile-${k}`}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[15px] leading-none shadow-sm ring-[2px] ${
                  isFeed ? 'bg-abnb-surfaceCard ring-abnb-surfaceSoft' : 'bg-[#3a3b3c] ring-[#242526]'
                }`}
                aria-hidden
              >
                {reactionEmoji(k)}
              </span>
            ))}
          </span>
          <span className="text-[13px] font-semibold tabular-nums">{totalRx}</span>
        </div>
      ) : null}
    </div>
  )
}

export const FeedReactionBar = memo(FeedReactionBarInner)
