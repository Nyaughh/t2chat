import React from 'react'
import { Button } from '@/components/ui/button'
import { Download, Trash2 } from 'lucide-react'

export function DataSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">Manage Data</h3>
      </div>
      <div className="space-y-3">
        <Button variant="outline" className="w-full justify-start text-base">
          <Download className="w-4 h-4 mr-3" />
          Export All Conversations
        </Button>
        <Button variant="outline" className="w-full justify-start text-base">
          <Trash2 className="w-4 h-4 mr-3" />
          Delete All Conversations
        </Button>
      </div>
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <h4 className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          Danger Zone
        </h4>
        <p className="text-sm text-red-600/80 dark:text-red-300/80 mt-1 mb-3">
          Deleting your conversations is a permanent action and cannot be undone.
        </p>
        <Button variant="destructive" className="w-full text-sm">
          I understand, delete all my data
        </Button>
      </div>
    </div>
  )
}
