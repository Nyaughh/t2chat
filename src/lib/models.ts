import { cn } from './utils'

export type ModelProvider = 'gemini' | 'openrouter' | 'groq' | 'anthropic' | 'openai'

/** Providers whose models only run on the user's own API key (there is no server key for them). */
export const USER_KEY_ONLY_PROVIDERS: readonly ModelProvider[] = ['anthropic', 'openai']

/** Providers whose models are only offered to users who added their own key for that provider. */
const KEY_GATED_PROVIDERS: readonly ModelProvider[] = ['openrouter', ...USER_KEY_ONLY_PROVIDERS]

/** Free model every visitor (signed in or not) can use. It can't be disabled. */
export const DEFAULT_MODEL_ID = 'gemini-3.5-flash-lite'

/** Server-side model used for chat title generation. */
export const TITLE_MODEL_ID = 'gemini-3.5-flash-lite'

/** Gemini model used by the image generation tool. */
export const IMAGE_GENERATION_MODEL_ID = 'gemini-3.1-flash-image'

export const PROVIDER_DISPLAY_NAMES: Record<ModelProvider, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
}

export const getProviderDisplayName = (provider: string): string =>
  PROVIDER_DISPLAY_NAMES[provider as ModelProvider] ?? provider

export interface ModelInfo {
  id: string
  name: string
  description: string
  provider: ModelProvider
  vendor: 'google' | 'anthropic' | 'openai' | 'deepseek' | 'meta' | 'sarvam' | 'qwen' | 'moonshot' | 'xai'
  features: ('vision' | 'web' | 'code' | 'imagegen')[]
  isPro?: boolean
  isNew?: boolean
  /** The model streams visible reasoning ("thinking") that the UI shows separately. */
  supportsThinking?: boolean
  unauthenticated?: boolean
  attachmentsSuppport: {
    pdf: boolean
    image: boolean
  }
  isApiKeyOnly?: boolean
  toolCalls?: boolean
  isFree?: boolean
}

const allAttachments = { pdf: true, image: true }
const imageOnly = { pdf: false, image: true }
const noAttachments = { pdf: false, image: false }

const modelList: ModelInfo[] = [
  // Gemini: server key, or the user's own Gemini key when they add one
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    description: 'Fast, lightweight model for everyday tasks',
    provider: 'gemini',
    vendor: 'google',
    features: ['vision', 'web', 'code'],
    supportsThinking: false,
    unauthenticated: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
    isFree: true,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Fast multimodal model with tools',
    provider: 'gemini',
    vendor: 'google',
    features: ['vision', 'web', 'code', 'imagegen'],
    isNew: true,
    supportsThinking: false,
    isApiKeyOnly: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    description: 'Most capable Gemini model for complex tasks',
    provider: 'gemini',
    vendor: 'google',
    features: ['vision', 'web', 'code', 'imagegen'],
    isPro: true,
    isNew: true,
    supportsThinking: true,
    isApiKeyOnly: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini 4 Hydrogen',
    description: 'Gemini 4 model for deep reasoning',
    provider: 'gemini',
    vendor: 'google',
    features: ['vision', 'web', 'code', 'imagegen'],
    isPro: true,
    isNew: true,
    supportsThinking: true,
    isApiKeyOnly: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },

  // Groq: server key, or the user's own Groq key when they add one
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    description: 'Open-weight reasoning model via Groq',
    provider: 'groq',
    vendor: 'openai',
    features: ['web', 'code'],
    supportsThinking: true,
    attachmentsSuppport: noAttachments,
    toolCalls: true,
    isFree: true,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    description: 'Fast open-weight reasoning model via Groq',
    provider: 'groq',
    vendor: 'openai',
    features: ['web', 'code'],
    // GPT-OSS on Groq always returns its reasoning, so it is a thinking model
    supportsThinking: true,
    attachmentsSuppport: noAttachments,
    toolCalls: true,
    isFree: true,
  },
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    description: 'Open-weight reasoning model via Groq',
    provider: 'groq',
    vendor: 'qwen',
    features: ['web', 'code'],
    supportsThinking: true,
    attachmentsSuppport: noAttachments,
    toolCalls: true,
    isFree: true,
  },

  // Anthropic: the user's own Anthropic API key
  {
    id: 'claude-opus-5-5',
    name: 'Claude Opus 5.5',
    description: 'Uses your Anthropic key. Most capable Opus model',
    provider: 'anthropic',
    vendor: 'anthropic',
    features: ['vision', 'web', 'code', 'imagegen'],
    isPro: true,
    isNew: true,
    supportsThinking: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },
  {
    id: 'claude-sonnet-5-5',
    name: 'Claude Sonnet 5.5',
    description: 'Uses your Anthropic key. Fast and capable',
    provider: 'anthropic',
    vendor: 'anthropic',
    features: ['vision', 'web', 'code', 'imagegen'],
    isNew: true,
    supportsThinking: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },
  {
    id: 'claude-haiku-5-5',
    name: 'Claude Haiku 5.5',
    description: 'Uses your Anthropic key. Fastest Claude model',
    provider: 'anthropic',
    vendor: 'anthropic',
    features: ['vision', 'web', 'code', 'imagegen'],
    isNew: true,
    supportsThinking: false,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },
  {
    id: 'claude-fable-5-2',
    name: 'Claude Fable 5.2',
    description: "Uses your Anthropic key. Anthropic's most capable model",
    provider: 'anthropic',
    vendor: 'anthropic',
    features: ['vision', 'web', 'code', 'imagegen'],
    isPro: true,
    isNew: true,
    supportsThinking: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },

  // OpenAI: the user's own OpenAI API key
  {
    id: 'gpt-6.2-astra',
    name: 'GPT-6.2 Astra',
    description: 'Uses your OpenAI key. Most capable GPT model',
    provider: 'openai',
    vendor: 'openai',
    features: ['vision', 'web', 'code', 'imagegen'],
    isPro: true,
    isNew: true,
    supportsThinking: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },
  {
    id: 'gpt-6.2-sol',
    name: 'GPT-6.2 Sol',
    description: 'Uses your OpenAI key. Balanced speed and capability',
    provider: 'openai',
    vendor: 'openai',
    features: ['vision', 'web', 'code', 'imagegen'],
    isNew: true,
    supportsThinking: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },
  {
    id: 'gpt-6.1-terra',
    name: 'GPT-6.1 Terra',
    description: 'Uses your OpenAI key. Fast and affordable',
    provider: 'openai',
    vendor: 'openai',
    features: ['vision', 'web', 'code', 'imagegen'],
    supportsThinking: false,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },
  {
    id: 'gpt-6-luna',
    name: 'GPT-6 Luna',
    description: 'Uses your OpenAI key. Fastest GPT model',
    provider: 'openai',
    vendor: 'openai',
    features: ['vision', 'web', 'code'],
    supportsThinking: false,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },

  // OpenRouter: offered to users with their own OpenRouter key (server key is the fallback)
  {
    id: 'anthropic/claude-sonnet-5.5',
    name: 'Claude Sonnet 5.5',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'anthropic',
    features: ['vision', 'web', 'code', 'imagegen'],
    supportsThinking: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },
  {
    id: 'openai/gpt-6.2-sol',
    name: 'GPT-6.2 Sol',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'openai',
    features: ['vision', 'web', 'code', 'imagegen'],
    supportsThinking: true,
    attachmentsSuppport: allAttachments,
    toolCalls: true,
  },
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'deepseek',
    features: ['web', 'code'],
    supportsThinking: true,
    attachmentsSuppport: noAttachments,
    toolCalls: true,
  },
  {
    id: 'deepseek/deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'deepseek',
    features: ['vision', 'web', 'code'],
    supportsThinking: false,
    attachmentsSuppport: imageOnly,
    toolCalls: true,
  },
  {
    id: 'moonshotai/kimi-k3.1-pro',
    name: 'Kimi K3.1 Pro',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'moonshot',
    features: ['vision', 'web', 'code'],
    supportsThinking: true,
    attachmentsSuppport: imageOnly,
    toolCalls: true,
  },
  {
    id: 'qwen/qwen4-max',
    name: 'Qwen4 Max',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'qwen',
    features: ['vision', 'web', 'code'],
    supportsThinking: true,
    attachmentsSuppport: imageOnly,
    toolCalls: true,
  },
  {
    id: 'x-ai/grok-4.7',
    name: 'Grok 4.7',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'xai',
    features: ['vision', 'web', 'code'],
    supportsThinking: true,
    attachmentsSuppport: imageOnly,
    toolCalls: true,
  },
]

export const models: ModelInfo[] = modelList.map((model) => {
  const keyGated = KEY_GATED_PROVIDERS.includes(model.provider)
  return {
    ...model,
    isApiKeyOnly: model.isApiKeyOnly || keyGated,
    isFree: keyGated ? false : model.isFree,
  }
})

/**
 * Groq reasoning options (https://console.groq.com/docs/reasoning). GPT-OSS
 * returns its reasoning by default and doesn't accept reasoning_format; Qwen 3.8
 * only returns reasoning when an effort other than "default" is set.
 */
export const groqReasoningOptions = (model: ModelInfo) =>
  model.provider === 'groq' && model.supportsThinking && !model.id.startsWith('openai/gpt-oss')
    ? { reasoningFormat: 'parsed' as const, reasoningEffort: 'medium' as const }
    : undefined

/**
 * Models voice chat can use. Voice goes through /api/chat, which only has the
 * server keys, so models that need the user's own key are excluded. The first
 * entry is the default model.
 */
export const voiceModels: ModelInfo[] = models.filter((model) => !model.isApiKeyOnly)

export const getVendorColor = (vendor: string): string => {
  const getFullBgColor = (rest: string) => {
    return cn('bg-gradient-to-r', rest)
  }
  const model = models.find((m) => m.id === vendor)
  if (model) {
    return getVendorColor(model.vendor)
  }
  switch (vendor) {
    case 'google':
    case 'gemini':
      return getFullBgColor('from-blue-500 to-purple-500')
    case 'anthropic':
    case 'claude':
      return getFullBgColor('from-purple-500 to-pink-500')
    case 'openai':
    case 'gpt':
      return getFullBgColor('from-green-500 to-teal-500')
    case 'deepseek':
      return getFullBgColor('from-cyan-500 to-blue-500')
    case 'meta':
    case 'llama':
      return getFullBgColor('from-indigo-500 to-blue-500')
    case 'o-series':
      return getFullBgColor('from-orange-500 to-red-500')
    case 'sarvam':
      return getFullBgColor('from-yellow-500 to-orange-500')
    case 'qwen':
      return getFullBgColor('from-violet-500 to-indigo-500')
    case 'moonshot':
      return getFullBgColor('from-slate-500 to-zinc-600')
    case 'xai':
      return getFullBgColor('from-zinc-600 to-neutral-800')
    case 'openrouter':
      return getFullBgColor('from-blue-500 to-green-500')
    default:
      return getFullBgColor('from-gray-500 to-gray-600')
  }
}

export const getProviderColor = (modelId?: string) => {
  if (!modelId) return 'bg-gray-500'

  const model = models.find((m) => m.id === modelId)

  if (!model) return 'bg-gray-500'

  switch (model.provider) {
    case 'gemini':
      return 'bg-red-500'
    case 'openrouter':
      return 'bg-blue-500'
    case 'groq':
      return 'bg-yellow-500'
    case 'anthropic':
      return 'bg-orange-500'
    case 'openai':
      return 'bg-emerald-500'
    default:
      return 'bg-gray-500'
  }
}

export const getModelDisplayName = (modelId?: string) => {
  if (!modelId) return null
  const model = models.find((m) => m.id === modelId)
  return model?.name || modelId
}
