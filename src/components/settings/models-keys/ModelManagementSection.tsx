import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  getVendorColor,
  getProviderDisplayName,
  models,
  DEFAULT_MODEL_ID,
  PROVIDER_DISPLAY_NAMES,
  type ModelInfo,
  type ModelProvider,
} from '@/lib/models'
import { isModelUsable } from '@/lib/modelPreferences'
import { Search } from 'lucide-react'
import { SettingsCard, SettingsGroup, SettingsRow, settingsFieldClass } from '../primitives'
import { ModelManagementSectionProps } from './types'

const tagClass = 'rounded bg-foreground/[0.05] px-1.5 py-px text-[11px] capitalize text-muted-foreground'

const providerIds = Object.keys(PROVIDER_DISPLAY_NAMES) as ModelProvider[]

export const ModelManagementSection = ({
  disabledModels,
  disabledProviders,
  showOnlyAvailable,
  keyProviders,
  onToggleModel,
  onToggleProvider,
  onToggleShowOnlyAvailable,
}: ModelManagementSectionProps) => {
  const access = { isSignedIn: true, keyProviders }
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
    <div className="space-y-5">
      <SettingsCard>
        <SettingsRow
          htmlFor="models-show-only-available"
          label="Show only available models"
          description="Hide models you can't use yet, such as ones that need an API key you haven't added."
        >
          <Switch
            id="models-show-only-available"
            checked={showOnlyAvailable}
            onCheckedChange={onToggleShowOnlyAvailable}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsGroup
        title="Providers"
        description="Turn a provider off to hide all of its models. If everything is hidden, the picker keeps one free model so you can always chat."
      >
        <SettingsCard>
          {providerIds.map((provider) => {
            const providerModels = models.filter((model) => model.provider === provider)
            if (providerModels.length === 0) return null
            const usable = providerModels.filter((model) => isModelUsable(model, access)).length
            const isEnabled = !disabledProviders.includes(provider)
            const switchId = `provider-toggle-${provider}`
            return (
              <SettingsRow
                key={provider}
                htmlFor={switchId}
                className={cn('transition-opacity', !isEnabled && 'opacity-55')}
                label={getProviderDisplayName(provider)}
                description={
                  usable === 0
                    ? `${providerModels.length} models · needs your API key`
                    : usable < providerModels.length
                      ? `${providerModels.length} models · ${usable} available`
                      : `${providerModels.length} models`
                }
              >
                <Switch
                  id={switchId}
                  checked={isEnabled}
                  onCheckedChange={(checked) => onToggleProvider(provider, checked)}
                  aria-label={`${isEnabled ? 'Hide' : 'Show'} ${getProviderDisplayName(provider)} models`}
                />
              </SettingsRow>
            )
          })}
        </SettingsCard>
      </SettingsGroup>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Choose which models appear in the model picker. Disabled models are hidden everywhere.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search models"
              placeholder="Search models"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className={cn(settingsFieldClass, 'pl-8')}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGroupBy(groupBy === 'provider' ? 'vendor' : 'provider')}
            className="shrink-0 text-xs"
            aria-label={`Group by ${groupBy === 'provider' ? 'vendor' : 'provider'}`}
          >
            By {groupBy}
          </Button>
        </div>
      </div>

      {Object.entries(sortedGroupedModels).map(([groupKey, groupModels]) => (
        <SettingsGroup
          key={groupKey}
          title={
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 rounded-full bg-gradient-to-r',
                  getVendorColor(groupBy === 'provider' ? groupModels[0]?.vendor || groupKey : groupKey),
                )}
              />
              <span className="capitalize">{groupBy === 'provider' ? getProviderDisplayName(groupKey) : groupKey}</span>
              <span className="font-normal text-muted-foreground">{groupModels.length}</span>
            </span>
          }
        >
          <SettingsCard>
            {groupModels.map((model) => {
              const providerOff = disabledProviders.includes(model.provider)
              const unavailableHidden = showOnlyAvailable && !isModelUsable(model, access)
              const isEnabled = !disabledModels.includes(model.id)
              const isShown = isEnabled && !providerOff && !unavailableHidden
              const switchId = `model-toggle-${model.id}`
              return (
                <div key={model.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <label
                    htmlFor={switchId}
                    className={cn('min-w-0 flex-1 cursor-pointer transition-opacity', !isShown && 'opacity-55')}
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-sm text-foreground">{model.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{model.description}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {/* Features in consistent order: web, vision, code, imagegen */}
                      {(['web', 'vision', 'code', 'imagegen'] as const).map(
                        (feature) =>
                          model.features.includes(feature) && (
                            <span key={feature} className={tagClass}>
                              {feature}
                            </span>
                          ),
                      )}
                      {model.supportsThinking && <span className={tagClass}>thinking</span>}
                      {model.isFree && <span className={tagClass}>free · daily limits</span>}
                      {model.isApiKeyOnly && (
                        <span className="rounded px-1.5 py-px text-[11px] text-amber-700 bg-amber-500/10 dark:text-amber-400">
                          API key required
                        </span>
                      )}
                      {isEnabled && providerOff && <span className={tagClass}>provider off</span>}
                      {isEnabled && !providerOff && unavailableHidden && <span className={tagClass}>hidden</span>}
                    </span>
                  </label>
                  <Switch
                    id={switchId}
                    checked={isEnabled}
                    onCheckedChange={(checked) => onToggleModel(model.id, checked)}
                    disabled={model.id === DEFAULT_MODEL_ID}
                    aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${model.name}`}
                  />
                </div>
              )
            })}
          </SettingsCard>
        </SettingsGroup>
      ))}

      {filteredModels.length === 0 && searchFilter && (
        <p className="py-8 text-center text-sm text-muted-foreground">No models match “{searchFilter}”</p>
      )}
    </div>
  )
}
