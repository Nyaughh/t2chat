import { UIMessage } from 'ai';
import Dexie, { type EntityTable } from 'dexie';

interface Conversation {
  id: string;
  userId?: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

interface DBMessage {
  id: string;
  conversationId: string;
  parts: UIMessage['parts'];
  content: string;
  role: 'user' | 'assistant' | 'system' | 'data';
  createdAt: Date;
}

const db = new Dexie('t2Chat') as Dexie & {
  conversations: EntityTable<Conversation, 'id'>;
  messages: EntityTable<DBMessage, 'id'>;
};

db.version(1).stores({
  conversations: 'id, userId, title, updatedAt, lastMessageAt',
  messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
});

export type { Conversation, DBMessage };
export { db };