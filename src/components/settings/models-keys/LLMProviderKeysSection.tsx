import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Key, Plus, Trash2, Edit3, CheckCircle, Circle } from 'lucide-react'
import { SectionWrapper } from './SectionWrapper'
import { SettingsCard } from '../primitives'
import { InlineKeyForm } from './InlineKeyForm'
import { LLMProviderKeysSectionProps, ApiKeyDraft } from './types'

export const LLMProviderKeysSection = ({
  title,
  description,
  provider,
  keyPlaceholder,
  keys,
  onSave,
  onDelete,
  onSetDefault,
}: LLMProviderKeysSectionProps) => {
  const [editingKey, setEditingKey] = useState<ApiKeyDraft | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const providerKeys = keys.filter((k) => k.service === provider)

  const handleSave = async () => {
    if (!editingKey) return
    setIsSaving(true)
    try {
      const saved = await onSave(editingKey)
      if (saved) setEditingKey(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SectionWrapper
      title={title}
      description={description}
      addKeyButton={
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setEditingKey({ service: provider, name: '', key: '' })}
          disabled={!!editingKey}
          aria-label={`Add ${title} key`}
        >
          <Plus className="size-3.5" />
          Add key
        </Button>
      }
    >
      {(editingKey || providerKeys.length > 0) && (
        <SettingsCard>
          {providerKeys.map((apiKey) => (
            <div key={apiKey._id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Key className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <span className="truncate">{apiKey.name}</span>
                    {apiKey.is_default && (
                      <span className="shrink-0 rounded px-1.5 py-px text-[11px] font-medium text-emerald-700 bg-emerald-500/10 dark:text-emerald-400">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {apiKey.keyHint ? `••••••••${apiKey.keyHint}` : '••••••••'}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={apiKey.is_default ? 'Default key' : `Make ${apiKey.name} the default key`}
                  title={apiKey.is_default ? 'Default key' : 'Make default'}
                  onClick={() => onSetDefault(apiKey._id)}
                  disabled={apiKey.is_default || !!editingKey}
                >
                  {apiKey.is_default ? (
                    <CheckCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="size-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Edit ${apiKey.name}`}
                  title="Edit"
                  onClick={() =>
                    setEditingKey({ _id: apiKey._id, service: apiKey.service, name: apiKey.name, key: '' })
                  }
                  disabled={!!editingKey}
                >
                  <Edit3 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-400/10 dark:hover:text-red-400"
                  aria-label={`Remove ${apiKey.name}`}
                  title="Remove"
                  onClick={() => onDelete(apiKey._id)}
                  disabled={!!editingKey}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {editingKey && (
            <InlineKeyForm
              editingKey={editingKey}
              keyPlaceholder={keyPlaceholder}
              isSaving={isSaving}
              onValueChange={setEditingKey}
              onSave={handleSave}
              onCancel={() => setEditingKey(null)}
            />
          )}
        </SettingsCard>
      )}
    </SectionWrapper>
  )
}
