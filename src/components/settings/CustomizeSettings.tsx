import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X, User, Sparkles, Palette, Zap, SendHorizonal, ArrowUp, MessageCircle, ChevronRight } from 'lucide-react'
import { useFont } from '@/hooks/useFont'

// Define Customization type
export type CustomizationState = {
  userName: string
  userRole: string
  userTraits: string[]
  userAdditionalInfo: string
  promptTemplate: string
  mainFont: 'inter' | 'system' | 'serif' | 'mono' | 'roboto-slab'
  codeFont: 'fira-code' | 'mono' | 'consolas' | 'jetbrains' | 'source-code-pro'
  sendBehavior: 'enter' | 'shiftEnter' | 'button'
  autoSave: boolean
  showTimestamps: boolean
}

const CustomizationInput = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  isTextArea = false,
  rows = 3,
}: {
  id: string
  label: string
  value: string
  onChange: (e: any) => void
  placeholder: string
  isTextArea?: boolean
  rows?: number
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
      {label}
    </label>
    {isTextArea ? (
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-rose-500 dark:focus:ring-rose-400 focus:border-rose-500 dark:focus:border-rose-400 outline-none resize-y"
      />
    ) : (
      <input
        type="text"
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-rose-500 dark:focus:ring-rose-400 focus:border-rose-500 dark:focus:border-rose-400 outline-none"
      />
    )}
  </div>
)

const CustomizationSelect = ({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (e: any) => void
  children: React.ReactNode
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
      {label}
    </label>
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="w-full appearance-none bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md pl-3 pr-8 py-1.5 text-sm focus:ring-1 focus:ring-rose-500 dark:focus:ring-rose-400 focus:border-rose-500 dark:focus:border-rose-400 outline-none"
      >
        {children}
      </select>
      <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 dark:text-white/40 pointer-events-none" />
    </div>
  </div>
)

const CustomizationRadio = ({
  name,
  value,
  checked,
  onChange,
  label,
  icon: Icon,
}: {
  name: string
  value: string
  checked: boolean
  onChange: (e: any) => void
  label: string
  icon: React.ElementType
}) => (
  <label
    className={cn(
      'flex items-center gap-2 p-2 rounded-md cursor-pointer border transition-colors',
      checked
        ? 'bg-rose-500/10 border-rose-500/30'
        : 'bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10',
    )}
  >
    <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
    <Icon
      className={cn('w-4 h-4', checked ? 'text-rose-600 dark:text-rose-400' : 'text-black/60 dark:text-white/60')}
    />
    <span
      className={cn(
        'text-sm',
        checked ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-black/80 dark:text-white/80',
      )}
    >
      {label}
    </span>
  </label>
)

const CustomizationFontRadio = ({
  name,
  value,
  checked,
  onChange,
  label,
  fontClass,
}: {
  name: string
  value: string
  checked: boolean
  onChange: (e: any) => void
  label: string
  fontClass: string
}) => (
  <label
    className={cn(
      'flex items-center justify-center p-2 rounded-md cursor-pointer border transition-colors text-center',
      checked
        ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
        : 'bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10',
    )}
  >
    <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
    <span className={cn('text-sm font-semibold', fontClass)}>{label}</span>
  </label>
)

export function CustomizeSettings({ customization }: { customization: CustomizationState }) {
  const { mainFont, setMainFont, codeFont, setCodeFont } = useFont()
  const [localCustomization, setLocalCustomization] = useState<CustomizationState>({
    ...customization,
    mainFont,
    codeFont,
  })
  const [traitInput, setTraitInput] = useState('')

  useEffect(() => {
    setLocalCustomization(prev => ({...prev, mainFont, codeFont}))
  }, [mainFont, codeFont])

  const handleAddTrait = () => {
    if (traitInput && !localCustomization.userTraits.includes(traitInput)) {
      setLocalCustomization((prev) => ({ ...prev, userTraits: [...prev.userTraits, traitInput] }))
      setTraitInput('')
    }
  }

  const handleTraitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTrait()
    }
  }

  const handleRemoveTrait = (index: number) => {
    setLocalCustomization((prev) => ({
      ...prev,
      userTraits: prev.userTraits.filter((_, i) => i !== index),
    }))
  }

  const handleMainFontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFont = e.target.value as 'inter' | 'system' | 'serif' | 'mono' | 'roboto-slab';
    setMainFont(newFont);
  }

  const handleCodeFontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFont = e.target.value as 'fira-code' | 'mono' | 'consolas' | 'jetbrains' | 'source-code-pro';
    setCodeFont(newFont);
  }

  const getMainFontPreviewClass = (font: 'inter' | 'system' | 'serif' | 'mono' | 'roboto-slab') => {
    if (font === 'inter' || font === 'system') return 'font-sans';
    return `font-${font}`;
  }

  return (
    <div className="space-y-8">
      {/* User Personalization Section */}
      <div>
        <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 flex items-center gap-2 mb-2">
          <User className="w-5 h-5" />
          User Personalization
        </h3>
        <div className="space-y-4 p-4 rounded-lg bg-black/5 dark:bg-white/5">
          <CustomizationInput
            id="userName"
            label="Your Name"
            value={localCustomization.userName}
            onChange={(e) => setLocalCustomization({ ...localCustomization, userName: e.target.value })}
            placeholder="e.g., Jane Doe"
          />
          <CustomizationInput
            id="userRole"
            label="Your Role/Profession"
            value={localCustomization.userRole}
            onChange={(e) => setLocalCustomization({ ...localCustomization, userRole: e.target.value })}
            placeholder="e.g., Software Engineer, Student, etc."
          />
          <div>
            <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
              Your Interests/Traits
            </label>
            <div className="flex flex-wrap gap-2">
              {localCustomization.userTraits.map((trait, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:bg-rose-300/10 dark:text-rose-300 rounded-full pl-2 pr-1 py-0.5 text-xs"
                >
                  <span>{trait}</span>
                  <button
                    onClick={() => handleRemoveTrait(index)}
                    className="text-rose-600/70 dark:text-rose-300/70 hover:text-rose-600 dark:hover:text-rose-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="relative mt-2">
              <input
                type="text"
                value={traitInput}
                onChange={(e) => setTraitInput(e.target.value)}
                onKeyDown={handleTraitKeyDown}
                placeholder="Add a trait and press Enter..."
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-rose-500 dark:focus:ring-rose-400 focus:border-rose-500 dark:focus:border-rose-400 outline-none"
              />
              <button
                onClick={handleAddTrait}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 disabled:opacity-50"
                disabled={!traitInput}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
          <CustomizationInput
            id="userAdditionalInfo"
            label="Additional Information"
            value={localCustomization.userAdditionalInfo}
            onChange={(e) => setLocalCustomization({ ...localCustomization, userAdditionalInfo: e.target.value })}
            placeholder="Anything else you want the AI to know about you?"
            isTextArea
          />
        </div>
      </div>

      {/* Prompt Template Section */}
      <div>
        <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5" />
          Prompt Template
        </h3>
        <div className="p-4 rounded-lg bg-black/5 dark:bg-white/5">
          <CustomizationInput
            id="promptTemplate"
            label="System Prompt"
            value={localCustomization.promptTemplate}
            onChange={(e) => setLocalCustomization({ ...localCustomization, promptTemplate: e.target.value })}
            placeholder="e.g., You are a helpful and friendly assistant. Always respond in Markdown."
            isTextArea
            rows={5}
          />
        </div>
      </div>

      {/* Visual Options Section */}
      <div>
        <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 flex items-center gap-2 mb-2">
          <Palette className="w-5 h-5" />
          Visual Appearance
        </h3>
        <div className="space-y-4 p-4 rounded-lg bg-black/5 dark:bg-white/5">
          <div>
            <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-2">
              Main Font
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <CustomizationFontRadio
                name="mainFont"
                value="inter"
                checked={localCustomization.mainFont === 'inter'}
                onChange={handleMainFontChange}
                label="Inter"
                fontClass="font-sans"
              />
              <CustomizationFontRadio
                name="mainFont"
                value="system"
                checked={localCustomization.mainFont === 'system'}
                onChange={handleMainFontChange}
                label="System"
                fontClass="font-sans"
              />
              <CustomizationFontRadio
                name="mainFont"
                value="serif"
                checked={localCustomization.mainFont === 'serif'}
                onChange={handleMainFontChange}
                label="Serif"
                fontClass="font-serif"
              />
              <CustomizationFontRadio
                name="mainFont"
                value="mono"
                checked={localCustomization.mainFont === 'mono'}
                onChange={handleMainFontChange}
                label="Mono"
                fontClass="font-mono"
              />
              <CustomizationFontRadio
                name="mainFont"
                value="roboto-slab"
                checked={localCustomization.mainFont === 'roboto-slab'}
                onChange={handleMainFontChange}
                label="Roboto Slab"
                fontClass="font-roboto-slab"
              />
            </div>
            <div className="mt-2 p-3 rounded-lg bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/5">
              <p className={cn("text-base", getMainFontPreviewClass(localCustomization.mainFont))}>
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-2">
              Code Font
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <CustomizationFontRadio
                name="codeFont"
                value="fira-code"
                checked={localCustomization.codeFont === 'fira-code'}
                onChange={handleCodeFontChange}
                label="Fira Code"
                fontClass="font-mono"
              />
              <CustomizationFontRadio
                name="codeFont"
                value="mono"
                checked={localCustomization.codeFont === 'mono'}
                onChange={handleCodeFontChange}
                label="System Mono"
                fontClass="font-mono"
              />
              <CustomizationFontRadio
                name="codeFont"
                value="consolas"
                checked={localCustomization.codeFont === 'consolas'}
                onChange={handleCodeFontChange}
                label="Consolas"
                fontClass="font-mono"
              />
              <CustomizationFontRadio
                name="codeFont"
                value="jetbrains"
                checked={localCustomization.codeFont === 'jetbrains'}
                onChange={handleCodeFontChange}
                label="JetBrains"
                fontClass="font-mono"
              />
              <CustomizationFontRadio
                name="codeFont"
                value="source-code-pro"
                checked={localCustomization.codeFont === 'source-code-pro'}
                onChange={handleCodeFontChange}
                label="Source Code Pro"
                fontClass="font-source-code-pro"
              />
            </div>
            <div className="mt-2 p-3 rounded-lg bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/5">
              <pre className="whitespace-pre-wrap"><code className={cn("text-sm", `font-${localCustomization.codeFont}`)}>
                {`function greet(name) {
  return \`Hello, \${name}!\`;
}`}
              </code></pre>
            </div>
          </div>
        </div>
      </div>

      {/* Behavior Section */}
      <div>
        <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5" />
          Behavior
        </h3>
        <div className="space-y-4 p-4 rounded-lg bg-black/5 dark:bg-white/5">
          <div>
            <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-2">
              Send Message on Enter
            </label>
            <div className="grid grid-cols-3 gap-2">
              <CustomizationRadio
                name="sendBehavior"
                value="enter"
                checked={localCustomization.sendBehavior === 'enter'}
                onChange={(e) => setLocalCustomization({ ...localCustomization, sendBehavior: e.target.value })}
                label="Enter"
                icon={SendHorizonal}
              />
              <CustomizationRadio
                name="sendBehavior"
                value="shiftEnter"
                checked={localCustomization.sendBehavior === 'shiftEnter'}
                onChange={(e) => setLocalCustomization({ ...localCustomization, sendBehavior: e.target.value })}
                label="Shift+Enter"
                icon={ArrowUp}
              />
              <CustomizationRadio
                name="sendBehavior"
                value="button"
                checked={localCustomization.sendBehavior === 'button'}
                onChange={(e) => setLocalCustomization({ ...localCustomization, sendBehavior: e.target.value })}
                label="Button Only"
                icon={MessageCircle}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="autoSave" className="block text-sm font-medium text-black/70 dark:text-white/70">
                Auto-save conversations
              </label>
              <p className="text-xs text-black/50 dark:text-white/50">Automatically save chat history.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="autoSave"
                className="sr-only peer"
                checked={localCustomization.autoSave}
                onChange={(e) => setLocalCustomization({ ...localCustomization, autoSave: e.target.checked })}
              />
              <div className="w-9 h-5 bg-black/20 peer-focus:outline-none rounded-full peer dark:bg-white/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-rose-500/70 dark:peer-checked:bg-rose-400/70"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="showTimestamps" className="block text-sm font-medium text-black/70 dark:text-white/70">
                Show message timestamps
              </label>
              <p className="text-xs text-black/50 dark:text-white/50">Display the time for each message.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="showTimestamps"
                className="sr-only peer"
                checked={localCustomization.showTimestamps}
                onChange={(e) => setLocalCustomization({ ...localCustomization, showTimestamps: e.target.checked })}
              />
              <div className="w-9 h-5 bg-black/20 peer-focus:outline-none rounded-full peer dark:bg-white/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-rose-500/70 dark:peer-checked:bg-rose-400/70"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
