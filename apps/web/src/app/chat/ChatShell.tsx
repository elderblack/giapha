import { MessageCircle, Plus } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import { role } from '../../design/roles'
import { markFamilyChatConversationRead } from './chatReadSync'
import { ChatCreateGroupModal } from './ChatCreateGroupModal'
import { ThreadList } from './ThreadList'
import { useChatThreads } from './useChatThreads'

export function ChatShell() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const { threads, loading } = useChatThreads()
  const [groupModalOpen, setGroupModalOpen] = useState(false)

  return (
    <>
      <div className="mx-auto flex h-[calc(100dvh-3.5rem-4.25rem-env(safe-area-inset-bottom,0px))] max-h-[calc(100dvh-3.5rem-4.25rem-env(safe-area-inset-bottom,0px))] w-full max-w-5xl overflow-hidden rounded-none border-0 border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-none sm:rounded-abnb-xl sm:border sm:shadow-abnb md:h-[calc(100svh-4rem)] md:max-h-[calc(100svh-4rem)]">
        {/* Sidebar */}
        <aside
          className={`w-full shrink-0 border-r border-abnb-hairlineSoft sm:w-[20rem] md:w-[22rem] ${
            conversationId ? 'hidden sm:block' : ''
          }`}
        >
          <div className="flex h-14 items-center justify-between gap-2 border-b border-abnb-hairlineSoft px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <MessageCircle className="h-5 w-5 shrink-0 text-abnb-primary" strokeWidth={2} />
              <h1 className={`${role.headingModule} m-0 truncate`}>Tin nhắn</h1>
            </div>
            <button
              type="button"
              onClick={() => setGroupModalOpen(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-abnb-hairlineSoft bg-abnb-surfaceSoft px-3 py-1.5 text-[13px] font-semibold text-abnb-primary transition-colors hover:bg-abnb-hairlineSoft/40"
              title="Tạo nhóm chat"
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="hidden sm:inline">Nhóm</span>
            </button>
          </div>
          <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
            <ThreadList
              threads={threads}
              loading={loading}
              activeId={conversationId}
              onThreadActivate={
                sb && uid ? (id) => void markFamilyChatConversationRead(sb, uid, id) : undefined
              }
            />
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
                Chọn một cuộc hội thoại hoặc{' '}
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(true)}
                  className={`${role.link} bg-transparent font-semibold text-abnb-primary hover:underline`}
                >
                  tạo nhóm chat
                </button>
                .
              </p>
            </div>
          )}
        </section>
      </div>

      <ChatCreateGroupModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        onCreated={(id) => void navigate(`/app/chat/${id}`)}
      />
    </>
  )
}
