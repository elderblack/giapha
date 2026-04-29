import { X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { role } from '../design/roles'

const STORAGE_KEY = 'giapha-product-tour-dismissed-v1'

export function AppProductTour() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(STORAGE_KEY) !== '1'
    } catch {
      return true
    }
  })

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <aside
      className={`${role.card} relative mb-8 rounded-abnb-xl border border-abnb-primary/20 bg-gradient-to-br from-abnb-primary/[0.06] to-abnb-luxe/[0.04] !p-5 sm:!p-6`}
      aria-labelledby="app-tour-title"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1.5 text-abnb-muted transition-colors hover:bg-abnb-canvas hover:text-abnb-ink"
        aria-label="Đóng hướng dẫn"
      >
        <X className="h-4 w-4" />
      </button>
      <p className={`${role.caption} font-semibold uppercase tracking-wide text-abnb-primary`}>Bắt đầu</p>
      <h2 id="app-tour-title" className={`${role.headingModule} mt-1 text-lg text-abnb-ink`}>
        Làm quen GiaPhả
      </h2>
      <ol className={`${role.bodySm} mt-4 list-decimal space-y-2 pl-5 text-abnb-body`}>
        <li>
          Vào <strong>Dòng họ</strong> để tạo hoặc mở phả — xem <strong>Tổng quan</strong>, <strong>Phả hệ</strong>,{' '}
          <strong>Thành viên</strong>.
        </li>
        <li>Thêm người, gắn cha mẹ / vợ chồng; dùng sơ đồ để xem cả nhánh.</li>
        <li>
          Chọn <strong>Hồ sơ</strong> để cập nhật ảnh bìa và thông tin hiển thị; liên kết tài khoản với một node trên cây
          nếu được mời.
        </li>
      </ol>
      <button
        type="button"
        onClick={dismiss}
        className={`${role.btnPrimary} mt-5 !h-10 !rounded-full !px-5 text-sm`}
      >
        Đã hiểu, ẩn gợi ý này
      </button>
    </aside>
  )
}
