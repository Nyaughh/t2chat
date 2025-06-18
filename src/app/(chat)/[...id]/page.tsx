import ChatInterface from '@/app/(chat)/_components/ChatInterface'
import { NextPage } from 'next'

const ChatPage: NextPage<{ params: Promise<{ id: string[] }> }> = async ({ params }) => {
  // The [...id] route parameter is always an array of strings in this case
  const { id } = await params
  const chatId = Array.isArray(id) ? id[1] : id

  // initialMessages will now be fetched on the client inside useConversations
  // This makes navigation between chats feel instant
  return <ChatInterface chatId={chatId} initialMessages={null} />
}

export default ChatPage
