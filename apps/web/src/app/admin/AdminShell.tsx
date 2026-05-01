import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { role } from '../../design/roles'

/** Giao diện quản trị tách biệt: không chat, không chuông, không nav ứng dụng người dùng. */
export function AdminShell() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const pill = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-[14px] font-semibold transition-colors sm:text-[15px] ${
      isActive
        ? 'bg-abnb-primary text-abnb-onPrimary shadow-sm'
        : 'text-abnb-body hover:bg-abnb-surfaceSoft'
    }`

  async function onSignOut() {
    await signOut()
    navigate('/app/login', { replace: true })
  }

  return (
    <div className={`${role.appShellBg} admin-mode`}>
      <header className={`${role.topNav} border-l-[4px] border-l-amber-500/90`}>
        <div className="lp-container grid max-w-abnb grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 py-3 sm:h-16 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-y-0 sm:py-2">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-abnb-md bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/35 dark:text-amber-200">
              <LayoutDashboard className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold tracking-tight text-abnb-ink sm:text-[17px]">Quản trị</p>
              <p className="truncate text-[11px] font-medium uppercase tracking-wider text-abnb-muted">
                Gian nội bộ — không phải giao diện thành viên
              </p>
            </div>
          </div>

          <div className="col-start-2 row-start-1 shrink-0 self-center justify-self-end sm:col-start-3">
            <button
              type="button"
              onClick={() => void onSignOut()}
              className={`${role.btnPrimary} !inline-flex !h-10 !min-h-0 !items-center !px-4 !py-0 !text-[13px] sm:!h-11 sm:!px-6 sm:!text-sm`}
            >
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                Đăng xuất
              </span>
            </button>
          </div>

          <nav
            className="col-span-2 row-start-2 flex justify-center pt-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-self-center sm:pt-0"
            aria-label="Quản trị"
          >
            <div className="inline-flex items-center rounded-full bg-abnb-surfaceSoft/95 p-1 ring-1 ring-abnb-hairlineSoft">
              <NavLink to="/app/admin" end className={pill}>
                Tổng quan
              </NavLink>
            </div>
          </nav>
        </div>
      </header>

      <main className="lp-container max-w-abnb pb-14 pt-5 md:pb-16 md:pt-7">
        <Outlet />
      </main>
    </div>
  )
}
