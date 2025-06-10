import { Id } from '../../convex/_generated/dataModel'

export type Message = {
  _id: Id<'messages'> | string // string for unauthenticated
  _creationTime: number | Date // Date for unauthenticated
  userId?: Id<'users'>
  content: string
  role: 'user' | 'assistant'
  attachments?: any[]
} 