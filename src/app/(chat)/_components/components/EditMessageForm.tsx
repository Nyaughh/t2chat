'use client'

import { X, Send } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EditMessageFormProps {
  content: string
  editInputRef: React.RefObject<HTMLTextAreaElement | null>
  onContentChange: (content: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onCancel: () => void
  onSave: () => void
}

export function EditMessageForm({
  content,
  editInputRef,
  onContentChange,
  onKeyDown,
  onCancel,
  onSave,
}: EditMessageFormProps) {
  return (
    <div className="space-y-2">
      <textarea
        ref={editInputRef}
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full bg-transparent border-none outline-none resize-none text-base leading-relaxed break-words overflow-wrap-anywhere"
        rows={Math.max(1, content.split('\n').length)}
        style={{ minHeight: '1.5rem' }}
      />
      <div className="flex items-center gap-1 justify-end" data-edit-controls>
        <button
          onClick={onCancel}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'cursor-pointer')}
          title="Cancel edit"
        >
          <X />
        </button>
        <button
          onClick={onSave}
          disabled={!content.trim()}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'cursor-pointer')}
          title="Save edit"
        >
          <Send />
        </button>
      </div>
    </div>
  )
}
