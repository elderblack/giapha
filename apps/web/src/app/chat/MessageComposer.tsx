import { ImagePlus, Send } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { uploadChatImage } from './uploadChatImage'

export function MessageComposer(props: {
  conversationId: string
  onSendText: (body: string) => Promise<void>
  onSendImage: (storagePath: string) => Promise<void>
  onTyping?: () => void
}) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    const body = text.trim()
    if (!body) return
    setSending(true)
    setText('')
    await props.onSendText(body)
    setSending(false)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    e.target.value = ''
    setSending(true)
    const result = await uploadChatImage({
      conversationId: props.conversationId,
      userId: user.id,
      file,
    })
    if (result.ok) {
      await props.onSendImage(result.path)
    }
    setSending(false)
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex shrink-0 items-end gap-2 border-t border-abnb-hairlineSoft bg-abnb-canvas px-3 py-2.5 sm:px-4"
    >
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={sending}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-abnb-muted transition-colors hover:bg-abnb-surfaceSoft hover:text-abnb-ink disabled:opacity-50"
        title="Gửi ảnh"
      >
        <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void handleFile(e)}
      />
      <input
        type="text"
        className="h-10 flex-1 rounded-full border border-abnb-hairline bg-abnb-surfaceSoft px-4 text-[14px] text-abnb-ink placeholder:text-abnb-muted focus:border-abnb-ink focus:outline-none focus:ring-1 focus:ring-abnb-ink/10"
        placeholder="Nhập tin nhắn…"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          props.onTyping?.()
        }}
        disabled={sending}
      />
      <button
        type="submit"
        disabled={sending || !text.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-abnb-primary text-white transition-colors hover:bg-abnb-primaryActive disabled:opacity-40"
        title="Gửi"
      >
        <Send className="h-4 w-4" strokeWidth={2} />
      </button>
    </form>
  )
}
