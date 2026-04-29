import { useSyncExternalStore } from 'react'

let mqFine: MediaQueryList | null = null

function getMqFine(): MediaQueryList | null {
  if (typeof window === 'undefined') return null
  if (!mqFine) mqFine = window.matchMedia('(pointer: fine)')
  return mqFine
}

function subscribe(cb: () => void): () => void {
  const mq = getMqFine()
  if (!mq) return () => {}
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function getSnapshot(): boolean {
  return getMqFine()?.matches ?? true
}

function getServerSnapshot(): boolean {
  return true
}

/** Một subscription `matchMedia` cho cả app — tránh listener trùng trên mỗi thẻ bài. */
export function usePointerFine(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
