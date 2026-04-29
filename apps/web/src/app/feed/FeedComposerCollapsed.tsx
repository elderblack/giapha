import { Clapperboard, ImagePlus, Smile } from 'lucide-react'
import { role } from '../../design/roles'
import { firstNameHint } from './composerNaming'
import { useComposerProfile } from './useComposerProfile'

function AvatarSm({
  url,
  label,
}: {
  url: string | null
  label: string
}) {
  const ch = label.trim()[0]?.toUpperCase() ?? '?'
  if (url) {
    return (
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-abnb-surfaceSoft ring-2 ring-white shadow-abnb sm:h-10 sm:w-10">
        <img src={url} alt="" className="h-full w-full object-cover" />
      </span>
    )
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-abnb-primary/[0.2] to-abnb-luxe/[0.12] text-[13px] font-bold uppercase text-abnb-primary shadow-abnb ring-2 ring-white sm:h-10 sm:w-10 sm:text-[14px]">
      {ch}
    </span>
  )
}

type Props = {
  disabled: boolean
  onOpen: () => void
}

/**
 * Trạng thái “bình thường” trên Feed: chỉ một hàng — bấm mở form đầy đủ trong modal.
 */
export function FeedComposerCollapsed({ disabled, onOpen }: Props) {
  const { displayName, avatarUrl } = useComposerProfile()
  const hint = firstNameHint(displayName)

  return (
    <div
      className={`flex items-center gap-2 rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard px-2.5 py-2 shadow-abnb sm:gap-3 sm:px-3 sm:py-2.5 ${
        disabled ? 'pointer-events-none opacity-55' : ''
      }`}
    >
      <AvatarSm url={avatarUrl} label={displayName} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpen()}
        className={`${role.bodySm} min-h-[2.75rem] min-w-0 flex-1 rounded-full border border-transparent bg-abnb-surfaceSoft px-4 py-2.5 text-left text-[15px] font-normal text-abnb-muted shadow-abnb-inner transition hover:bg-abnb-canvas hover:ring-1 hover:ring-abnb-hairlineSoft disabled:opacity-50`}
      >
        {hint} ơi, bạn đang nghĩ gì?
      </button>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1" aria-hidden={disabled}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onOpen()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/16 text-emerald-700 transition hover:bg-emerald-500/24 disabled:opacity-40 sm:h-10 sm:w-10"
          title="Ảnh"
          aria-label="Mở đăng bài — ảnh"
        >
          <ImagePlus className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onOpen()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/16 text-sky-800 transition hover:bg-sky-500/24 disabled:opacity-40 dark:text-sky-100 sm:h-10 sm:w-10"
          title="Video"
          aria-label="Mở đăng bài — video"
        >
          <Clapperboard className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onOpen()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/16 text-rose-700 transition hover:bg-rose-500/24 disabled:opacity-40 dark:text-rose-200 sm:h-10 sm:w-10"
          title="Cảm xúc / hoạt động"
          aria-label="Mở đăng bài"
        >
          <Smile className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
