import { Link, Outlet } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { getSupabase } from '../lib/supabase'
import { role } from '../design/roles'
import { TreeWorkspaceProvider } from './tree/TreeWorkspaceProvider'
import { useTreeWorkspace } from './tree/treeWorkspaceContext'
import { TreeRoleChip, TreeSubNav } from './tree/TreeChrome'

function TreeDetailShell() {
  const { tree, treeId, treeLoadErr, isOwner, myTreeRole } = useTreeWorkspace()
  const sb = getSupabase()

  if (!sb) {
    return <p className="text-sm text-abnb-error">Không kết nối được. Vui lòng thử lại sau.</p>
  }

  if (tree === undefined) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
        <p className={role.caption}>Đang mở dòng họ…</p>
      </div>
    )
  }

  if (!tree) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <div className={`${role.cardQuiet} rounded-abnb-xl border border-abnb-error/20 bg-abnb-error/[0.04] p-8`}>
          <p className="text-abnb-error">{treeLoadErr ?? 'Không tìm thấy dòng họ hoặc bạn chưa được phép xem.'}</p>
        </div>
        <Link
          to="/app/trees"
          className={`${role.bodySm} mt-6 inline-flex items-center gap-2 font-semibold text-abnb-primary no-underline hover:underline`}
        >
          <ChevronLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>
      </div>
    )
  }

  const base = `/app/trees/${treeId}`
  const roleVariant = isOwner ? 'owner' : myTreeRole === 'editor' ? 'editor' : 'member'

  return (
    <div className="mt-4 w-full max-w-6xl sm:mt-6 md:mx-auto">
      <section className="relative overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft/90 bg-abnb-surfaceCard shadow-abnb">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(900px 280px at 15% -10%, rgba(255, 113, 113, 0.08), transparent 55%), radial-gradient(700px 240px at 95% 15%, rgba(116, 98, 255, 0.07), transparent 50%)',
          }}
        />
        <div className="relative px-5 pb-6 pt-5 sm:px-8 sm:pb-7 sm:pt-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className={role.kicker}>Không gian dòng họ</p>
              <h1 className={`${role.headingSection} mt-1 max-w-[20ch] text-balance sm:max-w-none`}>{tree.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <TreeRoleChip variant={roleVariant} />
                {tree.clan_name ? (
                  <span className="inline-flex items-center rounded-full bg-abnb-canvas/85 px-3 py-1 text-[12px] font-medium text-abnb-muted ring-1 ring-abnb-hairlineSoft/70">
                    Chi: {tree.clan_name}
                  </span>
                ) : null}
              </div>
            </div>
            <p className={`${role.bodySm} w-full max-w-none shrink-0 leading-relaxed text-abnb-muted lg:max-w-md lg:text-right`}>
              Bản tin và tổng quan ngay trang chủ dòng họ — phả hệ và thành viên trong các tab tiếp theo.
            </p>
          </div>
        </div>

        <div className="relative border-t border-abnb-hairlineSoft/80 bg-abnb-canvas/65 px-4 py-2.5 backdrop-blur-md sm:px-6">
          <TreeSubNav base={base} />
        </div>
      </section>

      <div className="mt-6 pb-10 sm:mt-8 sm:pb-12">
        <Outlet />
      </div>
    </div>
  )
}

export function TreeDetailLayout() {
  return (
    <TreeWorkspaceProvider>
      <TreeDetailShell />
    </TreeWorkspaceProvider>
  )
}
