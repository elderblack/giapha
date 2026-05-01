import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Network, Users } from 'lucide-react'
import { role } from '../design/roles'
import { AppProductTour } from './AppProductTour'
import { useTreeWorkspace } from './tree/treeWorkspaceContext'
import { TreePageIntro } from './tree/TreeChrome'
import { TreeOverviewSkeleton } from './tree/TreeTabSkeletons'
import { TreeAppBrandEditor } from './tree/TreeAppBrandEditor'

export function TreeOverviewPage() {
  const { tree, treeId, members } = useTreeWorkspace()
  if (!tree) return null
  if (members === null) return <TreeOverviewSkeleton />

  const base = `/app/trees/${treeId}`
  const memberCount = members.length

  const statTile = (label: string, value: string | number) => (
    <div className="rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-canvas/70 px-4 py-4 shadow-abnb-inner">
      <p className={role.statLabel}>{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-abnb-ink">{value}</p>
    </div>
  )

  const shortcut = (
    to: string,
    label: string,
    hint: string,
    Icon: typeof Network,
  ) => (
    <Link
      to={to}
      className={`${role.card} group flex items-start gap-4 !p-5 no-underline transition-all hover:border-abnb-primary/25`}
    >
      <span className={role.iconTile}>
        <Icon className="h-5 w-5 transition-transform group-hover:scale-105" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold text-abnb-ink">{label}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-abnb-muted transition-transform group-hover:translate-x-0.5 group-hover:text-abnb-primary" />
        </span>
        <span className={`${role.bodySm} mt-1 block text-abnb-muted`}>{hint}</span>
      </span>
    </Link>
  )

  return (
    <div className="space-y-10">
      <AppProductTour />

      <TreePageIntro kicker="Tổng quan" title="Giới thiệu dòng họ">
        Lưu trữ gốc tích, kết nối người trong một không gian rõ ràng — <strong>bản tin</strong> nằm tại mục{' '}
        <strong>Trang nhà</strong> trên thanh điều hướng; các tab bên dưới là phả hệ và thành viên.
      </TreePageIntro>

      <div className="grid gap-3 sm:grid-cols-3">
        {statTile('Thành viên', memberCount)}
        {statTile('Quê / gốc', tree.origin_place?.trim() || '—')}
        {statTile('Chi / nhánh', tree.clan_name?.trim() || '—')}
      </div>

      <TreeAppBrandEditor />

      <div className={`${role.cardElevated} rounded-abnb-xl border border-abnb-hairlineSoft/90 !p-6 sm:!p-8`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className={role.iconTile}>
              <BookOpen className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className={`${role.headingModule} text-base`}>Câu chuyện dòng họ</h3>
              {tree.description ? (
                <p className={`${role.bodyMd} mt-3 text-abnb-body`}>{tree.description}</p>
              ) : (
                <p className={`${role.bodySm} mt-3 text-abnb-muted`}>
                  Chưa có mô tả — chủ dòng hoặc biên tập có thể bổ sung ở phần quản lý sau (hoặc qua cập nhật tương
                  lai).
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className={`${role.caption} mb-4 text-abnb-muted`}>Tiếp theo</p>
        <div className="grid gap-4 md:grid-cols-2">
          {shortcut(`${base}/chart`, 'Xem phả hệ', 'Thu phóng, kéo khung, chọn từng người để xem quan hệ.', Network)}
          {shortcut(`${base}/members`, 'Danh sách thành viên', 'Sửa quan hệ, liên kết tài khoản, duyệt đề xuất.', Users)}
        </div>
      </div>
    </div>
  )
}
