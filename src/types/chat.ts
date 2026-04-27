export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  imageUri?: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
  isSynced: boolean;
  syncedAt: number | null;
}
