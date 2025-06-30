import ChatLayout from '@/app/(chat)/_components/ChatLayout'
import { cookies } from 'next/headers'
import { api } from '../../../convex/_generated/api'
import { fetchQuery } from 'convex/nextjs'
import { createAuth } from '../../../convex/auth'
import { getToken } from '@convex-dev/better-auth/nextjs'

export default async function ChatLayoutPage({ children }: { children: React.ReactNode }) {
  const token = await getToken(createAuth)
  const user = await fetchQuery(api.auth.getCurrentUser, {}, { token })

  // Fetch initial chats if user is authenticated to prevent flash
  const initialChats = user ? await fetchQuery(api.chat.queries.getUserChats, {}, { token }) : null

  const userMetadata = {
    name: user?.name,
    email: user?.email,
    image: user?.image,
  }

  const cookieStore = await cookies()
  const layoutCookie = cookieStore.get('t2chat-sidebar-open')
  const defaultSidebarOpen = layoutCookie ? layoutCookie.value === 'true' : true

  const mainFont = cookieStore.get('mainFont')?.value
  const codeFont = cookieStore.get('codeFont')?.value

  return (
    <div>
      <ChatLayout
        userMetadata={userMetadata}
        isSignedIn={!!user}
        initialChats={initialChats}
        defaultSidebarOpen={defaultSidebarOpen}
        mainFont={mainFont}
        codeFont={codeFont}
      >
        {children}
      </ChatLayout>
    </div>
  )
}
