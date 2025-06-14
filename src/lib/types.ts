import type { CoreMessage } from 'ai';

type UserMetadata = {
  name?: string | null
  email?: string | null
  image?: string | null
}

export type Attachment = {
  name: string;
  type: string;
  size: number;
  url: string;
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
