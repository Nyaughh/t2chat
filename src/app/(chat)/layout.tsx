import ChatLayout from '@/components/ChatLayout'
import { auth } from '@/lib/auth'
import { getConversations } from '@/lib/db/conversations'
import { headers } from 'next/headers'

export default async function ChatLayoutPage({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders  })
  const initialConversations = session?.user?.id ? await getConversations(session.user.id) : []
  
  return (
    <div>
      <ChatLayout initialConversations={initialConversations}>{children}</ChatLayout>
    </div>
  )
}
