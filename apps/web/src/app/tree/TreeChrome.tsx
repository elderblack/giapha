import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutGrid, Network, Users } from 'lucide-react'
import { role } from '../../design/roles'

const subNavTabs = [
  { segment: 'overview', label: 'Trang chủ', Icon: LayoutGrid, end: true as boolean },
  { segment: 'chart', label: 'Phả hệ', Icon: Network, end: false as boolean },
  { segment: 'members', label: 'Thành viên', Icon: Users, end: false as boolean },
]

function subNavCls({ isActive }: { isActive: boolean }) {
  return `flex shrink-0 snap-start items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-all sm:text-[14px] ${
    isActive
      ? 'bg-abnb-canvas text-abnb-ink shadow-abnb ring-1 ring-abnb-hairlineSoft/90'
      : 'text-abnb-muted hover:bg-abnb-surfaceSoft/90 hover:text-abnb-ink'
  }`
}

export function TreeSubNav({ base }: { base: string }) {
  return (
    <nav
      className="flex snap-x snap-mandatory items-center gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Màn hình dòng họ"
    >
      {subNavTabs.map(({ segment, label, Icon, end }) => (
        <NavLink key={segment} to={segment === 'overview' ? `${base}/overview` : `${base}/${segment}`} end={end} className={subNavCls}>
          <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function TreeRoleChip({
  variant,
}: {
  variant: 'owner' | 'editor' | 'member'
}) {
  const map = {
    owner: {
      label: 'Chủ dòng',
      className: 'bg-abnb-primary/12 text-abnb-primary ring-abnb-primary/25',
    },
    editor: {
      label: 'Biên tập',
      className: 'bg-abnb-luxe/14 text-abnb-ink ring-abnb-hairlineSoft/80',
    },
    member: {
      label: 'Thành viên',
      className: 'bg-abnb-surfaceStrong text-abnb-muted ring-abnb-hairlineSoft/70',
    },
  } as const
  const x = map[variant]
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${x.className}`}
    >
      {x.label}
    </span>
  )
}

export function TreePageIntro({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8">
      <p className={role.kicker}>{kicker}</p>
      <h2 className="mt-2 text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-abnb-ink sm:text-2xl sm:leading-tight">
        {title}
      </h2>
      {children ? <div className={`${role.bodySm} mt-3 max-w-2xl text-abnb-body`}>{children}</div> : null}
    </header>
  )
}
