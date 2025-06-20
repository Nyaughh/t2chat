import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Key, Plus, Trash2, Edit3, Eye, EyeOff, CheckCircle, Circle } from 'lucide-react'
import { SectionWrapper } from './SectionWrapper'
import { InlineKeyForm } from './InlineKeyForm'
import { LLMProviderKeysSectionProps, ApiKey } from './types'

export const LLMProviderKeysSection = ({ title, provider, keys, onSave, onDelete, onSetDefault }: LLMProviderKeysSectionProps) => {
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [editingKey, setEditingKey] = useState<Partial<ApiKey> | null>(null)
  const providerKeys = keys.filter((k) => k.service === provider)

  const handleSave = () => {
    if (editingKey) {
      onSave(editingKey)
      setEditingKey(null)
    }
  }

  return (
    <SectionWrapper title={title} description={`Manage your API keys for ${title.replace(' Keys', '')}`} addKeyButton={
      <Button variant="outline" size="sm" onClick={() => setEditingKey({ service: provider, name: '', key: '' })} disabled={!!editingKey}>
        <Plus className="w-4 h-4 mr-2" />
        Add New Key
      </Button>
    }>

      {editingKey && (
        <InlineKeyForm
          editingKey={editingKey}
          onValueChange={setEditingKey}
          onSave={handleSave}
          onCancel={() => setEditingKey(null)}
        />
      )}

      <div className="space-y-1.5 mt-2">
        {providerKeys.length > 0
          ? providerKeys.map((apiKey) => (
              <div key={apiKey._id} className="p-2 rounded-md bg-muted/30 border border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-rose-500" />
                  <div>
                    <div className="font-medium text-sm text-foreground flex items-center gap-2">
                      {apiKey.name}
                      {apiKey.is_default && (
                        <span className="text-xs text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">Default</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {visibleKeys[apiKey._id] ? apiKey.key : `••••••••••••••••${apiKey.key.slice(-4)}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onSetDefault(apiKey._id)}
                    disabled={apiKey.is_default || !!editingKey}
                  >
                    {apiKey.is_default ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Circle className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setVisibleKeys((p) => ({ ...p, [apiKey._id]: !p[apiKey._id] }))}
                    disabled={!!editingKey}
                  >
                    {visibleKeys[apiKey._id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingKey(apiKey)} disabled={!!editingKey}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-500/70 hover:text-red-500"
                    onClick={() => onDelete(apiKey._id)}
                    disabled={!!editingKey}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          : !editingKey && <p className="text-sm text-center text-muted-foreground py-3">No keys added yet.</p>}
      </div>
    </SectionWrapper>
  )
} 