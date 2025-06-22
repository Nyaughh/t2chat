'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useChatLayout } from './hooks/useChatLayout'
import { Sidebar } from './components/Sidebar'
import { TopControls } from './components/TopControls'

import { UserMetadata, ConvexChat } from '@/lib/types'
import { useAuth } from '@/hooks/useAuth'
import { useFont } from '@/hooks/useFont'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { toast } from 'sonner'
import { Id } from '../../../../convex/_generated/dataModel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'

interface ChatLayoutProps {
  children: React.ReactNode
  isSignedIn: boolean
  userMetadata: UserMetadata
  initialChats?: ConvexChat[] | null
}

function RenameDialog({
  isOpen,
  onClose,
  onConfirm,
  currentTitle,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: (newTitle: string) => void
  currentTitle: string
}) {
  const [newTitle, setNewTitle] = useState(currentTitle)

  useEffect(() => {
    setNewTitle(currentTitle)
  }, [currentTitle, isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Chat</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onConfirm(newTitle)
              }
            }}
          />
        </div>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(newTitle)}>Save</Button>
        </AlertDialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ChatLayout({
  children,
  userMetadata: serverUserMetadata,
  isSignedIn: serverIsSignedIn,
  initialChats,
}: ChatLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const {
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

  const [renamingChatInfo, setRenamingChatInfo] = useState<{ id: string; title: string } | null>(null)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [sharingChatId, setSharingChatId] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState('')

  const renameChat = useMutation(api.chat.mutations.renameChat)
  const shareChat = useMutation(api.chat.mutations.shareChat)

  const handleOpenRenameDialog = (chatId: string, currentTitle: string) => {
    setRenamingChatInfo({ id: chatId, title: currentTitle })
  }

  const handleConfirmRename = async (newTitle: string) => {
    if (!renamingChatInfo) return

    const { id, title } = renamingChatInfo
    if (newTitle && newTitle.trim() !== '' && newTitle !== title) {
      try {
        await renameChat({ chatId: id as Id<'chats'>, title: newTitle.trim() })
        toast.success('Chat renamed!')
      } catch (error) {
        toast.error('Failed to rename chat.')
        console.error(error)
      }
    }
    setRenamingChatInfo(null)
  }

  const handleOpenShareDialog = async (chatId: string) => {
    if (!isSignedIn) {
      toast.error('Please sign in to share chats.')
      return
    }

    try {
      const shareId = await shareChat({ chatId: chatId as Id<'chats'> })
      const url = `${window.location.origin}/shared/${shareId}`
      setShareUrl(url)
      setSharingChatId(chatId)
    } catch (error) {
      toast.error('Failed to share chat.')
      console.error(error)
    }
  }

  const handleOpenDeleteDialog = (chatId: string) => {
    setDeletingChatId(chatId)
  }

  const handleConfirmDelete = () => {
    if (deletingChatId) {
      deleteConversation(deletingChatId)
      setDeletingChatId(null)
    }
  }

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareUrl)
    toast.success('Share link copied to clipboard!')
  }

  const isOnHomePage = currentChatId === null
  const isSettingsPage = pathname === '/settings'

  if (isPending) {
    // ... existing code ...
  }

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* Mobile Backdrop */}
      {effectiveSidebarOpen && !isSettingsPage && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 md:hidden transition-opacity duration-300"
          onClick={() => toggleSidebar()}
        />
      )}

      {/* Sidebar */}
      {!isSettingsPage && (
        <Sidebar
          effectiveSidebarOpen={effectiveSidebarOpen}
          isOnHomePage={isOnHomePage}
          searchQuery={searchQuery}
          groupedChats={groupedChats}
          currentChatId={currentChatId}
          totalChats={activeChats?.length || 0}
          isSignedIn={isSignedIn}
          userMetadata={userMetadata}
          editingChatId={renamingChatInfo?.id || null}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onToggleSidebar={toggleSidebar}
          onSearchChange={setSearchQuery}
          onNewChat={createNewChat}
          onChatSelect={handleConversationSelect}
          onChatDelete={handleOpenDeleteDialog}
          onChatRename={handleOpenRenameDialog}
          onChatShare={handleOpenShareDialog}
          onSettingsClick={() => router.push('/settings')}
          allChats={activeChats || []}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative w-full md:w-auto">
        {!isSettingsPage && (
          <TopControls
            isSignedIn={isSignedIn}
            effectiveSidebarOpen={effectiveSidebarOpen}
            isOnHomePage={isOnHomePage}
            onToggleSidebar={toggleSidebar}
            onSettingsClick={() => router.push('/settings')}
            onNewChat={createNewChat}
          />
        )}

        {/* Page Content */}
        {children}

        {/* Premium subtle glow effect */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingChatId} onOpenChange={(open) => !open && setDeletingChatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your chat and all of its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <RenameDialog
        isOpen={!!renamingChatInfo}
        onClose={() => setRenamingChatInfo(null)}
        onConfirm={handleConfirmRename}
        currentTitle={renamingChatInfo?.title || ''}
      />

      {/* Share Dialog */}
      <Dialog open={!!sharingChatId} onOpenChange={(open) => !open && setSharingChatId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Chat</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-500">Anyone with this link will be able to view this chat.</p>
            <div className="flex items-center space-x-2">
              <Input value={shareUrl} readOnly />
              <Button onClick={handleCopyShareLink} size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
