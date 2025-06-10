import Dexie, { Table } from 'dexie'

export interface UnauthenticatedMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

export class T2ChatDexie extends Dexie {
  messages!: Table<UnauthenticatedMessage>

  constructor() {
    super('t2chat-unauthenticated')
    this.version(1).stores({
      messages: '++id, content, role, timestamp',
    })
  }
}

export const db = new T2ChatDexie() 