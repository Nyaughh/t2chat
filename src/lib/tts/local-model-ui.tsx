'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import {
  cancelLocalDownload,
  getLocalModelState,
  isLocalModelAvailable,
  LOCAL_MODEL,
  subscribeLocalModel,
  type LocalModelState,
} from './local-model'

const SERVER_STATE: LocalModelState = { state: 'unknown' }

/** The on-device model's state; checks the browser cache on first use. */
export function useLocalModel() {
  const model = useSyncExternalStore(subscribeLocalModel, getLocalModelState, () => SERVER_STATE)
  useEffect(() => {
    if (model.state === 'unknown') void isLocalModelAvailable()
  }, [model.state])
  return model
}

export const formatMB = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`
export const MODEL_SIZE = formatMB(LOCAL_MODEL.bytes)

/** A thin progress bar with bytes, percent and a Cancel link. */
export function DownloadProgress({ model, className }: { model: LocalModelState; className?: string }) {
  const loaded = model.state === 'downloading' ? model.loaded : 0
  const total = model.state === 'downloading' && model.total > 0 ? model.total : LOCAL_MODEL.bytes
  const percent = Math.min(100, Math.round((loaded / total) * 100))
  return (
    <div className={cn('w-full', className)}>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-foreground/10"
        role="progressbar"
        aria-label="Downloading the voice model"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-rose-500 transition-[width] duration-200 ease-out dark:bg-rose-400"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {formatMB(loaded)} of {formatMB(total)} · {percent}%
        </span>
        <button
          type="button"
          onClick={cancelLocalDownload}
          className="cursor-pointer rounded px-1 font-medium text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
