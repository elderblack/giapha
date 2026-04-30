import { MessageCircle } from 'lucide-react'
import { Outlet, useParams } from 'react-router-dom'
import { role } from '../../design/roles'
import { ThreadList } from './ThreadList'
import { useChatThreads } from './useChatThreads'

export function ChatShell() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const { threads, loading } = useChatThreads()

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem-4.25rem-env(safe-area-inset-bottom,0px))] max-h-[calc(100dvh-3.5rem-4.25rem-env(safe-area-inset-bottom,0px))] w-full max-w-5xl overflow-hidden rounded-none border-0 border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-none sm:rounded-abnb-xl sm:border sm:shadow-abnb md:h-[calc(100svh-4rem)] md:max-h-[calc(100svh-4rem)]">
      {/* Sidebar */}
      <aside
        className={`w-full shrink-0 border-r border-abnb-hairlineSoft sm:w-[20rem] md:w-[22rem] ${
          conversationId ? 'hidden sm:block' : ''
        }`}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-abnb-hairlineSoft px-4">
          <MessageCircle className="h-5 w-5 text-abnb-primary" strokeWidth={2} />
          <h1 className={`${role.headingModule} m-0`}>Tin nhắn</h1>
        </div>
        <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
          <ThreadList threads={threads} loading={loading} activeId={conversationId} />
        </div>
      </aside>
      {/* Main */}
      <section className={`flex-1 ${!conversationId ? 'hidden sm:flex' : 'flex'} flex-col`}>
        {conversationId ? (
          <Outlet />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
            <MessageCircle className="h-12 w-12 text-abnb-muted/40" strokeWidth={1.5} />
            <p className={`${role.bodySm} text-center text-abnb-muted`}>
              Chọn một cuộc hội thoại để bắt đầu nhắn tin.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
