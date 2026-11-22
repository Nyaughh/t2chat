'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { Options } from 'react-markdown'

type PluggableList = NonNullable<Options['remarkPlugins']>

type MathPlugins = { remark: PluggableList; rehype: PluggableList }

let plugins: MathPlugins | null = null
let promise: Promise<void> | null = null
const listeners = new Set<() => void>()

function load() {
  if (!promise) {
    promise = import('./math-plugins')
      .then((m) => {
        plugins = {
          remark: [m.remarkMathPlugin as unknown as PluggableList[number]],
          rehype: [m.rehypeKatexPlugin as unknown as PluggableList[number]],
        }
        listeners.forEach((l) => l())
      })
      .catch(() => {
        // Math stays as plain text; allow a retry on the next block that needs it.
        promise = null
      })
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
const getSnapshot = () => plugins

/** The math plugins once loaded, or null. Starts loading when `needed`. */
export function useMathPlugins(needed: boolean): MathPlugins | null {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => null)
  useEffect(() => {
    if (needed && !plugins) load()
  }, [needed])
  return needed ? current : null
}
