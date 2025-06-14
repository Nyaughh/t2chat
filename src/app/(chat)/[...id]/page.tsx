import ChatInterface from '@/app/(chat)/_components/ChatInterface'

interface ChatPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params
  return <ChatInterface />
}
