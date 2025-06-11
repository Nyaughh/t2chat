import ChatLayout from '@/components/ChatLayout'
import { currentUser } from '@clerk/nextjs/server'


export default async function ChatLayoutPage({ children }: { children: React.ReactNode }) {

  const user = await currentUser()

  const userMetadata = {
    firstName: user?.firstName,
    lastName: user?.lastName,
    primaryEmail: user?.emailAddresses[0].emailAddress,
    image: user?.imageUrl,
  }

  return (
    <div>
      <ChatLayout userMetadata={userMetadata}>{children}</ChatLayout>
    </div>
  )
}
