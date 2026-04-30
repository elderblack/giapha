import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
  titleId: string
  children: React.ReactNode
}

/**
 * Dialog chi tiết thành viên — mobile/tablet (gọi từ TreeChartPage khi max-lg).
 * z-index &lt; AddMemberModal để form thêm người vẫn nổi trên.
 */
export function TreeMemberDetailModal({ open, onClose, titleId, children }: Props) {
  const prevOverflow = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return
    prevOverflow.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow.current ?? ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/45 p-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[min(88dvh,720px)] w-full max-w-lg overflow-y-auto overscroll-y-contain rounded-t-[1.25rem] bg-abnb-surfaceCard shadow-2xl ring-1 ring-black/10 [-webkit-overflow-scrolling:touch] sm:max-h-[min(90vh,720px)] sm:rounded-abnb-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-end border-b border-abnb-hairlineSoft/80 bg-abnb-surfaceCard px-3 py-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-abnb-muted transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-ink"
            aria-label="Đóng"
            onClick={onClose}
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
