import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { usePlatformAdmin } from '../hooks/usePlatformAdmin'

export function RequirePlatformAdmin({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin } = usePlatformAdmin()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-abnb-muted">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" aria-hidden />
        <p className="text-sm font-medium">Đang kiểm tra quyền…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/app/home" replace />
  }

  return <>{children}</>
}
