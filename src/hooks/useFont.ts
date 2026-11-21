'use client'

import { useAppearance } from '@/components/theme/AppearanceProvider'
import type { CodeFontId, FontId } from '@/lib/theme/appearance'

/**
 * Main and code font, backed by the appearance engine (src/lib/theme).
 * Changes apply live and persist like every other appearance setting.
 *
 * The arguments are accepted for backward compatibility and ignored: the
 * font now comes from saved preferences, not from server-read cookies.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useFont(_initialMainFont?: string, _initialCodeFont?: string) {
  const [appearance, update] = useAppearance()
  return {
    mainFont: appearance.font,
    setMainFont: (font: FontId) => update({ font }),
    codeFont: appearance.codeFont,
    setCodeFont: (codeFont: CodeFontId) => update({ codeFont }),
  }
}
