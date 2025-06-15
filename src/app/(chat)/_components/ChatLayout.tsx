'use client'

import SettingsPage from '@/components/SettingsPage'
import { useChatLayout } from './hooks/useChatLayout'
import { Sidebar } from './components/Sidebar'
import { TopControls } from './components/TopControls'
import { UserMetadata, ConvexChat } from '@/lib/types'
import { useAuth } from '@/hooks/useAuth'
import { useFont } from '@/hooks/useFont'

interface ChatLayoutProps {
  children: React.ReactNode
  isSignedIn: boolean
  userMetadata: UserMetadata
  initialChats?: ConvexChat[] | null
}

export default function ChatLayout({ children, userMetadata: serverUserMetadata, isSignedIn: serverIsSignedIn, initialChats }: ChatLayoutProps) {
  const { 
    settingsOpen,
    setSettingsOpen,
    effectiveSidebarOpen,
    activeChats,
    currentChatId,
    deleteConversation,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    searchQuery,
    setSearchQuery,
    groupedChats,
    handleConversationSelect,
    createNewChat,
    toggleSidebar,
  } = useChatLayout(initialChats)

  const { isSignedIn, userMetadata, isPending } = useAuth({ serverIsSignedIn, serverUserMetadata })
  useFont()

  const isOnHomePage = currentChatId === null

  if (isPending) {
    // ... existing code ...
  }

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* Mobile Backdrop */}
      {effectiveSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 md:hidden transition-opacity duration-300"
          onClick={() => toggleSidebar()}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        effectiveSidebarOpen={effectiveSidebarOpen}
        isOnHomePage={isOnHomePage}
        searchQuery={searchQuery}
        groupedChats={groupedChats}
        currentChatId={currentChatId}
        totalChats={activeChats?.length || 0}
        isSignedIn={isSignedIn}
        userMetadata={userMetadata}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onToggleSidebar={toggleSidebar}
        onSearchChange={setSearchQuery}
        onNewChat={createNewChat}
        onChatSelect={handleConversationSelect}
        onChatDelete={deleteConversation}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative w-full md:w-auto">
        <TopControls
          isSignedIn={isSignedIn}
          effectiveSidebarOpen={effectiveSidebarOpen}
          isOnHomePage={isOnHomePage}
          onToggleSidebar={toggleSidebar}
          onSettingsClick={() => setSettingsOpen(true)}
          onNewChat={createNewChat}
        />

        {/* Page Content */}
        {children}

        {/* Premium subtle glow effect */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
      </div>

      {/* Settings Page */}
      {userMetadata.email && <SettingsPage isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} user={{
        name: userMetadata.name || '',
        email: userMetadata.email || '',
        image: userMetadata.image || '',
      }} />}
    </div>
  )
}
