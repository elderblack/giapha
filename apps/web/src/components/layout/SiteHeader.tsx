import { Link } from 'react-router-dom'
import { role } from '../../design/roles'
import { APP_DISPLAY_NAME, APP_LOGO_URL } from '../../lib/appHeaderBrandEvents'

const nav = [
  { href: '/roadmap', label: 'Lộ trình', route: true as const },
  { href: '#features', label: 'Tính năng', route: false as const },
  { href: '#how', label: 'Cách dùng', route: false as const },
  { href: '#pricing', label: 'Bảng giá', route: false as const },
  { href: '#waitlist', label: 'Đăng ký sớm', route: false as const },
]

export function SiteHeader() {
  return (
    <header className={`${role.topNav} sticky top-0 z-50`}>
      <div className="lp-container flex h-[4.5rem] max-w-abnb items-center justify-between gap-4">
        <Link
          to="/"
          className="group flex items-center gap-2.5 text-abnb-ink no-underline"
        >
          <span
            className="flex h-10 w-10 shrink-0 overflow-hidden rounded-abnb-md bg-abnb-canvas shadow-abnb-inner ring-1 ring-abnb-hairlineSoft transition-transform duration-200 group-hover:scale-[1.03]"
            aria-hidden
          >
            <img src={APP_LOGO_URL} alt="" className="h-full w-full object-cover object-center" />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em]">{APP_DISPLAY_NAME}</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
          {nav.map((item) =>
            item.route ? (
              <Link
                key={item.href}
                to={item.href}
                className="rounded-full px-3 py-2 text-[15px] font-medium text-abnb-body transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-ink"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-2 text-[15px] font-medium text-abnb-body transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-ink"
              >
                {item.label}
              </a>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/app/login"
            className="hidden rounded-full px-4 py-2 text-[15px] font-semibold text-abnb-ink transition-colors hover:bg-abnb-surfaceSoft sm:inline-flex"
          >
            Đăng nhập
          </Link>
          <Link
            to="/app/login"
            className={`${role.btnSecondary} !h-11 !rounded-full !px-5 !text-sm sm:!text-[15px]`}
          >
            Đăng ký
          </Link>
          <Link
            to="/app/login"
            className={`${role.btnPrimary} !h-11 !rounded-full !px-5 !text-sm lg:hidden`}
          >
            Dùng thử
          </Link>
        </div>
      </div>
    </header>
  )
}
