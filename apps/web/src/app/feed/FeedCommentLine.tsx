import { Link } from 'react-router-dom'
import { role } from '../../design/roles'
import type { FeedCommentRow, FeedPostState } from './feedQueries'
import { feedUserProfilePath } from './feedProfileHref'

type Props = {
  comment: FeedCommentRow & { replies: unknown[]; profiles?: FeedPostState['profiles'] }
  currentUserId: string | undefined
  onDelete: (id: string) => void
  variant: 'feed' | 'theater'
}

export function FeedCommentLine({ comment, currentUserId, onDelete, variant }: Props) {
  const del = Boolean(currentUserId && comment.author_id === currentUserId)
  const label = comment.profiles?.full_name ?? 'Thành viên'
  const nameLinkCls =
    variant === 'feed'
      ? 'text-[14px] font-semibold text-abnb-ink underline-offset-2 hover:text-abnb-primary hover:underline'
      : 'font-semibold text-[#e4e6eb] underline-offset-2 hover:underline'
  const bodyCls =
    variant === 'feed' ? 'text-abnb-body' : 'text-[#e4e6eb]/92'
  const delCls =
    variant === 'feed'
      ? 'shrink-0 text-[11px] font-semibold uppercase text-abnb-error'
      : 'shrink-0 text-[11px] font-semibold uppercase text-red-400'

  return (
    <div className={`${role.bodySm} flex flex-wrap gap-2 ${variant === 'theater' ? 'text-[13px]' : ''}`}>
      <Link to={feedUserProfilePath(comment.author_id)} className={nameLinkCls}>
        {label}
      </Link>
      <span className={`min-w-[12rem] flex-1 whitespace-pre-wrap ${bodyCls}`}>{comment.body}</span>
      {del ? (
        <button type="button" className={delCls} onClick={() => onDelete(comment.id)}>
          Xoá
        </button>
      ) : null}
    </div>
  )
}
