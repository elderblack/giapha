import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-abnb-canvas text-abnb-muted">
        <p className="text-sm font-medium">Đang tải…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/app/login" replace state={{ from: loc.pathname + loc.search }} />
  }

  return <>{children}</>
}
