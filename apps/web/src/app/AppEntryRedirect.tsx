import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getUserFamilyTreeId } from '../lib/familyTreeMembership'
import { getSupabase } from '../lib/supabase'
import { role } from '../design/roles'

/**
 * Điểm vào chính sau đăng nhập: ưu tiên không gian dòng họ (Tổng quan),
 * nếu chưa có thì tới luồng tham gia / tạo dòng họ.
 */
export function AppEntryRedirect() {
  const { user } = useAuth()
  const sb = getSupabase()
  const [path, setPath] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id || !sb) {
      const id = window.setTimeout(() => setPath('/app/trees'), 0)
      return () => window.clearTimeout(id)
    }
    let cancel = false
    void getUserFamilyTreeId(sb, user.id).then((treeId) => {
      if (cancel) return
      setPath(treeId ? `/app/trees/${treeId}/overview` : '/app/trees')
    })
    return () => {
      cancel = true
    }
  }, [user?.id, sb])

  if (!path) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
        <p className={role.caption}>Đang mở dòng họ…</p>
      </div>
    )
  }

  return <Navigate to={path} replace />
}
