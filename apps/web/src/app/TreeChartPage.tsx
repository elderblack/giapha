import { useState } from 'react'
import { Link } from 'react-router-dom'
import { List, Move, Pointer, User, UserPlus, X } from 'lucide-react'
import { FamilyTreeChart } from '../components/FamilyTreeChart'
import { FamilyTreeHierarchyChart } from '../components/FamilyTreeHierarchyChart'
import { role } from '../design/roles'
import { useAuth } from '../auth/useAuth'
import { formatDateVi, genderLabel, parentLabel, spouseLabel } from './tree/treeTypes'
import { TreePageIntro } from './tree/TreeChrome'
import { memberInitial, treeAlertInfo } from './tree/treeUi'
import { useTreeWorkspace } from './tree/treeWorkspaceContext'
import { describeKinship } from '../lib/kinshipVi'
import { AddMemberModal } from './tree/AddMemberModal'

export function TreeChartPage() {
  const { user } = useAuth()
  const {
    tree,
    treeId,
    members,
    chartMembers,
    generations,
    canUseClaim,
    canEditMembers,
    myLinkedMemberId,
    myTreeRole,
    linkBusyId,
    claimMember,
    unlinkMember,
    loadMembers,
    supportsMemberPhoneColumn,
  } = useTreeWorkspace()
  const [chartView, setChartView] = useState<'tree' | 'force'>('tree')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addModalKey, setAddModalKey] = useState(0)

  const canProposeMember = myTreeRole === 'member' && Boolean(myLinkedMemberId)
  const canOpenAddModal = canEditMembers || canProposeMember

  const selected = members?.find((m) => m.id === selectedId) ?? null
  const gen = selectedId ? (generations.get(selectedId) ?? 0) : 0
  const kinship =
    selected && myLinkedMemberId
      ? describeKinship(myLinkedMemberId, selected, members ?? [])
      : null
  const base = `/app/trees/${treeId}`

  if (!tree) return null

  return (
    <div className="animate-fade-up space-y-8">
      <TreePageIntro kicker="Phả hệ" title="Sơ đồ quan hệ">
        Dùng cử chỉ hoặc chuột để kéo khung vẽ; chọn một người — trên điện thoại thông tin hiện ngay phía trên sơ đồ. Bấm ✕ để bỏ chọn và xem lại cây.
      </TreePageIntro>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className={`${treeAlertInfo} flex flex-wrap items-center gap-x-4 gap-y-2 border-dashed`}>
          <span className="inline-flex items-center gap-2 text-abnb-muted">
            <Pointer className="h-4 w-4 shrink-0 text-abnb-primary" />
            Bấm để chọn
          </span>
          <span className="hidden h-4 w-px bg-abnb-hairlineSoft sm:block" />
          <span className="inline-flex items-center gap-2 text-abnb-muted">
            <Move className="h-4 w-4 shrink-0 text-abnb-primary" />
            Kéo để di chuyển khung
          </span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className={`${role.segmentedTrack} shrink-0`}>
            <button
              type="button"
              onClick={() => setChartView('tree')}
              className={`${role.segmentBtn} ${
                chartView === 'tree' ? role.segmentBtnActive : role.segmentBtnInactive
              }`}
            >
              Cây phả hệ
            </button>
            <button
              type="button"
              onClick={() => setChartView('force')}
              className={`${role.segmentBtn} ${
                chartView === 'force' ? role.segmentBtnActive : role.segmentBtnInactive
              }`}
            >
              Lực (force)
            </button>
          </div>
          {canOpenAddModal ? (
            <button
              type="button"
              onClick={() => {
                setAddModalKey((k) => k + 1)
                setAddModalOpen(true)
              }}
              className={`${role.btnPrimary} inline-flex shrink-0 items-center justify-center gap-2 !rounded-full !px-5 !text-[14px]`}
            >
              <UserPlus className="h-4 w-4" strokeWidth={2} />
              {canEditMembers ? 'Thêm thành viên' : 'Đề xuất thêm người'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(17rem,280px)] lg:items-start">
        <section className={`min-w-0 scroll-mt-4 ${selectedId ? 'max-lg:order-2' : ''}`}>
          <div
            className={`${role.card} overflow-hidden !p-0 shadow-abnb-lg ring-1 ring-abnb-hairlineSoft/60`}
            style={{ minHeight: members === null ? 200 : 420 }}
          >
            {members === null ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-8">
                <p className="text-sm font-medium text-abnb-muted">Đang tải dữ liệu cây…</p>
              </div>
            ) : members.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-10 text-center">
                <p className={`${role.bodyMd} text-abnb-muted`}>Chưa có thành viên để hiển thị.</p>
                {canOpenAddModal ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAddModalKey((k) => k + 1)
                      setAddModalOpen(true)
                    }}
                    className={`${role.btnPrimary} !h-11 !rounded-full !px-6`}
                  >
                    {canEditMembers ? 'Thêm người đầu tiên' : 'Đề xuất thêm người'}
                  </button>
                ) : (
                  <Link to={`${base}/members`} className={`${role.btnPrimary} !h-11 !rounded-full !px-6 no-underline`}>
                    Đến tab thành viên
                  </Link>
                )}
              </div>
            ) : chartView === 'tree' ? (
              <FamilyTreeHierarchyChart
                members={chartMembers}
                selectedId={selectedId}
                selfMemberId={myLinkedMemberId}
                onNodeClick={setSelectedId}
                className="min-h-[360px] !rounded-abnb-lg"
              />
            ) : (
              <FamilyTreeChart
                members={chartMembers}
                selectedId={selectedId}
                selfMemberId={myLinkedMemberId}
                onNodeClick={setSelectedId}
                className="min-h-[360px] !rounded-abnb-lg"
              />
            )}
          </div>
        </section>

        <aside
          className={`${role.card} !p-0 scroll-mt-20 max-lg:shadow-abnb-lg lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:shadow-none ${selectedId ? 'max-lg:order-1' : ''}`}
        >
          <div className="border-b border-abnb-hairlineSoft/80 bg-abnb-surfaceSoft/40 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-start gap-3">
              {selected ? (
                selected.avatar_url ? (
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
                )
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-abnb-ink">
                  {!selected ? 'Thông tin nhanh' : selected.full_name}
                </p>
                {!selected ? (
                  <p className={`${role.bodySm} mt-1 text-abnb-muted`}>Chọn một người trên đồ thị.</p>
                ) : (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className={`${role.caption}`}>Thế hệ {gen}</p>
                    {myLinkedMemberId === selected.id ? (
                      <span className="rounded-full bg-abnb-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-abnb-primary ring-1 ring-abnb-primary/25">
                        Bạn
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
              {selected ? (
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-abnb-hairlineSoft bg-abnb-canvas text-abnb-muted transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-ink lg:hidden"
                  aria-label="Bỏ chọn, xem lại cây phía trên"
                  onClick={() => setSelectedId(null)}
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="px-5 py-4">
            {!selected ? (
              <div className="space-y-4">
                <p className={`${role.bodySm} text-abnb-muted`}>
                  Khi chọn xong, bạn sẽ thấy giới tính, ngày sinh, cha mẹ, vợ chồng và có thể liên kết tài khoản (nếu
                  được phép).
                </p>
                <Link
                  to={`${base}/members`}
                  className={`${role.bodySm} inline-flex items-center gap-2 font-semibold text-abnb-primary no-underline hover:underline`}
                >
                  <List className="h-4 w-4" />
                  Mở danh sách thành viên
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
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
                      {parentLabel(members ?? [], selected.father_id)} ·{' '}
                      {parentLabel(members ?? [], selected.mother_id)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-abnb-muted">Vợ / chồng</dt>
                    <dd className="mt-1.5 font-medium text-abnb-ink">{spouseLabel(members ?? [], selected)}</dd>
                  </div>
                </dl>

                {kinship ? (
                  <p className={`${role.bodySm} rounded-abnb-lg border border-abnb-hairlineSoft/70 bg-abnb-surfaceSoft/50 px-3 py-2 text-abnb-muted`}>
                    Vai vế (gợi ý):{' '}
                    <span className="font-semibold text-abnb-ink">{kinship}</span>
                  </p>
                ) : null}

                {selected.linked_profile_id ? (
                  <p className={`${role.bodySm} font-medium text-abnb-primary`}>
                    Đã liên kết tài khoản
                    {selected.linked_profile_id === user?.id ? ' (bạn)' : ''}
                  </p>
                ) : null}

                {user?.id && canUseClaim ? (
                  <div className="flex flex-col gap-2 border-t border-abnb-hairlineSoft pt-4">
                    {!selected.linked_profile_id && !myLinkedMemberId ? (
                      <button
                        type="button"
                        disabled={linkBusyId !== null}
                        onClick={() => void claimMember(selected.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-abnb-hairlineSoft bg-abnb-surfaceSoft px-4 py-2.5 text-[13px] font-semibold text-abnb-ink transition-colors hover:bg-abnb-hairlineSoft/35 disabled:opacity-60"
                      >
                        <User className="h-4 w-4" />
                        Đây là tôi
                      </button>
                    ) : null}
                    {selected.linked_profile_id === user?.id ? (
                      <button
                        type="button"
                        disabled={linkBusyId !== null}
                        onClick={() => void unlinkMember(selected.id)}
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
            )}
          </div>
        </aside>
      </div>

      <AddMemberModal
        key={addModalKey}
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        treeId={treeId}
        members={members}
        generations={generations}
        canDirectAdd={canEditMembers}
        myLinkedMemberId={myLinkedMemberId}
        supportsMemberPhoneColumn={supportsMemberPhoneColumn}
        onSaved={() => {
          void loadMembers()
        }}
      />
    </div>
  )
}
