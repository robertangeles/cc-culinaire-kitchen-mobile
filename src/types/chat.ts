export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  /**
   * Per-conversation language override (BCP 47 code, e.g. 'en', 'fr').
   * NULL means "follow the user's current i18nStore.language" — see
   * `useEffectiveLanguage(conversationId)` in conversationStore.
   */
  language: string | null;
  createdAt: number;
  updatedAt: number;
  isSynced: boolean;
  syncedAt: number | null;
}
