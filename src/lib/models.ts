import { tree } from 'next/dist/build/templates/app-page'
import { cn } from './utils'

export interface ModelInfo {
  id: string
  name: string
  description: string
  provider: 'gemini' | 'openrouter' | 'groq'
  vendor: 'google' | 'anthropic' | 'openai' | 'deepseek' | 'meta' | 'sarvam' | 'qwen'
  features: ('vision' | 'web' | 'code' | 'imagegen')[]
  isPro?: boolean
  isNew?: boolean
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

export const models: ModelInfo[] = [
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    description: 'Lightweight version for quick tasks',
    provider: 'gemini',
    vendor: 'google',
    features: [],
    isPro: false,
    isNew: true,
    supportsThinking: false,
    unauthenticated: true,
    attachmentsSuppport: {
      pdf: false,
      image: false,
    },
    isFree: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Latest and fastest model',
    provider: 'gemini',
    vendor: 'google',
    features: ['vision', 'web', 'code', 'imagegen'],
    isPro: false,
    supportsThinking: false,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: false,
      image: true,
    },
    toolCalls: true,
  },
  {
    id: 'gemini-2.0-flash-thinking-exp-01-21',
    name: 'Gemini 2.0 Flash Thinking',
    description: 'Thinking capabilities',
    provider: 'gemini',
    vendor: 'google',
    features: ['vision', 'code', 'imagegen'],
    isPro: false,
    supportsThinking: true,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: false,
      image: false,
    },
  },
  {
    id: 'gemini-2.5-flash-preview-04-17',
    name: 'Gemini 2.5 Flash',
    description: 'Advanced reasoning capabilities',
    provider: 'gemini',
    vendor: 'google',
    features: ['vision', 'web', 'code', 'imagegen'],
    isPro: false,
    supportsThinking: false,
    unauthenticated: false,
    isFree: true,
    attachmentsSuppport: {
      pdf: false,
      image: true,
    },
  },
  {
    id: 'gemini-2.5-pro-preview-05-06',
    name: 'Gemini 2.5 Pro',
    description: 'Most capable model for complex tasks',
    provider: 'gemini',
    vendor: 'google',
    features: ['vision', 'web', 'code', 'imagegen'],
    isPro: true,
    supportsThinking: false,
    unauthenticated: false,
    isApiKeyOnly: true,
    isFree: false,
    attachmentsSuppport: {
      pdf: true,
      image: true,
    },
    toolCalls: true,
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'google',
    features: ['vision', 'web', 'code', 'imagegen'],
    isPro: false,
    supportsThinking: false,
    unauthenticated: true,
    attachmentsSuppport: {
      pdf: true,
      image: true,
    },
    isFree: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'anthropic',
    features: ['vision', 'code'],
    isPro: false,
    supportsThinking: false,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: true,
      image: true,
    },
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'openai',
    features: ['vision', 'code'],
    isPro: false,
    supportsThinking: false,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: true,
      image: true,
    },
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek Chat V3',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'deepseek',
    features: ['imagegen'],
    isPro: false,
    supportsThinking: true,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: false,
      image: false,
    },
  },
  {
    id: 'meta-llama/llama-4-maverick:free',
    name: 'Llama 4 Maverick',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'meta',
    features: ['code'],
    isPro: false,
    supportsThinking: false,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: false,
      image: false,
    },
  },
  {
    id: 'sarvamai/sarvam-m:free',
    name: 'Sarvam M',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'sarvam',
    features: ['vision', 'web', 'code'],
    isPro: false,
    supportsThinking: false,
    unauthenticated: true,
    attachmentsSuppport: {
      pdf: false,
      image: false,
    },
    isFree: true,
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    description: 'Via Groq',
    provider: 'groq',
    vendor: 'meta',
    features: ['code'],
    isPro: false,
    supportsThinking: false,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: false,
      image: false,
    },
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill Llama 70B',
    description: 'Via Groq',
    provider: 'groq',
    vendor: 'deepseek',
    features: ['code', 'imagegen'],
    isPro: false,
    isFree: true,
    supportsThinking: true,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: false,
      image: false,
    },
  },
  {
    id: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
    name: 'DeepSeek R1 Qwen3 8B',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'deepseek',
    features: [],
    isPro: false,
    isFree: true,
    supportsThinking: true,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: false,
      image: false,
    },
    toolCalls: false,
  },
  {
    id: 'anthropic/claude-4-sonnet-20250522',
    name: 'Claude 4 Sonnet',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    vendor: 'anthropic',
    features: ['vision', 'code', 'imagegen', 'web'],
    isPro: true,
    isFree: false,
    supportsThinking: true,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: true,
      image: true,
    },
    toolCalls: true,
  },
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen 3.2B',
    description: 'Via Groq',
    provider: 'groq',
    vendor: 'qwen',
    features: ['code', 'imagegen'],
    isPro: false,
    isFree: true,
    supportsThinking: true,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: false,
      image: false,
    },
    toolCalls: false,
  },
].map((model) => {
  return {
    ...model,
    features: model.features.filter((feature) => !(feature === 'imagegen' && model.supportsThinking)),
    isApiKeyOnly: model.isApiKeyOnly || model.provider === 'openrouter',
    isFree: model.provider === 'openrouter' ? false : model.isFree,
  } as ModelInfo
})

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
    case 'qwen':
      return getFullBgColor('from-red-500 to-pink-500')
    case 'sarvam':
      return getFullBgColor('from-yellow-500 to-orange-500')
    case 'openrouter':
      return getFullBgColor('from-blue-500 to-green-500')
    case 'qwen':
      return getFullBgColor('from-red-500 to-pink-500')
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
    default:
      return 'bg-gray-500'
  }
}

export const getModelDisplayName = (modelId?: string) => {
  if (!modelId) return null
  const model = models.find((m) => m.id === modelId)
  return model?.name || modelId
}
