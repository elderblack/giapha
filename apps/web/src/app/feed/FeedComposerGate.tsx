import { useCallback, useEffect, useId, useState } from 'react'
import type { FeedComposerTree } from './FeedComposer'
import { FeedComposer } from './FeedComposer'
import { FeedComposerCollapsed } from './FeedComposerCollapsed'
import { FeedComposerModal } from './FeedComposerModal'

import type { FeedPublishOnProgress } from './publishFeedPost'

type Props = {
  disabled?: boolean
  onPublish: (body: string, files: File[], onProgress?: FeedPublishOnProgress) => Promise<boolean>
  trees: FeedComposerTree[]
  selectedTreeId: string | null
  onSelectedTreeChange: (treeId: string) => void
  audienceMode: 'single' | 'choose'
}

/** Thanh thu gọn trên Feed; bấm hoặc icon mở modal giống Facebook. */
export function FeedComposerGate(props: Props) {
  const [open, setOpen] = useState(false)
  const [publishingModal, setPublishingModal] = useState(false)
  const titleId = useId()

  const onPublishingChange = useCallback((p: boolean) => {
    setPublishingModal(p)
  }, [])

  async function wrappedPublish(body: string, files: File[], onProgress?: FeedPublishOnProgress) {
    const ok = await props.onPublish(body, files, onProgress)
    if (ok) setOpen(false)
    return ok
  }

  const blocking =
    Boolean(props.disabled) || props.trees.length === 0 || props.selectedTreeId == null

  useEffect(() => {
    if (blocking && open) setOpen(false)
  }, [blocking, open])

  return (
    <>
      <FeedComposerCollapsed disabled={blocking} onOpen={() => setOpen(true)} />

      <FeedComposerModal
        open={open}
        preventClose={publishingModal}
        onClose={() => setOpen(false)}
        titleId={titleId}
      >
        <FeedComposer
          {...props}
          onPublish={wrappedPublish}
          onPublishingChange={onPublishingChange}
          embeddedInModal
          onDismiss={() => setOpen(false)}
          composerTitleId={titleId}
        />
      </FeedComposerModal>
    </>
  )
}
