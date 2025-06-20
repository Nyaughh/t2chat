import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Trash2, UploadCloud, Loader2 } from 'lucide-react'
import { Conversation, db } from '@/lib/dexie'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { toast } from 'sonner'

interface DataSettingsProps {
  unmigratedLocalChats: Conversation[]
}

export function DataSettings({ unmigratedLocalChats }: DataSettingsProps) {
  const [isMigrating, setIsMigrating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const migrateChats = useMutation(api.chat.mutations.migrateAnonymousChats)
  const exportData = useQuery(api.chat.queries.exportAllConversations)
  const deleteAllData = useMutation(api.chat.mutations.deleteAllConversations)

  const handleMigrate = async () => {
    if (!unmigratedLocalChats || unmigratedLocalChats.length === 0) {
      toast.info('No local chats to import.')
      return
    }

    setIsMigrating(true)
    const migrationToast = toast.loading(`Importing ${unmigratedLocalChats.length} chats...`)

    try {
      const localMessages = await db.messages
        .where('conversationId')
        .anyOf(unmigratedLocalChats.map((c) => c.id))
        .toArray()

      const chatsToMigrate = unmigratedLocalChats.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt.getTime(),
        updatedAt: c.updatedAt.getTime(),
        lastMessageAt: c.lastMessageAt.getTime(),
      }))
      const messagesToMigrate = localMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          content: m.content,
          role: m.role as 'user' | 'assistant',
          createdAt: m.createdAt.getTime(),
          model: m.model,
        }))

      await migrateChats({
        chats: chatsToMigrate,
        messages: messagesToMigrate,
      })

      // Clear only the migrated chats and messages from Dexie
      await db.conversations.bulkDelete(unmigratedLocalChats.map((c) => c.id))
      await db.messages.bulkDelete(localMessages.map((m) => m.id))

      toast.success('Chats imported successfully!', { id: migrationToast })
    } catch (error) {
      console.error('Migration failed', error)
      toast.error('An error occurred during chat import.', { id: migrationToast })
    } finally {
      setIsMigrating(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    const exportToast = toast.loading('Exporting your data...')

    try {
      const data = exportData
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'conversations_export.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully!', { id: exportToast })
    } catch (error) {
      console.error('Export failed', error)
      toast.error('An error occurred during data export.', { id: exportToast })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAll = async () => {
    setIsDeleting(true)
    const deleteToast = toast.loading('Deleting all your conversations...')

    try {
      await deleteAllData()
      toast.success('All conversations deleted.', { id: deleteToast })
    } catch (error) {
      console.error('Deletion failed', error)
      toast.error('An error occurred while deleting your data.', { id: deleteToast })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {unmigratedLocalChats && unmigratedLocalChats.length > 0 && (
        <div className="p-4 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50">
          <h4 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2 mb-3">
            <UploadCloud className="w-4 h-4" />
            Import Local Chats
          </h4>
          <p className="text-sm text-blue-600/80 dark:text-blue-300/80 mb-3">
            You have {unmigratedLocalChats.length} conversation{unmigratedLocalChats.length > 1 ? 's' : ''} from a
            previous session. Import them to your account.
          </p>
          <Button
            onClick={handleMigrate}
            disabled={isMigrating}
            variant="outline"
            className="w-full text-sm bg-white/50 dark:bg-black/10"
          >
            {isMigrating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${unmigratedLocalChats.length} conversation${unmigratedLocalChats.length > 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Export Data</h3>
        <div className="space-y-3 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50 p-4">
          <Button
            variant="outline"
            className="w-full justify-start text-base"
            onClick={handleExport}
            disabled={isExporting || !exportData}
          >
            {isExporting ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : <Download className="w-4 h-4 mr-3" />}
            Export All Conversations
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Danger Zone</h3>
        <div className="p-4 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50">
          <h4 className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-2 mb-3">
            <Trash2 className="w-4 h-4" />
            Delete All Data
          </h4>
          <p className="text-sm text-red-600/80 dark:text-red-300/80 mb-3">
            Deleting your conversations is a permanent action and cannot be undone.
          </p>
          <Button variant="destructive" className="w-full text-sm" onClick={handleDeleteAll} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}I
            understand, delete all my data
          </Button>
        </div>
      </div>
    </div>
  )
}
