import { Link, NavLink, Outlet } from 'react-router-dom'
import { Home, TreePine, Users, UserRound } from 'lucide-react'
import { ChatBadge } from './chat/ChatBadge'
import { FloatingMiniChat } from './chat/FloatingMiniChat'
import { HeaderProfileAvatar } from './HeaderProfileAvatar'
import { NotificationBell } from './NotificationBell'
import { role } from '../design/roles'
import { APP_LOGO_URL } from '../lib/appHeaderBrandEvents'
import { useAppHeaderBrand } from '../hooks/useAppHeaderBrand'

export function AppShell() {
  const { title, logoUrlWithBust } = useAppHeaderBrand()
  const navCls = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors sm:text-[15px] sm:px-4 ${
      isActive
        ? 'bg-abnb-canvas text-abnb-ink shadow-abnb'
        : 'text-abnb-body hover:bg-abnb-canvas/60 hover:text-abnb-ink'
    }`

  const bottomNavCls = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[2.75rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-abnb-lg px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors sm:text-[11px] ${
      isActive ? 'text-abnb-primary' : 'text-abnb-muted hover:text-abnb-ink'
    }`

  return (
    <div className={role.appShellBg}>
      <header className={`${role.topNav} sticky top-0 z-40`}>
        <div className="lp-container flex h-14 max-w-abnb items-center justify-between gap-2 sm:h-16 sm:gap-4">
          <Link
            to="/app"
            className="flex min-w-0 shrink-0 items-center gap-2 text-abnb-ink no-underline transition-opacity hover:opacity-90 sm:gap-2.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-abnb-md bg-gradient-to-br from-abnb-primary/[0.15] to-abnb-luxe/[0.08] text-abnb-primary shadow-abnb-inner ring-1 ring-abnb-hairlineSoft sm:h-10 sm:w-10">
              {logoUrlWithBust ? (
                <img
                  src={logoUrlWithBust}
                  alt=""
                  className="h-full w-full min-h-0 min-w-0 shrink-0 object-cover object-center"
                />
              ) : (
                <img src={APP_LOGO_URL} alt="" className="h-full w-full object-cover object-center" />
              )}
            </span>
            <span className="truncate text-[16px] font-semibold tracking-tight sm:text-[18px]">{title}</span>
          </Link>
          <nav
            className={`${role.appNavTrack} mx-1 hidden min-w-0 flex-1 justify-center md:mx-2 md:flex md:flex-initial`}
            aria-label="Ứng dụng"
          >
            <NavLink to="/app/trees" className={navCls}>
              Dòng họ
            </NavLink>
            <NavLink to="/app/home" className={navCls}>
              Trang nhà
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
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <ChatBadge />
            <NotificationBell />
            <HeaderProfileAvatar />
          </div>
        </div>
      </header>
      <main className="lp-container max-w-abnb pt-5 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pt-6 md:pb-20">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-abnb-hairlineSoft/90 bg-abnb-canvas/92 backdrop-blur-lg backdrop-saturate-150 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Điều hướng chính"
      >
        <div className="mx-auto flex max-w-abnb items-stretch justify-between gap-0.5 px-1 pt-1">
          <NavLink to="/app/trees" className={bottomNavCls}>
            <TreePine className="h-[1.35rem] w-[1.35rem] shrink-0 opacity-95" strokeWidth={2} aria-hidden />
            <span>Dòng họ</span>
          </NavLink>
          <NavLink to="/app/home" className={bottomNavCls} end>
            <Home className="h-[1.35rem] w-[1.35rem] shrink-0 opacity-95" strokeWidth={2} aria-hidden />
            <span>Trang nhà</span>
          </NavLink>
          <NavLink to="/app/connections" className={bottomNavCls}>
            <Users className="h-[1.35rem] w-[1.35rem] shrink-0 opacity-95" strokeWidth={2} aria-hidden />
            <span>Kết nối</span>
          </NavLink>
          <NavLink to="/app/profile" className={bottomNavCls} end>
            <UserRound className="h-[1.35rem] w-[1.35rem] shrink-0 opacity-95" strokeWidth={2} aria-hidden />
            <span>Hồ sơ</span>
          </NavLink>
        </div>
      </nav>
      <FloatingMiniChat />
    </div>
  )
}
