import { Link, NavLink, Outlet } from 'react-router-dom'
import { LogOut, Settings, TreePine, Users, UserRound } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { useAuth } from '../auth/useAuth'
import { role } from '../design/roles'

export function AppShell() {
  const { signOut } = useAuth()

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors sm:text-[15px] sm:px-4 ${
      isActive
        ? 'bg-abnb-canvas text-abnb-ink shadow-abnb'
        : 'text-abnb-body hover:bg-abnb-canvas/60 hover:text-abnb-ink'
    }`

  return (
    <div className={role.appShellBg}>
      <header className={`${role.topNav} sticky top-0 z-40`}>
        <div className="lp-container flex h-16 max-w-abnb items-center justify-between gap-3 sm:gap-4">
          <Link
            to="/app/home"
            className="flex shrink-0 items-center gap-2.5 text-abnb-ink no-underline transition-opacity hover:opacity-90"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-abnb-md bg-gradient-to-br from-abnb-primary/[0.15] to-abnb-luxe/[0.08] text-abnb-primary shadow-abnb-inner ring-1 ring-abnb-hairlineSoft">
              <TreePine className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
            </span>
            <span className="text-[17px] font-semibold tracking-tight sm:text-[18px]">GiaPhả</span>
          </Link>
          <nav className={`${role.appNavTrack} mx-2 min-w-0 flex-1 justify-center sm:mx-0 sm:flex-initial`} aria-label="Ứng dụng">
            <NavLink to="/app/home" className={navCls}>
              Trang nhà
            </NavLink>
            <NavLink to="/app/trees" className={navCls}>
              Dòng họ
            </NavLink>
            <NavLink to="/app/connections" className={navCls}>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 opacity-90" strokeWidth={2} />
                Kết nối
              </span>
            </NavLink>
            <NavLink to="/app/profile" end className={navCls}>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4 opacity-90" strokeWidth={2} />
                Hồ sơ
              </span>
            </NavLink>
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationBell />
            <details className="group relative shrink-0">
              <summary
                className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-abnb-hairlineSoft bg-abnb-canvas text-abnb-ink shadow-abnb-inner transition-colors hover:border-abnb-hairline hover:bg-abnb-surfaceSoft [&::-webkit-details-marker]:hidden"
                aria-label="Cài đặt và đăng xuất"
              >
                <Settings className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </summary>
              <div
                className="absolute right-0 top-full z-[100] mt-2 min-w-[13.5rem] overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard py-1.5 text-left shadow-abnb"
                role="menu"
              >
                <Link
                  to="/app/profile"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-abnb-ink no-underline transition-colors hover:bg-abnb-surfaceSoft"
                  role="menuitem"
                  onClick={(e) => {
                    ;(e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open')
                  }}
                >
                  <UserRound className="h-4 w-4 shrink-0 text-abnb-muted" strokeWidth={2} aria-hidden />
                  Xem hồ sơ
                </Link>
                <Link
                  to="/app/profile/settings"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-abnb-ink no-underline transition-colors hover:bg-abnb-surfaceSoft"
                  role="menuitem"
                  onClick={(e) => {
                    ;(e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open')
                  }}
                >
                  <Settings className="h-4 w-4 shrink-0 text-abnb-muted" strokeWidth={2} aria-hidden />
                  Cài đặt tài khoản
                </Link>
                <div className="my-1 h-px bg-abnb-hairlineSoft/85" aria-hidden />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void signOut()}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] font-semibold text-abnb-muted transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-error"
                >
                  <LogOut className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                  Đăng xuất
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className={`lp-container max-w-abnb ${role.appMain}`}>
        <Outlet />
      </main>
    </div>
  )
}
