import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** id cho tiêu đề dialog (accessibility) */
  titleId?: string
}

export function FeedComposerModal({ open, onClose, children, titleId }: Props) {
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
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex min-h-0 w-full max-w-xl max-h-[min(90dvh,880px)] flex-col overflow-hidden rounded-t-[1.25rem] bg-abnb-surfaceCard shadow-2xl ring-1 ring-black/10 sm:max-h-[min(92vh,880px)] sm:rounded-abnb-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
