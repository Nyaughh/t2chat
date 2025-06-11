export interface ModelInfo {
    id: string
    name: string
    description: string
    provider: 'gemini' | 'openrouter'
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
  }
  
 export const models: ModelInfo[] = [
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      description: 'Latest and fastest model',
      provider: 'gemini',
      category: 'google',
      features: ['vision', 'web', 'code'],
      isPro: false,
      supportsThinking: true,
      unauthenticated: false,
      attachmentsSuppport: {
        pdf: true,
        image: true,
      },
    },
    {
      id: 'gemini-2.0-flash-lite',
      name: 'Gemini 2.0 Flash Lite',
      description: 'Lightweight version for quick tasks',
      provider: 'gemini',
      category: 'google',
      features: ['vision', 'code'],
      isPro: false,
      isNew: true,
      unauthenticated: true,
      attachmentsSuppport: {
        pdf: true,
        image: true,
      },
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Advanced reasoning capabilities',
      provider: 'gemini',
      category: 'google',
      features: ['vision', 'web', 'code'],
      isPro: false,
      supportsThinking: true,
      unauthenticated: false,
      attachmentsSuppport: {
        pdf: true,
        image: true,
      },
    },
    {
      id: 'gemini-2.5-pro',
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
    },
    {
      id: 'google/gemini-flash-1.5',
      name: 'Gemini Flash 1.5',
      description: 'Via OpenRouter',
      provider: 'openrouter',
      category: 'google',
      features: ['vision', 'web', 'code'],
      isPro: false,
      supportsThinking: true,
      unauthenticated: true,
      attachmentsSuppport: {
        pdf: true,
        image: true,
      },
    },
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Via OpenRouter',
      provider: 'openrouter',
      category: 'anthropic',
      features: ['vision', 'code'],
      isPro: false,
      supportsThinking: true,
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
      supportsThinking: true,
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
      supportsThinking: true,
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
      supportsThinking: true,
      unauthenticated: false,
      attachmentsSuppport: {
        pdf: true,
        image: true,
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
      unauthenticated: true,
      attachmentsSuppport: {
        pdf: true,
        image: true,
      },
    },
  ]
  