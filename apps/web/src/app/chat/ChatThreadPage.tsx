import { useParams } from 'react-router-dom'
import { ChatThreadView } from './ChatThreadView'

export function ChatThreadPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  if (!conversationId) return null
  return <ChatThreadView conversationId={conversationId} variant="page" />
}
