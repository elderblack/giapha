import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Loader2,
  MapPin,
  Network,
  Newspaper,
  Sparkles,
  Trees,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { getSupabase } from '../lib/supabase'
import { role } from '../design/roles'
import { TreeFeedPage } from './feed/TreeFeedPage'
import { TreeWorkspaceProvider } from './tree/TreeWorkspaceProvider'
import { useTreeWorkspace } from './tree/treeWorkspaceContext'
import { TreeRoleChip } from './tree/TreeChrome'

export function AppHome() {
  const { user } = useAuth()
  const sb = getSupabase()
  const [searchParams] = useSearchParams()
  const treeFromQuery = searchParams.get('tree')?.trim() ?? ''

  /** `undefined` = đang tải, `null` = chưa có dòng họ, UUID = có cây */
  const [homeTreeId, setHomeTreeId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!sb || !user?.id) {
      setHomeTreeId(user ? null : undefined)
      return
    }
    let cancelled = false
    void sb
      .from('family_tree_roles')
      .select('family_tree_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setHomeTreeId(((data as { family_tree_id: string } | null)?.family_tree_id) ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [sb, user?.id])

  const displayName =
    typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
      ? (user.user_metadata.full_name as string).trim()
      : null

  /** Mở đúng dòng họ từ thông báo (`?tree=`) nếu có. */
  const workspaceTreeId =
    homeTreeId === undefined ? undefined : treeFromQuery.length > 0 ? treeFromQuery : homeTreeId

  return (
    <div className="mx-auto w-full max-w-6xl">
      {homeTreeId === undefined ? (
        <div className={`${role.cardQuiet} mt-8 flex items-center justify-center gap-3 rounded-abnb-xl border border-abnb-hairlineSoft/85 py-16`}>
          <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
          <span className={role.caption}>Đang mở Trang nhà…</span>
        </div>
      ) : null}

      {homeTreeId === null ? (
        <section className="mt-10 flex flex-col items-center text-center">
          <EmptyNoTree />
        </section>
      ) : null}

      {workspaceTreeId !== undefined && workspaceTreeId !== null ? (
        <TreeWorkspaceProvider treeId={workspaceTreeId}>
          <HomeSocialLayout displayName={displayName} />
        </TreeWorkspaceProvider>
      ) : null}
    </div>
  )
}

function EmptyNoTree() {
  return (
    <>
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-abnb-2xl border border-abnb-hairlineSoft/90 bg-gradient-to-br from-abnb-primary/[0.09] via-abnb-canvas to-abnb-luxe/[0.06] px-5 py-10 shadow-abnb sm:px-8 sm:py-12"
        style={{
          backgroundImage:
            'radial-gradient(640px 200px at 10% -20%, rgba(255, 113, 113, 0.12), transparent 55%), radial-gradient(480px 180px at 95% 0%, rgba(116, 98, 255, 0.08), transparent 50%)',
        }}
      >
        <Sparkles className="mx-auto h-10 w-10 text-abnb-primary/90" strokeWidth={1.5} />
        <h1 className={`${role.headingSection} mx-auto mt-5 max-w-md text-center text-[1.5rem] sm:text-[1.65rem]`}>
          Gia tộc bắt đầu khi có dòng họ
        </h1>
        <p className={`${role.bodyMd} mx-auto mt-4 max-w-md text-abnb-body`}>
          Tham gia hoặc tạo một dòng họ — sau đó bản tin giữ liên kết các thế hệ tại một nơi, chỉ trong phạm vi họ
          hàng bạn được mời.
        </p>
        <Link
          to="/app/trees"
          className={`${role.btnPrimary} mx-auto mt-8 !inline-flex min-h-[3rem] !rounded-full !px-8 text-[15px]`}
        >
          Tới dòng họ
        </Link>
      </div>
      <FooterMiniLinks />
    </>
  )
}

function HomeSocialLayout({ displayName }: { displayName: string | null }) {
  const { user } = useAuth()
  const { tree, treeId, treeLoadErr, members, isOwner, myTreeRole } = useTreeWorkspace()

  const greeting =
    displayName ??
    (typeof user?.user_metadata?.full_name === 'string' ? (user.user_metadata.full_name as string) : null) ??
    'bạn'

  const memberCount = members?.length ?? null
  const roleVariant = isOwner ? 'owner' : myTreeRole === 'editor' ? 'editor' : myTreeRole === 'member' ? 'member' : 'member'
  const base = `/app/trees/${treeId}`

  if (tree === undefined) {
    return (
      <div className={`${role.cardQuiet} mt-10 flex items-center justify-center gap-3 rounded-abnb-xl border py-20`}>
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
        <span className={role.caption}>Đang tải không gian dòng họ…</span>
      </div>
    )
  }

  if (!tree || treeLoadErr) {
    return (
      <p className={`${role.bodySm} mt-10 text-abnb-error`}>{treeLoadErr ?? 'Không tải được dòng họ.'}</p>
    )
  }

  return (
    <>
      <section className="mt-8">
        <div
          className="relative overflow-hidden rounded-abnb-2xl border border-abnb-hairlineSoft/90 bg-abnb-surfaceCard shadow-abnb"
          style={{
            backgroundImage:
              'radial-gradient(900px 240px at 12% -15%, rgba(255, 113, 113, 0.1), transparent 55%), radial-gradient(700px 200px at 92% 8%, rgba(116, 98, 255, 0.07), transparent 48%)',
          }}
        >
          <div className="relative px-5 py-6 sm:px-10 sm:py-10">
            <p className={role.kicker}>Bản tin dòng họ · Trang nhà</p>
            <h1 className={`${role.headingSection} mt-2 max-w-2xl text-[1.65rem] leading-tight sm:text-[1.85rem]`}>
              Xin chào, <span className="text-abnb-ink">{greeting}</span>
            </h1>
            <p className={`${role.bodyMd} mt-4 max-w-2xl text-abnb-body`}>
              Chia sẻ tin, ảnh và kỷ niệm với người trong cùng dòng họ — chỉ thành viên mới thấy bản tin bên dưới.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-[15px] font-semibold tracking-tight text-abnb-ink">{tree.name}</span>
              <TreeRoleChip variant={roleVariant} />
              {tree.clan_name ? (
                <span className="inline-flex items-center rounded-full bg-abnb-canvas/90 px-3 py-1 text-[12px] font-medium text-abnb-muted ring-1 ring-abnb-hairlineSoft/80">
                  Chi: {tree.clan_name}
                </span>
              ) : null}
            </div>

            {tree.origin_place ? (
              <p className={`${role.bodySm} mt-4 inline-flex items-center gap-2 text-abnb-muted`}>
                <MapPin className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
                Gốc / quê: {tree.origin_place}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-8 sm:mt-10 lg:flex-row lg:items-start lg:gap-12">
        <section
          className="order-2 min-w-0 flex-1 overflow-x-clip lg:order-1"
          aria-label="Bản tin họ hàng"
        >
          <header className="mb-6 flex flex-col gap-1 border-b border-abnb-hairlineSoft/80 pb-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-5">
            <div>
              <h2 className={`${role.headingModule} text-[1.125rem]`}>Bản tin dòng họ</h2>
              <p className={`${role.caption} mt-1 normal-case text-abnb-muted`}>
                Theo thời gian — mới nhất trước
              </p>
            </div>
          </header>
          <TreeFeedPage embedOnHome />
        </section>

        <aside
          className="order-1 flex w-full max-w-full shrink-0 flex-col gap-4 sm:gap-5 lg:order-2 lg:sticky lg:top-24 lg:w-[min(100%,18rem)] lg:self-start"
          aria-label="Lối tắt và không gian dòng họ"
        >
          <div className={`${role.cardQuiet} rounded-abnb-xl border border-abnb-hairlineSoft/90 p-4 shadow-abnb-inner sm:p-5`}>
            <p className={`${role.statLabel}`}>Không gian của bạn</p>
            <p className="mt-3 text-[14px] font-semibold leading-snug text-abnb-ink">{tree.name}</p>
            {memberCount !== null ? (
              <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
                <strong className="font-semibold text-abnb-ink tabular-nums">{memberCount}</strong> người trong danh mục
                phả hệ
              </p>
            ) : (
              <p className={`${role.bodySm} mt-2 text-abnb-muted`}>Đang đếm thành viên…</p>
            )}
            <Link
              to={`${base}/overview`}
              className={`${role.btnPrimary} mt-5 !flex w-full min-h-[2.75rem] items-center justify-center !rounded-full !text-[14px]`}
            >
              Trang chủ dòng họ
            </Link>
          </div>

          <nav className={`${role.cardQuiet} flex flex-col gap-0.5 rounded-abnb-xl border border-abnb-hairlineSoft/90 p-2 shadow-abnb-inner`} aria-label="Đi nhanh">
            <QuickLinkRow to="/app/profile" Icon={UserRound} label="Hồ sơ cá nhân" hint="Ảnh, tiểu sử" />
            <QuickLinkRow to={`${base}/chart`} Icon={Network} label="Phả hệ tương tác" hint="Sơ đồ quan hệ" />
            <QuickLinkRow to={`${base}/members`} Icon={Users} label="Thành viên" hint="Danh sách, liên kết" />
            <QuickLinkRow to="/app/connections" Icon={Users} label="Kết nối" hint="Bạn bè, theo dõi" />
            <QuickLinkRow to="/app/trees" Icon={Trees} label="Dòng họ & mã mời" hint="Không gian dòng họ" />
          </nav>

          <p className={`${role.statLabel} px-1 text-center`}>Gợi ý · mời thêm họ hàng vào GiaPhả để bàn luận tại nhà.</p>
        </aside>
      </div>

      <FooterMiniLinks />
    </>
  )
}

function QuickLinkRow({
  to,
  Icon,
  label,
  hint,
}: {
  to: string
  Icon: typeof UserRound
  label: string
  hint: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-abnb-lg px-3 py-2.5 no-underline transition-colors hover:bg-abnb-surfaceSoft/95"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-abnb-md bg-gradient-to-br from-abnb-primary/[0.11] to-abnb-luxe/[0.06] text-abnb-primary ring-1 ring-abnb-hairlineSoft/75">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-semibold text-abnb-ink">{label}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-abnb-muted transition-transform group-hover:translate-x-0.5 group-hover:text-abnb-primary" />
        </span>
        <span className={`${role.caption} mt-0.5 block normal-case text-abnb-muted`}>{hint}</span>
      </span>
    </Link>
  )
}

function FooterMiniLinks() {
  return (
    <footer className={`${role.caption} mt-10 border-t border-abnb-hairlineSoft/70 pt-8 text-center text-abnb-muted sm:mt-14`}>
      <span className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5">
          <Newspaper className="h-3.5 w-3.5 opacity-70" strokeWidth={2} aria-hidden />
          Bản tin chỉ trong phạm vi dòng họ bạn thuộc về
        </span>
      </span>
    </footer>
  )
}
