import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { getVendorColor, models, type ModelInfo } from '@/lib/models'
import { SectionWrapper } from './SectionWrapper'
import { ModelManagementSectionProps } from './types'

export const ModelManagementSection = ({ disabledModels, onToggleModel }: ModelManagementSectionProps) => {
  const [groupBy, setGroupBy] = useState<'provider' | 'vendor'>('vendor')
  const [searchFilter, setSearchFilter] = useState('')

  // Filter models based on search
  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      model.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchFilter.toLowerCase()) ||
      model.vendor.toLowerCase().includes(searchFilter.toLowerCase()),
  )

  // Group models
  const groupedModels = filteredModels.reduce(
    (acc, model) => {
      const groupKey = groupBy === 'provider' ? model.provider : model.vendor
      if (!acc[groupKey]) {
        acc[groupKey] = []
      }
      acc[groupKey].push(model)
      return acc
    },
    {} as Record<string, ModelInfo[]>,
  )

  // Sort groups and models within groups
  const sortedGroupedModels = Object.entries(groupedModels)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce(
      (acc, [groupKey, groupModels]) => {
        const sortedModels = groupModels.sort((a, b) => {
          if (groupBy === 'provider') {
            if (a.vendor !== b.vendor) {
              return a.vendor.localeCompare(b.vendor)
            }
          }
          return a.name.localeCompare(b.name)
        })
        acc[groupKey] = sortedModels
        return acc
      },
      {} as Record<string, ModelInfo[]>,
    )

  return (
    <SectionWrapper
      title="Model Management"
      description="Enable or disable specific AI models. Disabled models won't appear in model selection dropdowns."
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <input
            type="text"
            placeholder="Search models..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 outline-none transition-all duration-200 backdrop-blur-sm"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Group by:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupBy(groupBy === 'provider' ? 'vendor' : 'provider')}
              className="capitalize"
            >
              {groupBy}
            </Button>
          </div>
        </div>

        {/* Model Groups */}
        <div className="space-y-4">
          {Object.entries(sortedGroupedModels).map(([groupKey, groupModels]) => (
            <div key={groupKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-3 h-3 rounded-full',
                    getVendorColor(groupBy === 'provider' ? groupModels[0]?.vendor || groupKey : groupKey),
                  )}
                />
                <h4 className="font-medium text-sm text-foreground capitalize">
                  {groupKey === 'openrouter' ? 'OpenRouter' : groupKey} ({groupModels.length})
                </h4>
              </div>
              <div className="grid gap-2">
                {groupModels.map((model) => {
                  const isEnabled = !disabledModels.includes(model.id)
                  return (
                    <div
                      key={model.id}
                      className={cn(
                        'p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-border/40 flex items-center justify-between transition-opacity',
                        !isEnabled && 'opacity-50',
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-foreground truncate">{model.name}</span>
                            <span className="text-xs text-muted-foreground truncate">• {model.description}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Features in consistent order: web, vision, code, imagegen */}
                            {['web', 'vision', 'code', 'imagegen'].map((feature) => 
                              model.features.includes(feature as any) && (
                                <span
                                  key={feature}
                                  className="text-xs text-rose-500/60 dark:text-rose-300/60 bg-rose-100/50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded-full capitalize"
                                >
                                  {feature}
                                </span>
                              )
                            )}
                            {/* Special tags - always at the end */}
                            {model.supportsThinking && (
                              <span className="text-xs text-yellow-600 bg-yellow-500/10 px-1.5 py-0.5 rounded-full">
                                Thinking
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {model.isApiKeyOnly && (
                          <span className="text-xs text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                            API Key Required
                          </span>
                        )}
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => onToggleModel(model.id, checked)}
                          disabled={model.id === 'gemini-2.0-flash-lite'}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {filteredModels.length === 0 && searchFilter && (
          <p className="text-sm text-center text-muted-foreground py-8">No models found matching "{searchFilter}"</p>
        )}
      </div>
    </SectionWrapper>
  )
} 