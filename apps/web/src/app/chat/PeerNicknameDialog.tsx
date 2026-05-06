import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  /** Tên đầy đủ trong hệ thống */
  peerFullName: string
  draftInitial: string
  saving: boolean
  onClose: () => void
  /** Chuỗi rỗng = xóa biệt danh */
  onCommit: (trimmed: string) => void | Promise<void>
}

export function PeerNicknameDialog(props: Props) {
  const [draft, setDraft] = useState(props.draftInitial)

  useEffect(() => {
    if (props.open) setDraft(props.draftInitial)
  }, [props.open, props.draftInitial])

  if (!props.open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !props.saving) props.onClose()
      }}
    >
      <div
        className="w-full max-w-sm rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard p-4 shadow-abnb sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="peer-nick-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="peer-nick-title" className="m-0 text-base font-semibold text-abnb-ink">
          Biệt danh
        </h2>
        <p className="mt-1 text-[13px] text-abnb-muted leading-snug">
          Chỉ bạn nhìn thấy tên này. Hồ sơ của {props.peerFullName} không đổi.{' '}
          <span className="text-abnb-ink/80">Để trống rồi Lưu sẽ xóa biệt danh.</span>
        </p>
        <label className="mt-4 block">
          <span className="sr-only">Biệt danh</span>
          <input
            type="text"
            autoFocus
            maxLength={48}
            placeholder="VD: Ba, Em gái…"
            value={draft}
            disabled={props.saving}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-full border border-abnb-hairlineSoft bg-abnb-surface px-4 py-2.5 text-[15px] text-abnb-ink outline-none ring-abnb-primary/35 focus-visible:ring-2"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={props.saving}
            onClick={props.onClose}
            className="rounded-full border border-abnb-hairlineSoft px-4 py-2 text-[13px] font-semibold text-abnb-ink hover:bg-abnb-surfaceSoft"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={props.saving}
            onClick={() => void props.onCommit(draft.trim())}
            className="rounded-full bg-abnb-primary px-4 py-2 text-[13px] font-semibold text-abnb-onPrimary hover:opacity-90"
          >
            {props.saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}
