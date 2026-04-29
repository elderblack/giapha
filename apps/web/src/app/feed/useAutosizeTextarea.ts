import { useLayoutEffect, type RefObject } from 'react'

type Opts = { minRows: number; maxRows: number }

/** Tự chỉnh chiều cao theo nội dung; sau maxRows cuộn bên trong textarea. */
export function useAutosizeTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string, opts: Opts) {
  const { minRows, maxRows } = opts

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const cs = getComputedStyle(el)
    const lineHeight = parseFloat(cs.lineHeight)
    const lh = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 22
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)

    el.style.height = '0px'
    const scrollH = el.scrollHeight
    const minH = lh * minRows + padY
    const maxH = lh * maxRows + padY
    const next = Math.min(Math.max(scrollH, minH), maxH)
    el.style.height = `${next}px`
    el.style.overflowY = scrollH > maxH ? 'auto' : 'hidden'
  }, [value, ref, minRows, maxRows])
}
