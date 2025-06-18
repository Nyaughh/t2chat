'use client'

import { useEffect, useState } from 'react'

type Font = 'inter' | 'system' | 'serif' | 'mono' | 'roboto-slab'
type CodeFont = 'fira-code' | 'mono' | 'consolas' | 'jetbrains' | 'source-code-pro'

export function useFont() {
  const [mainFont, setMainFont] = useState<Font>('inter')
  const [codeFont, setCodeFont] = useState<CodeFont>('fira-code')

  useEffect(() => {
    const storedMainFont = localStorage.getItem('mainFont') as Font | null
    const storedCodeFont = localStorage.getItem('codeFont') as CodeFont | null

    if (storedMainFont) {
      setMainFont(storedMainFont)
    }
    if (storedCodeFont) {
      setCodeFont(storedCodeFont)
    }
  }, [])

  useEffect(() => {
    document.body.classList.remove('font-sans', 'font-serif', 'font-mono', 'font-roboto-slab')
    switch (mainFont) {
      case 'system':
        document.body.classList.add('font-sans')
        break
      case 'serif':
        document.body.classList.add('font-serif')
        break
      case 'mono':
        document.body.classList.add('font-mono')
        break
      case 'roboto-slab':
        document.body.classList.add('font-roboto-slab')
        break
      default:
        document.body.classList.add('font-sans')
    }
    localStorage.setItem('mainFont', mainFont)
  }, [mainFont])

  useEffect(() => {
    const codeElements = document.querySelectorAll('code, pre, kbd')
    codeElements.forEach((el) => {
      el.classList.remove('font-fira-code', 'font-mono', 'font-consolas', 'font-jetbrains', 'font-source-code-pro')
      switch (codeFont) {
        case 'fira-code':
          el.classList.add('font-fira-code')
          break
        case 'mono':
          el.classList.add('font-mono')
          break
        case 'consolas':
          el.classList.add('font-consolas')
          break
        case 'jetbrains':
          el.classList.add('font-jetbrains')
          break
        case 'source-code-pro':
          el.classList.add('font-source-code-pro')
          break
        default:
          el.classList.add('font-fira-code')
      }
    })
    localStorage.setItem('codeFont', codeFont)
  }, [codeFont])

  return { mainFont, setMainFont, codeFont, setCodeFont }
}
