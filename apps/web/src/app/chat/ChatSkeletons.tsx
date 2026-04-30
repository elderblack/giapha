function Pulse({ className }: { className?: string }) {
  return (
    <div
      role="presentation"
      className={`animate-pulse bg-abnb-hairlineSoft/70 ${className ?? ''}`}
    />
  )
}

/** Avatar tròn (ví dụ h-9 w-9) — thay spinner ở header luồng chat */
export function ChatHeaderAvatarSkeleton({ size = 'md' }: { size?: 'md' | 'threadRow' }) {
  const cls = size === 'threadRow' ? 'h-11 w-11 shrink-0 rounded-full' : 'h-9 w-9 shrink-0 rounded-full'
  return <Pulse className={cls} />
}

/** Header ChatThreadView khi đang lấy meta / profile */
export function ChatThreadHeaderSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-2.5" aria-busy aria-label="Đang tải…">
      <ChatHeaderAvatarSkeleton size="md" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
        <Pulse className="h-4 w-[min(48%,11rem)] rounded-md" />
        <Pulse className="h-3 w-[min(36%,7rem)] rounded-md" />
      </div>
    </div>
  )
}

/** Vài hàng giống danh sách hội thoại */
export function ThreadListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-abnb-hairlineSoft/60" aria-busy aria-label="Đang tải danh sách…">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <ChatHeaderAvatarSkeleton size="threadRow" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Pulse className="h-4 w-[min(55%,13rem)] rounded-md" />
              <Pulse className="h-3 w-10 shrink-0 rounded-md" />
            </div>
            <Pulse className="h-3 w-[min(88%,100%)] max-w-[20rem] rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Danh sách chọn bạn (modal tạo nhóm) */
export function ChatPickMemberListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="space-y-1 py-2" aria-busy aria-label="Đang tải…">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-abnb-lg px-3 py-2.5">
          <Pulse className="h-4 w-4 shrink-0 rounded" />
          <Pulse className="h-10 w-10 shrink-0 rounded-full" />
          <Pulse className="h-4 max-w-[12rem] flex-1 rounded-md" />
        </li>
      ))}
    </ul>
  )
}

/** Giả lập vài bọt tin nhắn đang tải */
export function MessageListSkeleton() {
  const rows = [
    { align: 'start' as const, box: 'h-9 w-[58%]' },
    { align: 'end' as const, box: 'h-10 w-[44%]' },
    { align: 'start' as const, box: 'h-9 w-[72%]' },
    { align: 'end' as const, box: 'h-9 w-[52%]' },
  ]
  return (
    <div
      className="flex flex-1 flex-col justify-end gap-3 overflow-hidden px-3 py-6 sm:px-4"
      aria-busy
      aria-label="Đang tải tin nhắn…"
    >
      {rows.map((r, i) => (
        <div key={i} className={`flex ${r.align === 'end' ? 'justify-end' : 'justify-start'}`}>
          <Pulse
            className={`max-w-[75%] rounded-2xl ${r.align === 'end' ? 'rounded-br-md' : 'rounded-bl-md'} ${r.box}`}
          />
        </div>
      ))}
    </div>
  )
}
