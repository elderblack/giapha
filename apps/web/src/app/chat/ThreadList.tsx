import { Loader2, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { role } from '../../design/roles'
import type { ChatThreadPreview } from './types'

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}

export function ThreadList(props: { threads: ChatThreadPreview[]; loading: boolean; activeId?: string }) {
  if (props.loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-abnb-primary" />
      </div>
    )
  }

  if (props.threads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <MessageCircle className="h-10 w-10 text-abnb-muted/50" strokeWidth={1.5} />
        <p className={`${role.bodySm} text-abnb-muted`}>
          Chưa có cuộc hội thoại nào. Mở trang <strong>Kết nối</strong> để nhắn tin với bạn bè.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-abnb-hairlineSoft/60">
      {props.threads.map((t) => {
        const isActive = t.conversation.id === props.activeId
        return (
          <li key={t.conversation.id}>
            <Link
              to={`/app/chat/${t.conversation.id}`}
              className={`flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-abnb-surfaceSoft ${
                isActive ? 'bg-abnb-primary/[0.06]' : ''
              }`}
            >
              {t.otherUser.avatar_url ? (
                <img
                  src={t.otherUser.avatar_url}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-abnb-surfaceStrong text-[15px] font-semibold text-abnb-ink">
                  {t.otherUser.full_name[0]?.toUpperCase() ?? '?'}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold text-abnb-ink">
                    {t.otherUser.full_name}
                  </span>
                  {t.lastMessage && (
                    <span className="shrink-0 text-[11px] text-abnb-muted">
                      {formatTime(t.lastMessage.created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="m-0 truncate text-[13px] text-abnb-muted">
                    {t.lastMessage
                      ? t.lastMessage.body
                        ? t.lastMessage.body.slice(0, 60)
                        : '[Ảnh]'
                      : 'Chưa có tin nhắn'}
                  </p>
                  {t.unreadCount > 0 && (
                    <span className="ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-abnb-primary px-1 text-[10px] font-bold text-abnb-onPrimary">
                      {t.unreadCount > 9 ? '9+' : t.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
