export interface ModelInfo {
  id: string
  name: string
  description: string
  provider: 'gemini' | 'openrouter' | 'groq'
  category: 'google' | 'anthropic' | 'openai' | 'deepseek' | 'meta'
  features: ('vision' | 'web' | 'code')[]
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
    category: 'google',
    features: ['vision', 'code'],
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
    category: 'google',
    features: ['vision', 'web', 'code'],
    isPro: false,
    supportsThinking: false,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: false,
      image: true,
    },
    toolCalls: true
  },
  {
    id: 'gemini-2.0-flash-thinking-exp-01-21',
    name: 'Gemini 2.0 Flash Thinking',
    description: 'Thinking capabilities',
    provider: 'gemini',
    category: 'google',
    features: ['vision', 'code'],
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
    category: 'google',
    features: ['vision', 'web', 'code'],
    isPro: false,
    supportsThinking: false,
    unauthenticated: false,
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
    category: 'google',
    features: ['vision', 'web', 'code'],
    isPro: true,
    supportsThinking: true,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: true,
      image: true,
    },
    toolCalls: true
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    category: 'google',
    features: ['vision', 'web', 'code'],
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
    category: 'anthropic',
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
    category: 'openai',
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
    id: 'deepseek/deepseek-r1-0528-qwen3-8b',
    name: 'DeepSeek R1',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    category: 'deepseek',
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
    id: 'meta-llama/llama-4-maverick:free',
    name: 'Llama 4 Maverick',
    description: 'Via OpenRouter',
    provider: 'openrouter',
    category: 'meta',
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
    category: 'google',
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
    category: 'meta',
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
    category: 'deepseek',
    features: ['code'],
    isPro: false,
    supportsThinking: true,
    unauthenticated: false,
    attachmentsSuppport: {
      pdf: false,
      image: false,
    },
  },
]
