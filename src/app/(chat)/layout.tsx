import ChatLayout from '@/components/ChatLayout'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'

export default async function ChatLayoutPage({ children }: { children: React.ReactNode }) {
  const session = getKindeServerSession()
  const user = await session.getUser() ?? null
  
  return (
    <div>
      <ChatLayout user={user}>{children}</ChatLayout>
    </div>
  )
}
