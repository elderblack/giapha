import { Link } from 'react-router-dom'
import { List, User } from 'lucide-react'
import { role } from '../../design/roles'
import type { MemberRow } from './treeTypes'
import { formatDateVi, genderLabel, parentLabel, spouseLabel } from './treeTypes'
import { memberInitial } from './treeUi'

export function MemberDetailSummaryHeader({
  selected,
  gen,
  myLinkedMemberId,
  titleId,
}: {
  selected: MemberRow
  gen: number
  myLinkedMemberId: string | null
  /** Gắn vào tiêu đề chính (aria-labelledby dialog) */
  titleId?: string
}) {
  return (
    <div className="flex items-start gap-3">
      {selected.avatar_url ? (
        <img
          src={selected.avatar_url}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full object-cover shadow-abnb ring-2 ring-abnb-canvas"
        />
      ) : (
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-abnb-primary/18 to-abnb-luxe/12 text-[15px] font-bold text-abnb-primary shadow-abnb-inner ring-2 ring-abnb-canvas"
          aria-hidden
        >
          {memberInitial(selected.full_name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p id={titleId} className="text-[15px] font-semibold leading-snug text-abnb-ink">
          {selected.full_name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className={role.caption}>Thế hệ {gen}</p>
          {myLinkedMemberId === selected.id ? (
            <span className="rounded-full bg-abnb-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-abnb-primary ring-1 ring-abnb-primary/25">
              Bạn
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function MemberDetailFields({
  selected,
  members,
  kinship,
  userId,
  canUseClaim,
  myLinkedMemberId,
  linkBusyId,
  onClaim,
  onUnlink,
  base,
  variant = 'modal',
}: {
  selected: MemberRow
  members: MemberRow[] | null
  kinship: string | null
  userId: string | undefined
  canUseClaim: boolean
  myLinkedMemberId: string | null
  linkBusyId: string | null
  onClaim: (id: string) => void
  onUnlink: (id: string) => void
  base: string
  /** `aside` = trong panel sticky (padding do khối ngoài bọc) */
  variant?: 'modal' | 'aside'
}) {
  const shell =
    variant === 'aside' ? 'space-y-4' : 'space-y-4 px-4 pb-6 pt-2 sm:px-5'
  return (
    <div className={shell}>
      <dl className="space-y-3 text-[13px]">
        <div className="flex justify-between gap-3 border-b border-abnb-hairlineSoft/70 pb-3">
          <dt className="text-abnb-muted">Giới tính</dt>
          <dd className="text-right font-medium text-abnb-ink">
            {selected.gender ? genderLabel[selected.gender] ?? selected.gender : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-abnb-hairlineSoft/70 pb-3">
          <dt className="text-abnb-muted">Sinh</dt>
          <dd className="font-medium text-abnb-ink">{formatDateVi(selected.birth_date)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-abnb-hairlineSoft/70 pb-3">
          <dt className="text-abnb-muted">Mất</dt>
          <dd className="font-medium text-abnb-ink">{formatDateVi(selected.death_date)}</dd>
        </div>
        <div className="border-b border-abnb-hairlineSoft/70 pb-3">
          <dt className="text-abnb-muted">Cha / mẹ</dt>
          <dd className="mt-1.5 font-medium leading-snug text-abnb-ink">
            {parentLabel(members ?? [], selected.father_id)} · {parentLabel(members ?? [], selected.mother_id)}
          </dd>
        </div>
        <div>
          <dt className="text-abnb-muted">Vợ / chồng</dt>
          <dd className="mt-1.5 font-medium text-abnb-ink">{spouseLabel(members ?? [], selected)}</dd>
        </div>
      </dl>

      {kinship ? (
        <p
          className={`${role.bodySm} rounded-abnb-lg border border-abnb-hairlineSoft/70 bg-abnb-surfaceSoft/50 px-3 py-2 text-abnb-muted`}
        >
          Vai vế (gợi ý): <span className="font-semibold text-abnb-ink">{kinship}</span>
        </p>
      ) : null}

      {selected.linked_profile_id ? (
        <p className={`${role.bodySm} font-medium text-abnb-primary`}>
          Đã liên kết tài khoản
          {selected.linked_profile_id === userId ? ' (bạn)' : ''}
        </p>
      ) : null}

      {userId && canUseClaim ? (
        <div className="flex flex-col gap-2 border-t border-abnb-hairlineSoft pt-4">
          {!selected.linked_profile_id && !myLinkedMemberId ? (
            <button
              type="button"
              disabled={linkBusyId !== null}
              onClick={() => void onClaim(selected.id)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-abnb-hairlineSoft bg-abnb-surfaceSoft px-4 py-2.5 text-[13px] font-semibold text-abnb-ink transition-colors hover:bg-abnb-hairlineSoft/35 disabled:opacity-60"
            >
              <User className="h-4 w-4" />
              Đây là tôi
            </button>
          ) : null}
          {selected.linked_profile_id === userId ? (
            <button
              type="button"
              disabled={linkBusyId !== null}
              onClick={() => void onUnlink(selected.id)}
              className="rounded-full border border-abnb-hairlineSoft px-4 py-2.5 text-[13px] font-semibold text-abnb-muted hover:bg-abnb-surfaceSoft disabled:opacity-60"
            >
              Huỷ liên kết
            </button>
          ) : null}
        </div>
      ) : null}

      <Link
        to={`${base}/members`}
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-abnb-primary no-underline hover:underline"
      >
        <List className="h-4 w-4" />
        Sửa trong danh sách
      </Link>
    </div>
  )
}
