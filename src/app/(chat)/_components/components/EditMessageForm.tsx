'use client'

import { X, Send } from 'lucide-react'

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
          className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
          title="Cancel edit"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={onSave}
          disabled={!content.trim()}
          className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save edit"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
