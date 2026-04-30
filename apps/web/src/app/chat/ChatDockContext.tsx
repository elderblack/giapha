import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type ChatDockContextValue = {
  popoverOpen: boolean
  setPopoverOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  miniConversationId: string | null
  miniMinimized: boolean
  openMiniConversation: (conversationId: string) => void
  closeMiniConversation: () => void
  setMiniMinimized: (v: boolean | ((prev: boolean) => boolean)) => void
}

const ChatDockContext = createContext<ChatDockContextValue | null>(null)

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [miniConversationId, setMiniConversationId] = useState<string | null>(null)
  const [miniMinimized, setMiniMinimized] = useState(false)

  const openMiniConversation = useCallback((conversationId: string) => {
    setMiniConversationId(conversationId)
    setMiniMinimized(false)
    setPopoverOpen(false)
  }, [])

  const closeMiniConversation = useCallback(() => {
    setMiniConversationId(null)
    setMiniMinimized(false)
  }, [])

  const value = useMemo(
    (): ChatDockContextValue => ({
      popoverOpen,
      setPopoverOpen,
      miniConversationId,
      miniMinimized,
      openMiniConversation,
      closeMiniConversation,
      setMiniMinimized,
    }),
    [popoverOpen, miniConversationId, miniMinimized, openMiniConversation, closeMiniConversation],
  )

  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>
}

export function useChatDockOptional() {
  return useContext(ChatDockContext)
}

export function useChatDock() {
  const ctx = useContext(ChatDockContext)
  if (!ctx) throw new Error('useChatDock must be used within ChatDockProvider')
  return ctx
}
