import { type conversations, type messages } from './db/schema';

export type Message = typeof messages.$inferSelect;
export type Conversation = typeof conversations.$inferSelect & {
  messages: Message[];
}; 