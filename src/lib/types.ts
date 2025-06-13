import type { CoreMessage } from 'ai';

type UserMetadata = {
  name?: string | null
  email?: string | null
  image?: string | null
}

export type Attachment = {
  type: 'image' | 'pdf' | 'text';
  name: string;
  content: string; // base64 encoded for images/pdfs, raw for text
};

export type ToolInvocation = {
  toolName: string;
  args: any;
};

export type ClientMessage = CoreMessage & {
  id: string;
  attachments?: Attachment[];
  toolInvocations?: ToolInvocation[];
  thinking?: string;
  thinkingDuration?: number;
}

export type Message = ClientMessage;

export type { UserMetadata }
