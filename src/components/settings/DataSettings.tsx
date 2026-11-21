import React, { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Download, Trash2, UploadCloud, Loader2 } from 'lucide-react'
import { Conversation, db } from '@/lib/dexie'
import { useConvex, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { toast } from 'sonner'
import { SettingsCard, SettingsGroup, SettingsRow } from './primitives'

interface DataSettingsProps {
  unmigratedLocalChats: Conversation[]
}

export function DataSettings({ unmigratedLocalChats }: DataSettingsProps) {
  const [isMigrating, setIsMigrating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const convex = useConvex()
  const migrateChats = useMutation(api.chat.mutations.migrateAnonymousChats)
  const deleteAllData = useMutation(api.chat.mutations.deleteAllConversations)

  const localCount = unmigratedLocalChats?.length ?? 0
  const plural = (n: number) => (n === 1 ? '' : 's')

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
      // One-shot fetch on demand: a live subscription would re-download every conversation
      // on each change for as long as this pane is open.
      const data = await convex.query(api.chat.queries.exportAllConversations, {})
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
      {localCount > 0 && (
        <SettingsGroup title="Local chats">
          <SettingsCard>
            <SettingsRow
              icon={UploadCloud}
              label={`Import ${localCount} conversation${plural(localCount)}`}
              description="These were saved in this browser before you signed in."
            >
              <Button onClick={handleMigrate} disabled={isMigrating} variant="outline" size="sm">
                {isMigrating && <Loader2 className="animate-spin" />}
                {isMigrating ? 'Importing…' : 'Import'}
              </Button>
            </SettingsRow>
          </SettingsCard>
        </SettingsGroup>
      )}

      <SettingsGroup title="Export">
        <SettingsCard>
          <SettingsRow icon={Download} label="Export all conversations" description="Download your chats as JSON.">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
              {isExporting && <Loader2 className="animate-spin" />}
              {isExporting ? 'Exporting…' : 'Export'}
            </Button>
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Danger zone">
        <SettingsCard className="border-red-500/20 dark:border-red-400/20">
          <SettingsRow
            icon={Trash2}
            label="Delete all conversations"
            description="Permanently deletes every chat and message. This can't be undone."
          >
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  {isDeleting && <Loader2 className="animate-spin" />}
                  Delete all
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all conversations?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes all of your chats and their messages. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} className={buttonVariants({ variant: 'destructive' })}>
                    Delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>
    </div>
  )
}
