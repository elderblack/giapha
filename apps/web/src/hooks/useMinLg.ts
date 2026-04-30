import { useEffect, useState } from 'react'

/** true khi viewport ≥ `lg` (1024px), giống Tailwind `lg:` */
export function useMinLg(): boolean {
  const query = '(min-width: 1024px)'
  const [minLg, setMinLg] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMinLg(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return minLg
}
