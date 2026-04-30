import { MessageListSkeleton } from './ChatSkeletons'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import type { ChatMessage } from './types'

function formatMsgTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function AttachmentImage({ path }: { path: string }) {
  const sb = getSupabase()
  if (!sb) return null
  const { data } = sb.storage.from('family-chat-media').getPublicUrl(path)
  return (
    <img
      src={data.publicUrl}
      alt="Ảnh đính kèm"
      className="mt-1 max-h-[16rem] max-w-[14rem] rounded-lg object-cover shadow-sm"
      loading="lazy"
    />
  )
}

export function MessageList(props: {
  messages: ChatMessage[]
  loading: boolean
  bottomRef: React.RefObject<HTMLDivElement | null>
  /** Tin của người khác trong nhóm: hiển thị tên */
  senderNameByUserId?: Record<string, string>
}) {
  const { user } = useAuth()
  const uid = user?.id

  if (props.loading) {
    return <MessageListSkeleton />
  }

  if (props.messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-center text-sm text-abnb-muted">Bắt đầu cuộc trò chuyện!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4 sm:px-4">
      {props.messages.map((msg) => {
        const isMine = msg.sender_id === uid
        const senderLabel =
          !isMine && props.senderNameByUserId?.[msg.sender_id]
            ? props.senderNameByUserId[msg.sender_id]
            : undefined
        return (
          <div key={msg.id} className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
            {!isMine && senderLabel ? (
              <span className="max-w-[75%] px-1 text-[11px] font-medium text-abnb-muted">{senderLabel}</span>
            ) : null}
            <div className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`relative max-w-[75%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
                  isMine
                    ? 'rounded-br-md bg-abnb-primary text-white'
                    : 'rounded-bl-md bg-abnb-surfaceSoft text-abnb-ink'
                }`}
              >
                {msg.body && <p className="m-0 whitespace-pre-wrap break-words">{msg.body}</p>}
                {msg.attachment_path && <AttachmentImage path={msg.attachment_path} />}
                <span
                  className={`mt-0.5 block text-right text-[10px] ${
                    isMine ? 'text-white/70' : 'text-abnb-muted'
                  }`}
                >
                  {formatMsgTime(msg.created_at)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
      <div ref={props.bottomRef} />
    </div>
  )
}
