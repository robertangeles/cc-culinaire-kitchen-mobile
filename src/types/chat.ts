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
  /**
   * Whether the local SQLite mirror is in sync with the backend
   * conversation API. After the 2026-06-15 backend-chat pivot, the
   * backend is the source of truth; `isSynced` is false whenever a
   * write-through to the backend failed (offline) and the row still
   * needs to be pushed.
   */
  isSynced: boolean;
  syncedAt: number | null;
}

/**
 * A chat message as sent to `POST /api/chat`. The backend is stateless per
 * request — it needs the full prior turn history. Only `user`/`assistant`
 * roles are accepted by the server (the `system` role is injected
 * server-side and rejected from the client per api-contracts.md Endpoint E).
 */
export interface ChatWireMessage {
  role: 'user' | 'assistant';
  content: string;
}
