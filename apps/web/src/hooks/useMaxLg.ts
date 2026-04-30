import { useEffect, useState } from 'react'

/** true khi viewport &lt; breakpoint `lg` (1024px), giống Tailwind `max-lg` */
export function useMaxLg(): boolean {
  const query = '(max-width: 1023px)'
  const [maxLg, setMaxLg] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMaxLg(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return maxLg
}
