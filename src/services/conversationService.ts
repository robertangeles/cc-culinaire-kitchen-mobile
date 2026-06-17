/**
 * conversationService — persistence client for `/api/conversations`
 * (api-contracts.md Endpoint F). After the 2026-06-15 backend-chat pivot
 * the web backend is the source of truth for conversation content; the
 * on-device SQLite store is a local mirror for offline reads.
 *
 * Every route runs through `authenticateOrGuest`, so these calls use the
 * `access_token` cookie (apiClient `auth: 'cookie'`), NOT `Authorization:
 * Bearer`. IDs are client-generated strings (≤36 chars) — the store mints
 * them; the server never does.
 *
 * Thin by design: maps each F.x route to one function. The conversation
 * store calls these; screens and components never do.
 */
import { apiClient } from './apiClient';

const COOKIE_AUTH = { auth: 'cookie' } as const;

/** A message row as returned by `GET /api/conversations/:id` (F.3). */
export interface BackendMessage {
  messageId: string;
  conversationId: string;
  messageRole: 'user' | 'assistant';
  messageBody: string;
  messageSequence: number;
  createdDttm: string;
}

/** A conversation row from the list endpoint (F.2), messages excluded. */
export interface BackendConversation {
  conversationId: string;
  conversationTitle: string;
  userId: number | null;
  guestSessionToken: string | null;
  createdDttm: string;
  updatedDttm: string;
}

/** F.3 returns the conversation row plus its ordered messages. */
export interface BackendConversationWithMessages extends BackendConversation {
  messages: BackendMessage[];
}

/** Shape posted to F.4 (`POST /api/conversations/:id/messages`). */
export interface OutgoingMessage {
  messageId: string;
  messageRole: 'user' | 'assistant';
  messageBody: string;
  messageSequence: number;
}

/** F.1 — create a conversation. The id + title are client-supplied. */
export async function createConversation(id: string, title: string): Promise<void> {
  await apiClient.post('/api/conversations', { id, title }, COOKIE_AUTH);
}

/** F.2 — list the caller's conversations, newest-updated first (metadata only). */
export async function listConversations(): Promise<BackendConversation[]> {
  const res = await apiClient.get<{ conversations: BackendConversation[] }>(
    '/api/conversations',
    COOKIE_AUTH,
  );
  return res.conversations;
}

/** F.3 — fetch one conversation with its ordered messages. */
export async function getConversation(id: string): Promise<BackendConversationWithMessages> {
  const res = await apiClient.get<{ conversation: BackendConversationWithMessages }>(
    `/api/conversations/${encodeURIComponent(id)}`,
    COOKIE_AUTH,
  );
  return res.conversation;
}

/** F.4 — append one or more messages and bump the parent's updated_dttm. */
export async function postMessages(
  conversationId: string,
  messages: OutgoingMessage[],
): Promise<void> {
  await apiClient.post(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    { messages },
    COOKIE_AUTH,
  );
}

/** F.5 — update a conversation title. */
export async function updateTitle(id: string, title: string): Promise<void> {
  await apiClient.request(`/api/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { title },
    auth: 'cookie',
  });
}

/** F.6 — delete a conversation and its messages (ownership-scoped, idempotent). */
export async function deleteConversation(id: string): Promise<void> {
  await apiClient.del(`/api/conversations/${encodeURIComponent(id)}`, COOKIE_AUTH);
}
