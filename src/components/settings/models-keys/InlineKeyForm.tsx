import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { settingsFieldClass } from '../primitives'
import { InlineKeyFormProps } from './types'

export const InlineKeyForm = ({
  editingKey,
  keyPlaceholder,
  isSaving,
  onValueChange,
  onSave,
  onCancel,
}: InlineKeyFormProps) => {
  const canSave = !isSaving && !!editingKey.name.trim() && (!!editingKey._id || !!editingKey.key.trim())

  return (
    <motion.form
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
      onSubmit={(e) => {
        e.preventDefault()
        if (canSave) onSave()
      }}
      onKeyDown={(e) => {
        // Esc cancels the form rather than closing the whole settings dialog
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
      className="space-y-2 p-3"
    >
      <p className="text-xs font-medium text-foreground">{editingKey._id ? 'Edit key' : 'Add a key'}</p>
      <input
        type="text"
        autoFocus
        aria-label="Key name"
        placeholder="Key name (e.g. Personal)"
        value={editingKey.name}
        onChange={(e) => onValueChange({ ...editingKey, name: e.target.value })}
        className={settingsFieldClass}
      />
      <input
        type="password"
        aria-label="API key"
        autoComplete="off"
        spellCheck={false}
        placeholder={editingKey._id ? 'New API key (leave blank to keep the current key)' : keyPlaceholder || 'API key'}
        value={editingKey.key}
        onChange={(e) => onValueChange({ ...editingKey, key: e.target.value })}
        className={settingsFieldClass}
      />
      <p className="text-xs text-muted-foreground">
        Your key is encrypted before it is stored and is only used to run your own chats. You can remove it at any time.
      </p>
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!canSave}>
          {isSaving ? 'Saving…' : 'Save key'}
        </Button>
      </div>
    </motion.form>
  )
}
