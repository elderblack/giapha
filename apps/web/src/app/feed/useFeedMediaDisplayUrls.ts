import { useEffect, useMemo, useState } from 'react'

import { getFamilyFeedMediaDisplayUrl } from './feedMediaDisplayUrl'

/** Map storage_path → URL có quyền đọc (signed / public fallback). */
export function useFeedMediaDisplayUrls(items: readonly { storage_path: string }[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({})

  const sig = useMemo(() => {
    const paths = items.map((it) => it.storage_path.trim()).filter(Boolean)
    return [...new Set(paths)].sort().join('\0')
  }, [items])

  useEffect(() => {
    let cancel = false
    const paths = [...new Set(sig.split('\0').filter(Boolean))]
    if (!paths.length) {
      setMap({})
      return
    }

    void (async () => {
      const next: Record<string, string> = {}
      await Promise.all(
        paths.map(async (storage_path) => {
          const u = await getFamilyFeedMediaDisplayUrl(storage_path)
          if (u) next[storage_path] = u
        }),
      )
      if (!cancel) setMap(next)
    })()

    return () => {
      cancel = true
    }
  }, [sig])

  return map
}
