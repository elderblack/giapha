import { useEffect, useRef, useState } from 'react'

/**
 * Video bảng tin: tự phát khi cuộn vào viewport (ảnh trong khung đủ lớn), mặc định không tiếng
 * để đáp ứng chính sách autoplay của trình duyệt.
 */
export function FeedScrollVideo({
  src,
  posterUrl,
  className,
  onError,
  controls = true,
}: {
  src: string
  posterUrl?: string
  className?: string
  onError?: () => void
  controls?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [preloadMode, setPreloadMode] = useState<'none' | 'metadata'>('none')

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let cancelled = false
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function tryPlay() {
      if (!el || prefersReduced || cancelled) return
      void el.play().catch(() => {})
    }
    function tryPause() {
      if (!el || cancelled) return
      el.pause()
    }

    el.muted = true

    if (prefersReduced) {
      return () => {
        cancelled = true
      }
    }

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries[0]
        if (!hit) return
        if (hit.isIntersecting && hit.intersectionRatio >= 0.45) {
          setPreloadMode('metadata')
          tryPlay()
        } else {
          tryPause()
        }
      },
      {
        threshold: [0, 0.35, 0.55, 0.75],
        rootMargin: '0px 0px -8% 0px',
      },
    )
    obs.observe(el)
    return () => {
      cancelled = true
      obs.disconnect()
    }
  }, [src])

  return (
    <video
      ref={ref}
      src={src}
      poster={posterUrl}
      muted
      playsInline
      controls={controls}
      preload={preloadMode}
      className={className}
      onError={onError}
    />
  )
}
