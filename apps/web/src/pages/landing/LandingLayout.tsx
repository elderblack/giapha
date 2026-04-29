import { Outlet } from 'react-router-dom'
import { role } from '../../design/roles'
import { SiteFooter } from '../../components/layout/SiteFooter'
import { SiteHeader } from '../../components/layout/SiteHeader'

export function LandingLayout() {
  return (
    <div className={`${role.pageCanvas} flex flex-col`}>
      <SiteHeader />
      <main className="flex-1 bg-abnb-canvas">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
