import { useEffect, useId, useRef, useState } from 'react'
import {
  ChevronDown,
  Clapperboard,
  ImagePlus,
  UsersRound,
  X,
} from 'lucide-react'
import { role } from '../../design/roles'
import { FeedAttachmentGrid } from './FeedAttachmentGrid'
import type { FeedAttachmentItem } from './FeedAttachmentGrid'
import { fileKindForPreview } from './guessFeedMedia'
import { FeedComposerDraftArea } from './FeedComposerDraftArea'
import { useComposerProfile } from './useComposerProfile'

export type FeedComposerTree = { id: string; name: string }

type Props = {
  disabled?: boolean
  onPublish: (body: string, files: File[]) => Promise<boolean>
  trees: FeedComposerTree[]
  selectedTreeId: string | null
  onSelectedTreeChange: (treeId: string) => void
  audienceMode: 'single' | 'choose'
  /** Khi mở trong modal (FeedComposerGate): header có nút đóng. */
  embeddedInModal?: boolean
  onDismiss?: () => void
  composerTitleId?: string
}

const LS_KEY = 'giapha.profileComposerTreeId'

export function readStoredProfileTreeId(): string | null {
  try {
    const v = localStorage.getItem(LS_KEY)
    return v && v.length > 8 ? v : null
  } catch {
    return null
  }
}

export function writeStoredProfileTreeId(id: string) {
  try {
    localStorage.setItem(LS_KEY, id)
  } catch {
    /* ignore */
  }
}

type PreviewAttachment = FeedAttachmentItem & { file: File }

function previewKey(f: File, i: number) {
  return `${f.name}-${f.size}-${f.lastModified}-${i}`
}

function ComposerAvatar({
  url,
  label,
}: {
  url: string | null
  label: string
}) {
  const ch = label.trim()[0]?.toUpperCase() ?? '?'
  if (url) {
    return (
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-abnb-surfaceSoft ring-2 ring-white shadow-abnb">
        <img src={url} alt="" className="h-full w-full object-cover" />
      </span>
    )
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-abnb-primary/[0.2] to-abnb-luxe/[0.12] text-[15px] font-bold uppercase text-abnb-primary shadow-abnb ring-2 ring-white">
      {ch}
    </span>
  )
}

export function FeedComposer({
  disabled = false,
  onPublish,
  trees,
  selectedTreeId,
  onSelectedTreeChange,
  audienceMode,
  embeddedInModal = false,
  onDismiss,
  composerTitleId = 'giapha-feed-composer-title',
}: Props) {
  const baseId = useId()
  const { displayName, avatarUrl: profileAvatarUrl } = useComposerProfile()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<PreviewAttachment[]>([])
  const seqRef = useRef(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const blocked = disabled || trees.length === 0 || selectedTreeId == null
  const currentTreeName = trees.find((t) => t.id === selectedTreeId)?.name ?? ''

  const draftRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!embeddedInModal) return
    const id = requestAnimationFrame(() => draftRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [embeddedInModal])

  function appendIncoming(incoming: File[]) {
    if (!incoming.length) return
    setAttachments((prev) => {
      const next = [...prev]
      for (const f of incoming) {
        seqRef.current += 1
        const url = URL.createObjectURL(f)
        next.push({
          key: `p-${seqRef.current}-${previewKey(f, next.length)}`,
          url,
          kind: fileKindForPreview(f),
          file: f,
        })
      }
      return next
    })
  }

  function onPickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target
    const incoming = el.files?.length ? Array.from(el.files) : []
    el.value = ''
    appendIncoming(incoming)
  }

  function onPickVideos(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target
    const incoming = el.files?.length ? Array.from(el.files) : []
    el.value = ''
    appendIncoming(incoming)
  }

  async function submit() {
    if (blocked) return
    const files = attachments.map((a) => a.file)
    const ok = await onPublish(text, files)
    if (ok) {
      setText('')
      setAttachments((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url))
        return []
      })
      if (imageInputRef.current) imageInputRef.current.value = ''
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  function clearAllAttachments() {
    setAttachments((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url))
      return []
    })
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  const canPublish = !blocked && (text.trim().length > 0 || attachments.length > 0)

  const gridItems: FeedAttachmentItem[] = attachments.map(({ key, url, kind }) => ({ key, url, kind }))

  const audId = `${baseId}-aud`

  const shellClass = embeddedInModal
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden border-0 bg-abnb-surfaceCard shadow-none'
    : 'overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-abnb'

  const pad = 'px-4 sm:px-5'

  return (
    <div className={shellClass}>
      <div
        className={`flex items-center justify-center border-b border-abnb-hairlineSoft px-3 py-3 sm:px-5 ${
          embeddedInModal ? 'relative min-h-[3.25rem]' : ''
        }`}
      >
        {embeddedInModal && onDismiss ? (
          <>
            <div className="absolute left-2 top-1/2 z-[2] flex -translate-y-1/2 sm:left-3">
              <button
                type="button"
                onClick={() => onDismiss()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-abnb-muted transition hover:bg-abnb-surfaceSoft hover:text-abnb-ink"
                aria-label="Đóng"
              >
                <X className="h-6 w-6" strokeWidth={2} />
              </button>
            </div>
            <h2
              id={composerTitleId}
              className={`${role.headingSection} m-0 max-w-[min(100%-6rem,_20rem)] truncate text-center text-[1.0625rem] text-abnb-ink sm:text-[1.125rem]`}
            >
              Tạo bài viết
            </h2>
          </>
        ) : (
          <h2
            id={composerTitleId}
            className={`${role.headingSection} m-0 text-center text-[1.0625rem] sm:text-[1.125rem]`}
          >
            Tạo bài viết
          </h2>
        )}
      </div>

      {embeddedInModal ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3 [-webkit-overflow-scrolling:touch] ${pad} pt-4`}
          >
            <div className="flex gap-3">
              <ComposerAvatar url={profileAvatarUrl} label={displayName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold leading-snug text-abnb-ink">{displayName}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {trees.length === 1 ? (
                    <span
                      className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-abnb-surfaceSoft px-2.5 py-1.5 text-[13px] font-semibold leading-tight text-abnb-body ring-1 ring-abnb-hairlineSoft"
                      title="Bài hiển thị trên bảng tin của dòng họ đã chọn."
                    >
                      <UsersRound className="h-3.5 w-3.5 shrink-0 text-abnb-muted" strokeWidth={2} aria-hidden />
                      <span className="truncate">{currentTreeName}</span>
                    </span>
                  ) : trees.length > 1 ? (
                    <div className="relative inline-flex max-w-full min-w-[12rem] items-center">
                      <label htmlFor={audId} className="sr-only">
                        Đăng vào dòng họ (đối tượng)
                      </label>
                      <UsersRound
                        className="pointer-events-none absolute left-2 top-1/2 z-[1] h-3.5 w-3.5 -translate-y-1/2 text-abnb-muted"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <ChevronDown
                        className="pointer-events-none absolute right-2 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-abnb-muted opacity-85"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <select
                        id={audId}
                        disabled={blocked}
                        value={selectedTreeId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          onSelectedTreeChange(v)
                          if (audienceMode === 'choose') writeStoredProfileTreeId(v)
                        }}
                        className={`relative w-full min-w-[12rem] max-w-[min(100%,20rem)] cursor-pointer appearance-none rounded-lg border border-abnb-hairlineSoft bg-abnb-surfaceSoft py-2 pl-8 pr-9 text-[13px] font-semibold leading-tight text-abnb-body transition-colors hover:bg-abnb-canvas hover:border-abnb-borderStrong disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {trees.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <FeedComposerDraftArea
              id={`${baseId}-draft`}
              value={text}
              onChange={setText}
              disabled={blocked}
              embeddedInModal
              draftRef={draftRef}
            />

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={blocked}
              onChange={onPickImages}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*,.mp4,.webm,.mov,.m4v"
              multiple
              className="sr-only"
              disabled={blocked}
              onChange={onPickVideos}
            />

            {gridItems.length > 0 ? (
              <div className="relative mt-3">
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => clearAllAttachments()}
                  className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-abnb-surfaceCard/92 text-abnb-body shadow-abnb ring-1 ring-black/10 transition hover:bg-abnb-surfaceSoft"
                  title="Gỡ hết đính kèm"
                  aria-label="Xóa tất cả ảnh và video trong bản nháp"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
                <FeedAttachmentGrid compact items={gridItems} />
              </div>
            ) : null}
          </div>

          <div className={`shrink-0 border-t border-abnb-hairlineSoft pb-5 pt-4 ${pad}`}>
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-abnb-xl border border-abnb-hairlineSoft px-3 py-2.5 sm:px-4"
              aria-label="Đính kèm vào bài viết"
            >
              <span className={`${role.bodySm} shrink-0 font-semibold text-abnb-muted sm:text-[15px]`}>
                Thêm vào bài viết của bạn
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => imageInputRef.current?.click()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/16 text-emerald-700 transition hover:bg-emerald-500/24 disabled:opacity-45 dark:bg-emerald-400/14 dark:text-emerald-200"
                  aria-label="Ảnh"
                  title="Ảnh"
                >
                  <ImagePlus className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => videoInputRef.current?.click()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/16 text-sky-800 transition hover:bg-sky-500/24 disabled:opacity-45 dark:bg-sky-400/14 dark:text-sky-100"
                  aria-label="Video"
                  title="Video"
                >
                  <Clapperboard className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} />
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={!canPublish}
              onClick={() => void submit()}
              className={`${role.btnPrimary} !mt-4 !flex !h-auto !min-h-[3rem] !w-full !rounded-abnb-xl !px-4 !py-3 !text-[16px] !font-semibold shadow-abnb disabled:opacity-50`}
            >
              Đăng bài
            </button>

            {!blocked ? (
              <p className={`${role.caption} mt-3 text-center normal-case leading-relaxed text-abnb-muted`}>
                Ảnh chỉ là bản nháp trên trình duyệt — chỉ sau khi bấm{' '}
                <span className="font-medium text-abnb-body/90">Đăng bài</span> mới gửi lên máy chủ.
              </p>
            ) : null}
            {trees.length === 0 ? (
              <p className={`${role.bodySm} mt-3 text-center text-abnb-muted`}>
                Chưa thuộc dòng họ — tham gia một dòng họ để đăng bài.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={`${pad} pb-6 pt-4`}>
          <div className="flex gap-3">
            <ComposerAvatar url={profileAvatarUrl} label={displayName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold leading-snug text-abnb-ink">{displayName}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {trees.length === 1 ? (
                  <span
                    className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-abnb-surfaceSoft px-2.5 py-1.5 text-[13px] font-semibold leading-tight text-abnb-body ring-1 ring-abnb-hairlineSoft"
                    title="Bài hiển thị trên bảng tin của dòng họ đã chọn."
                  >
                    <UsersRound className="h-3.5 w-3.5 shrink-0 text-abnb-muted" strokeWidth={2} aria-hidden />
                    <span className="truncate">{currentTreeName}</span>
                  </span>
                ) : trees.length > 1 ? (
                  <div className="relative inline-flex max-w-full min-w-[12rem] items-center">
                    <label htmlFor={audId} className="sr-only">
                      Đăng vào dòng họ (đối tượng)
                    </label>
                    <UsersRound className="pointer-events-none absolute left-2 top-1/2 z-[1] h-3.5 w-3.5 -translate-y-1/2 text-abnb-muted" strokeWidth={2} aria-hidden />
                    <ChevronDown
                      className="pointer-events-none absolute right-2 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-abnb-muted opacity-85"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <select
                      id={audId}
                      disabled={blocked}
                      value={selectedTreeId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        onSelectedTreeChange(v)
                        if (audienceMode === 'choose') writeStoredProfileTreeId(v)
                      }}
                      className={`relative w-full min-w-[12rem] max-w-[min(100%,20rem)] cursor-pointer appearance-none rounded-lg border border-abnb-hairlineSoft bg-abnb-surfaceSoft py-2 pl-8 pr-9 text-[13px] font-semibold leading-tight text-abnb-body transition-colors hover:bg-abnb-canvas hover:border-abnb-borderStrong disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {trees.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <FeedComposerDraftArea
            id={`${baseId}-draft`}
            value={text}
            onChange={setText}
            disabled={blocked}
            embeddedInModal={false}
            draftRef={draftRef}
          />

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={blocked}
            onChange={onPickImages}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*,.mp4,.webm,.mov,.m4v"
            multiple
            className="sr-only"
            disabled={blocked}
            onChange={onPickVideos}
          />

          {gridItems.length > 0 ? (
            <div className="relative mt-3">
              <button
                type="button"
                disabled={blocked}
                onClick={() => clearAllAttachments()}
                className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-abnb-surfaceCard/92 text-abnb-body shadow-abnb ring-1 ring-black/10 transition hover:bg-abnb-surfaceSoft"
                title="Gỡ hết đính kèm"
                aria-label="Xóa tất cả ảnh và video trong bản nháp"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              <FeedAttachmentGrid compact items={gridItems} />
            </div>
          ) : null}

          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-abnb-xl border border-abnb-hairlineSoft px-3 py-2.5 sm:px-4"
            aria-label="Đính kèm vào bài viết"
          >
            <span className={`${role.bodySm} shrink-0 font-semibold text-abnb-muted sm:text-[15px]`}>
              Thêm vào bài viết của bạn
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={blocked}
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/16 text-emerald-700 transition hover:bg-emerald-500/24 disabled:opacity-45 dark:bg-emerald-400/14 dark:text-emerald-200"
                aria-label="Ảnh"
                title="Ảnh"
              >
                <ImagePlus className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} />
              </button>
              <button
                type="button"
                disabled={blocked}
                onClick={() => videoInputRef.current?.click()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/16 text-sky-800 transition hover:bg-sky-500/24 disabled:opacity-45 dark:bg-sky-400/14 dark:text-sky-100"
                aria-label="Video"
                title="Video"
              >
                <Clapperboard className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} />
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={!canPublish}
            onClick={() => void submit()}
            className={`${role.btnPrimary} !mt-4 !flex !h-auto !min-h-[3rem] !w-full !rounded-abnb-xl !px-4 !py-3 !text-[16px] !font-semibold shadow-abnb disabled:opacity-50`}
          >
            Đăng bài
          </button>

          {!blocked ? (
            <p className={`${role.caption} mt-3 text-center normal-case leading-relaxed text-abnb-muted`}>
              Ảnh chỉ là bản nháp trên trình duyệt — chỉ sau khi bấm{' '}
              <span className="font-medium text-abnb-body/90">Đăng bài</span> mới gửi lên máy chủ.
            </p>
          ) : null}
          {trees.length === 0 ? (
            <p className={`${role.bodySm} mt-3 text-center text-abnb-muted`}>
              Chưa thuộc dòng họ — tham gia một dòng họ để đăng bài.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
