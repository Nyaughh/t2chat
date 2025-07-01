'use client'

import { useEffect, useState } from 'react'
import Cookies from 'js-cookie'

type Font = 'inter' | 'system' | 'serif' | 'mono' | 'roboto-slab'
type CodeFont = 'fira-code' | 'mono' | 'consolas' | 'jetbrains' | 'source-code-pro'

export function useFont(initialMainFont: Font = 'inter', initialCodeFont: CodeFont = 'fira-code') {
  const [mainFont, setMainFont] = useState<Font>(initialMainFont)
  const [codeFont, setCodeFont] = useState<CodeFont>(initialCodeFont)

  useEffect(() => {
    Cookies.set('mainFont', mainFont, { expires: 365 })
  }, [mainFont])

  useEffect(() => {
    Cookies.set('codeFont', codeFont, { expires: 365 })
  }, [codeFont])

  return { mainFont, setMainFont, codeFont, setCodeFont }
}
