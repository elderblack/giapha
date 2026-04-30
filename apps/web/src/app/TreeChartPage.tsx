import { useState } from 'react'
import { Link } from 'react-router-dom'
import { List, Move, Pointer, UserPlus } from 'lucide-react'
import { FamilyTreeChart } from '../components/FamilyTreeChart'
import { FamilyTreeHierarchyChart } from '../components/FamilyTreeHierarchyChart'
import { role } from '../design/roles'
import { useAuth } from '../auth/useAuth'
import { TreePageIntro } from './tree/TreeChrome'
import { treeAlertInfo } from './tree/treeUi'
import { TreeChartPanelSkeleton } from './tree/TreeTabSkeletons'
import { useTreeWorkspace } from './tree/treeWorkspaceContext'
import { describeKinship } from '../lib/kinshipVi'
import { AddMemberModal } from './tree/AddMemberModal'
import { useMaxLg } from '../hooks/useMaxLg'
import {
  MemberDetailFields,
  MemberDetailSummaryHeader,
} from './tree/TreeMemberDetailContent'
import { TreeMemberDetailModal } from './tree/TreeMemberDetailModal'

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
  const maxLg = useMaxLg()

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
    <div className="space-y-8">
      <TreePageIntro kicker="Phả hệ" title="Sơ đồ quan hệ">
        Dùng cử chỉ hoặc chuột để kéo khung vẽ; chọn một người để xem chi tiết — trên điện thoại và máy tính bảng mở trong cửa sổ; trên màn hình lớn thông tin nằm ở cột bên phải.
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
        <section className="min-w-0 scroll-mt-4">
          <div
            className={`${role.card} overflow-hidden !p-0 shadow-abnb-lg ring-1 ring-abnb-hairlineSoft/60`}
            style={{ minHeight: members === null ? 200 : 420 }}
          >
            {members === null ? (
              <TreeChartPanelSkeleton />
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
          className={`${role.card} !p-0 scroll-mt-20 hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:shadow-none`}
        >
          <div className="border-b border-abnb-hairlineSoft/80 bg-abnb-surfaceSoft/40 px-4 py-3 sm:px-5 sm:py-4">
            {!selected ? (
              <div>
                <p className="text-[13px] font-semibold text-abnb-ink">Thông tin nhanh</p>
                <p className={`${role.bodySm} mt-1 text-abnb-muted`}>Chọn một người trên đồ thị.</p>
              </div>
            ) : (
              <MemberDetailSummaryHeader
                selected={selected}
                gen={gen}
                myLinkedMemberId={myLinkedMemberId}
              />
            )}
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
              <MemberDetailFields
                variant="aside"
                selected={selected}
                members={members}
                kinship={kinship}
                userId={user?.id}
                canUseClaim={canUseClaim}
                myLinkedMemberId={myLinkedMemberId}
                linkBusyId={linkBusyId}
                onClaim={claimMember}
                onUnlink={unlinkMember}
                base={base}
              />
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
          void loadMembers({ force: true })
        }}
      />

      {selected && maxLg ? (
        <TreeMemberDetailModal
          open
          titleId="tree-member-detail-title"
          onClose={() => setSelectedId(null)}
        >
          <div className="border-b border-abnb-hairlineSoft/80 bg-abnb-surfaceSoft/40 px-4 pb-3 pt-1 sm:px-5">
            <MemberDetailSummaryHeader
              selected={selected}
              gen={gen}
              myLinkedMemberId={myLinkedMemberId}
              titleId="tree-member-detail-title"
            />
          </div>
          <MemberDetailFields
            selected={selected}
            members={members}
            kinship={kinship}
            userId={user?.id}
            canUseClaim={canUseClaim}
            myLinkedMemberId={myLinkedMemberId}
            linkBusyId={linkBusyId}
            onClaim={claimMember}
            onUnlink={unlinkMember}
            base={base}
          />
        </TreeMemberDetailModal>
      ) : null}
    </div>
  )
}
