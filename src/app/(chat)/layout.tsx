import ChatLayout from '@/components/ChatLayout'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export default async function ChatLayoutPage({ children }: { children: React.ReactNode }) {
  const authSession = await auth.api.getSession({
    headers: await headers()
  })

  const userMetadata = {
    name: authSession?.user?.name,
    email: authSession?.user?.email,
    image: authSession?.user?.image,
  }

  return (
    <div>
      <ChatLayout userMetadata={userMetadata} isSignedIn={!!authSession?.session}>{children}</ChatLayout>
    </div>
  )
}
