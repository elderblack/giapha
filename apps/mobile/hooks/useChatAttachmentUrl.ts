import { useEffect, useState } from 'react'

import { getFamilyChatMediaDisplayUrl } from '@/lib/chat/chatMediaDisplayUrl'

export function useChatAttachmentUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const p = path?.trim()
    if (!p) {
      setUrl(null)
      return
    }
    let cancel = false
    void getFamilyChatMediaDisplayUrl(p).then((u) => {
      if (!cancel) setUrl(u)
    })
    return () => {
      cancel = true
    }
  }, [path])

  return url
}
