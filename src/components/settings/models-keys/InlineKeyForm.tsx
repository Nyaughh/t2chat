import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { InlineKeyFormProps } from './types'

export const InlineKeyForm = ({ editingKey, onValueChange, onSave, onCancel }: InlineKeyFormProps) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="p-3 rounded-lg bg-muted/30 border border-border/60 mt-2 space-y-2"
  >
    <h4 className="font-semibold text-sm text-foreground">{editingKey._id ? 'Edit' : 'Add New'} Key</h4>
    <input
      type="text"
      placeholder="Key Name (e.g., Personal Key)"
      value={editingKey.name || ''}
      onChange={(e) => onValueChange({ ...editingKey, name: e.target.value })}
      className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 outline-none"
    />
    <input
      type="password"
      placeholder="API Key"
      value={editingKey.key || ''}
      onChange={(e) => onValueChange({ ...editingKey, key: e.target.value })}
      className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 outline-none"
    />
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      <Button size="sm" onClick={onSave}>Save Key</Button>
    </div>
  </motion.div>
) 