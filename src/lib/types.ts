import type { CoreMessage } from 'ai'
import type { Id } from '../../convex/_generated/dataModel'

export interface UserMetadata {
  name?: string
  email?: string
  image?: string
}

export interface Attachment {
  name: string
  type: string
  size: number
  url: string
}

export interface ClientMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'data'
  content: string
  thinking?: string
  thinkingDuration?: number
  toolCalls?: any[]
  createdAt: Date
}

// Server-side Convex types
export interface ConvexChat {
  _id: Id<'chats'>
  title: string
  createdAt: number
  updatedAt: number
}

export interface ConvexMessage {
  _id: Id<'messages'>
  chatId: Id<'chats'>
  role: 'user' | 'assistant'
  content: string
  modelId?: string
  thinking?: string
  thinkingDuration?: number
  isComplete?: boolean
  isCancelled?: boolean
  attachments?: Attachment[]
  createdAt: number
}

export type ToolInvocation = {
  toolName: string
  args: any
}

export type Message = ClientMessage
