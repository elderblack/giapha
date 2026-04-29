import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react'
import { Smile } from 'lucide-react'
import { role } from '../../design/roles'
import { useAutosizeTextarea } from './useAutosizeTextarea'

type Props = {
  id: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  embeddedInModal: boolean
  draftRef: RefObject<HTMLTextAreaElement | null>
}

const PICKER_W = 340
const PICKER_H = 352

/** Ô nhập + nút emoji; picker cố định màn hình (portal) để không bị cắt bởi overflow của modal. */
export function FeedComposerDraftArea({
  id,
  value,
  onChange,
  disabled = false,
  embeddedInModal,
  draftRef,
}: Props) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const [pickerW, setPickerW] = useState(PICKER_W)
  const [pickerH, setPickerH] = useState(PICKER_H)
  const emojiBtnRef = useRef<HTMLButtonElement>(null)
  const pickerWrapRef = useRef<HTMLDivElement>(null)
  const selRef = useRef({ start: 0, end: 0 })
  const cursorRestore = useRef<number | null>(null)

  const minRows = embeddedInModal ? 3 : 4
  const maxRows = embeddedInModal ? 14 : 18

  useAutosizeTextarea(draftRef, value, { minRows, maxRows })

  /** Giữ khung emoji kết quả của chèn để chỉnh caret sau controlled update. */
  useLayoutEffect(() => {
    if (cursorRestore.current == null || !draftRef.current) return
    const pos = cursorRestore.current
    cursorRestore.current = null
    const el = draftRef.current
    el.focus({ preventScroll: true })
    el.setSelectionRange(pos, pos)
  }, [value, draftRef])

  function syncSelection() {
    const el = draftRef.current
    if (!el) return
    selRef.current = { start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length }
  }

  useLayoutEffect(() => {
    if (!emojiOpen) {
      setPickerPos(null)
      return
    }
    function place() {
      const btn = emojiBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const vw = typeof window !== 'undefined' ? window.innerWidth : 400
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800
      const w = Math.min(PICKER_W, vw - 16)
      const h = Math.min(PICKER_H, Math.floor(vh * 0.48))
      setPickerW(w)
      setPickerH(h)
      let left = r.right - w
      left = Math.max(8, Math.min(left, vw - w - 8))
      let top = r.bottom + 8
      if (top + h > vh - 12) top = Math.max(8, r.top - h - 8)
      if (top < 8) top = 8
      setPickerPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [emojiOpen])

  useEffect(() => {
    if (!emojiOpen) return
    function onPointerDown(ev: MouseEvent) {
      const t = ev.target as Node
      if (pickerWrapRef.current?.contains(t)) return
      if (emojiBtnRef.current?.contains(t)) return
      setEmojiOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [emojiOpen])

  function insertEmoji(data: EmojiClickData) {
    const emojiStr = data.emoji
    const ta = draftRef.current
    let start = selRef.current.start
    let end = selRef.current.end
    if (ta && document.activeElement === ta) {
      start = ta.selectionStart
      end = ta.selectionEnd
    }
    const next = value.slice(0, start) + emojiStr + value.slice(end)
    const caret = start + emojiStr.length
    cursorRestore.current = caret
    selRef.current = { start: caret, end: caret }
    onChange(next)
    setEmojiOpen(false)
  }

  const pickerNode =
    emojiOpen &&
    pickerPos &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={pickerWrapRef}
            role="presentation"
            className="shadow-2xl ring-1 ring-black/15"
            style={{
              position: 'fixed',
              zIndex: 200,
              top: pickerPos.top,
              left: pickerPos.left,
              width: pickerW,
            }}
          >
            <EmojiPicker
              theme={Theme.AUTO}
              emojiStyle={EmojiStyle.NATIVE}
              lazyLoadEmojis
              autoFocusSearch={false}
              previewConfig={{ showPreview: false }}
              searchPlaceholder="Tìm kiếm biểu tượng cảm xúc"
              width={pickerW}
              height={pickerH}
              onEmojiClick={insertEmoji}
            />
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative mt-4">
      <div className="flex items-start gap-1.5">
        <label htmlFor={id} className="sr-only">
          Nội dung bài viết
        </label>
        <textarea
          ref={draftRef}
          id={id}
          placeholder="Bạn đang nghĩ gì — chia sẻ với họ hàng?"
          disabled={disabled}
          rows={minRows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onSelect={syncSelection}
          onKeyUp={syncSelection}
          onMouseUp={syncSelection}
          onBlur={() => syncSelection()}
          className={`${role.bodyMd} min-h-0 w-full flex-1 resize-none border-0 bg-transparent px-0.5 py-1 text-abnb-body placeholder:text-abnb-muted/90 focus:border-0 focus:outline-none focus:ring-0 disabled:opacity-55`}
          style={{ minHeight: 0 }}
        />
        <button
          ref={emojiBtnRef}
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            /** Giữ caret trước khi textarea blur vì picker mở. */
            syncSelection()
            e.preventDefault()
          }}
          onClick={() => {
            syncSelection()
            if (emojiOpen) {
              setEmojiOpen(false)
              return
            }
            const btn = emojiBtnRef.current
            const vw = typeof window !== 'undefined' ? window.innerWidth : 400
            const vh = typeof window !== 'undefined' ? window.innerHeight : 800
            const w = Math.min(PICKER_W, vw - 16)
            const h = Math.min(PICKER_H, Math.floor(vh * 0.48))
            setPickerW(w)
            setPickerH(h)
            if (btn) {
              const r = btn.getBoundingClientRect()
              let left = r.right - w
              left = Math.max(8, Math.min(left, vw - w - 8))
              let top = r.bottom + 8
              if (top + h > vh - 12) top = Math.max(8, r.top - h - 8)
              if (top < 8) top = 8
              setPickerPos({ top, left })
            }
            setEmojiOpen(true)
          }}
          className={`mt-1 inline-flex shrink-0 rounded-full p-2 text-abnb-muted transition hover:bg-abnb-surfaceSoft hover:text-abnb-ink disabled:opacity-45`}
          aria-label="Chèn biểu tượng cảm xúc"
          title="Emoji"
        >
          <Smile className="h-7 w-7" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {pickerNode}
    </div>
  )
}
