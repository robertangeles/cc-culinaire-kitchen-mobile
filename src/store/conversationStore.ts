import { create } from 'zustand';

import { db } from '@/db/client';
import * as conversationQueries from '@/db/queries/conversations';
import * as messageQueries from '@/db/queries/messages';
import * as conversationService from '@/services/conversationService';
import type { BackendConversation, BackendMessage } from '@/services/conversationService';
import type { Conversation, Message } from '@/types/chat';

// ---------------------------------------------------------------------------
// 2026-06-15 backend-chat pivot
//
// The on-device llama.rn inference + RAG stack has been retired. The web
// backend (`/api/chat` + `/api/conversations`) is now the SOURCE OF TRUTH
// for conversation content. This store keeps the local SQLite tables as an
// OFFLINE MIRROR of this device's own writes:
//
//   - Reads (hydrate, setActive) fetch from the backend first; on a network
//     failure they fall back to the local SQLite mirror so history is still
//     readable offline.
//   - Writes (startNew, addMessage, commitStreaming, remove, clearAll) write
//     SQLite first (so the UI is instant + offline-durable), then push to the
//     backend best-effort. The existing `isSynced` flag records whether the
//     backend write succeeded; a failed push leaves the row `isSynced=false`.
//
// The previous on-device RAG cache slice has been removed entirely — the
// backend now owns prompt construction and retrieval.
// ---------------------------------------------------------------------------

function rowToMessage(r: {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdDttm: Date;
}): Message {
  return {
    id: r.id,
    conversationId: r.conversationId,
    role: r.role,
    content: r.content,
    createdAt: r.createdDttm.getTime(),
  };
}

function rowToConversation(r: {
  id: string;
  userId: string;
  title: string | null;
  language: string | null;
  createdDttm: Date;
  updatedDttm: Date;
  isSynced: boolean;
  syncedDttm: Date | null;
}): Conversation {
  return {
    id: r.id,
    userId: r.userId,
    title: r.title,
    language: r.language,
    createdAt: r.createdDttm.getTime(),
    updatedAt: r.updatedDttm.getTime(),
    isSynced: r.isSynced,
    syncedAt: r.syncedDttm ? r.syncedDttm.getTime() : null,
  };
}

/**
 * Map a backend conversation row (Endpoint F.2/F.3) to the local
 * `Conversation` shape. The backend does not track the per-conversation
 * `language` override (a mobile-only v1.2 feature), so backend-sourced rows
 * follow the global language until edited locally. `isSynced` is true
 * because the row came straight from the source of truth.
 */
function backendConvToConversation(c: BackendConversation, userId: string): Conversation {
  return {
    id: c.conversationId,
    userId,
    title: c.conversationTitle,
    language: null,
    createdAt: new Date(c.createdDttm).getTime(),
    updatedAt: new Date(c.updatedDttm).getTime(),
    isSynced: true,
    syncedAt: Date.now(),
  };
}

function backendMsgToMessage(m: BackendMessage): Message {
  return {
    id: m.messageId,
    conversationId: m.conversationId,
    role: m.messageRole,
    content: m.messageBody,
    createdAt: new Date(m.createdDttm).getTime(),
  };
}

/**
 * Derive a conversation title from the first user message. Strips
 * whitespace, collapses newlines, truncates to ~40 chars on a word
 * boundary, adds an ellipsis when truncated. The title persists to
 * `ckm_conversation.title` (and the backend) so subsequent History sheet
 * renders show something more useful than "Untitled conversation".
 */
function deriveTitleFromMessage(content: string, maxChars = 40): string {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return '';
  if (cleaned.length <= maxChars) return cleaned;
  const slice = cleaned.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  // Only cut on a word boundary if it's reasonably close to the budget;
  // otherwise hard-truncate (single very long token).
  const cut = lastSpace > maxChars - 10 ? slice.slice(0, lastSpace) : slice;
  return `${cut}…`;
}

interface ConversationStore {
  dbReady: boolean;
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, Message[]>;

  // Streaming slice. While Antoine is generating a reply, the partial text
  // lives here in memory only — never written to SQLite per token. The
  // ChatList renders an in-progress assistant bubble from this state when
  // streamingConversationId === activeId. On completion, commitStreaming
  // persists the final text as a real Message row and clears the slice.
  streamingConversationId: string | null;
  streamingText: string;
  /**
   * Stage indicator for the in-progress bubble UX.
   *   - 'retrieving': reserved (legacy on-device retrieval stage; unused
   *                   after the backend-chat pivot).
   *   - 'warming':    reserved (legacy on-device model-load stage; unused).
   *   - 'streaming':  request in flight — rotating verb until the first
   *                   token, then live token text.
   *   - null:         no stream in progress.
   */
  streamingStage: 'retrieving' | 'warming' | 'streaming' | null;

  setDbReady: (next: boolean) => void;
  hydrate: (userId: string) => Promise<void>;
  startNew: (userId: string) => Promise<string>;
  setActive: (id: string | null) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => Promise<void>;
  clearActive: () => Promise<void>;
  /**
   * Permanently delete a single conversation (and its messages, via
   * `onDelete: 'cascade'` on the FK). Updates the local conversation list,
   * drops cached messages, pushes the delete to the backend, and re-points
   * `activeId` to the next conversation if the deleted one was active.
   */
  removeConversation: (id: string) => Promise<void>;
  /**
   * Permanently delete every conversation for a user. Wipes local state and
   * pushes a delete per conversation to the backend (no bulk-delete route).
   * Used by the History sheet's "Clear all" action.
   */
  clearAllConversations: (userId: string) => Promise<void>;
  /**
   * Set the per-conversation language override. Pass `null` to clear the
   * override and fall back to the global `i18nStore.language`. Local-only —
   * the backend does not model this column — so it persists to SQLite and
   * the in-memory list, and bumps `updatedAt` so the row resorts to the top
   * of the History sheet.
   */
  setConversationLanguage: (id: string, language: string | null) => Promise<void>;
  reset: () => void;

  startStreaming: (conversationId: string) => void;
  setStreamingStage: (stage: 'retrieving' | 'warming' | 'streaming' | null) => void;
  appendStreamingToken: (text: string) => void;
  commitStreaming: (conversationId: string, finalText: string) => Promise<void>;
  clearStreaming: () => void;

  /** Flip a conversation's `isSynced` flag after a backend write-through. */
  markSynced: (conversationId: string, synced: boolean) => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  dbReady: false,
  conversations: [],
  activeId: null,
  messages: {},
  streamingConversationId: null,
  streamingText: '',
  streamingStage: null,

  setDbReady: (next) => set({ dbReady: next }),

  hydrate: async (userId) => {
    // Backend is the source of truth — fetch the thread list first.
    try {
      const backend = await conversationService.listConversations();
      const list = backend.map((c) => backendConvToConversation(c, userId));
      set({ conversations: list, activeId: list[0]?.id ?? null });
      if (list[0]) await get().setActive(list[0].id);
      return;
    } catch {
      // Offline (or backend error) — fall back to the local SQLite mirror so
      // the user can still read this device's history.
    }
    const rows = await conversationQueries.listByUser(userId);
    const list = rows.map(rowToConversation);
    set({ conversations: list, activeId: list[0]?.id ?? null });
    if (list[0]) {
      const msgs = await messageQueries.listByConversation(list[0].id);
      set((s) => ({ messages: { ...s.messages, [list[0]!.id]: msgs.map(rowToMessage) } }));
    }
  },

  startNew: async (userId) => {
    const id = `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    await conversationQueries.insert({
      id,
      userId,
      title: null,
      language: null,
      createdDttm: now,
      updatedDttm: now,
      isSynced: false,
    });
    const conv: Conversation = {
      id,
      userId,
      title: null,
      language: null,
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
      isSynced: false,
      syncedAt: null,
    };
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeId: id,
      messages: { ...s.messages, [id]: [] },
    }));

    // Create the conversation on the backend. F.1 requires a 1..200-char
    // title; we have none yet, so seed a placeholder that the first user
    // message overwrites via `updateTitle`. Best-effort: a failure leaves
    // the row `isSynced=false` and the next write retries the create.
    try {
      await conversationService.createConversation(id, 'New conversation');
    } catch {
      // Offline — keep the local row; the title/message push will retry.
    }
    return id;
  },

  setActive: async (id) => {
    set({ activeId: id });
    if (!id || get().messages[id]) return;
    // Source-of-truth read: pull the thread from the backend, falling back
    // to the local mirror when offline.
    try {
      const conv = await conversationService.getConversation(id);
      set((s) => ({ messages: { ...s.messages, [id]: conv.messages.map(backendMsgToMessage) } }));
      return;
    } catch {
      // Offline — read the local mirror.
    }
    const msgs = await messageQueries.listByConversation(id);
    set((s) => ({ messages: { ...s.messages, [id]: msgs.map(rowToMessage) } }));
  },

  addMessage: async (conversationId, message) => {
    // Sequence the backend wants is this message's 0-based position, i.e.
    // the number of messages already in the thread before this one.
    const sequence = get().messages[conversationId]?.length ?? 0;

    await messageQueries.insert({
      id: message.id,
      conversationId,
      role: message.role,
      content: message.content,
      createdDttm: new Date(message.createdAt),
    });
    await conversationQueries.touch(conversationId);

    // Auto-title: if this is the first user message in a still-untitled
    // conversation, derive a title from its content and persist. Without
    // this, every conversation in the History sheet reads as "Untitled
    // conversation" and rows are indistinguishable.
    let derivedTitle: string | null = null;
    if (message.role === 'user') {
      const conv = get().conversations.find((c) => c.id === conversationId);
      if (conv && (conv.title === null || conv.title === '')) {
        derivedTitle = deriveTitleFromMessage(message.content);
        if (derivedTitle.length > 0) {
          await conversationQueries.setTitle(conversationId, derivedTitle);
        } else {
          derivedTitle = null;
        }
      }
    }

    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] ?? []), message],
      },
      conversations: derivedTitle
        ? s.conversations.map((c) =>
            c.id === conversationId ? { ...c, title: derivedTitle, isSynced: false } : c,
          )
        : s.conversations,
    }));

    // Backend write-through (best-effort). The `system` role is never
    // stored or sent — Antoine's system prompt is injected server-side.
    if (message.role === 'user' || message.role === 'assistant') {
      try {
        await conversationService.postMessages(conversationId, [
          {
            messageId: message.id,
            messageRole: message.role,
            messageBody: message.content,
            messageSequence: sequence,
          },
        ]);
        if (derivedTitle) await conversationService.updateTitle(conversationId, derivedTitle);
        get().markSynced(conversationId, true);
      } catch {
        get().markSynced(conversationId, false);
      }
    }
  },

  clearActive: async () => {
    const id = get().activeId;
    if (!id) return;
    await messageQueries.deleteByConversation(id);
    set((s) => ({ messages: { ...s.messages, [id]: [] } }));
  },

  removeConversation: async (id) => {
    await conversationQueries.remove(id);
    set((s) => {
      const nextConvs = s.conversations.filter((c) => c.id !== id);
      const nextMessages = { ...s.messages };
      delete nextMessages[id];
      // If the deleted conversation was active, point activeId at the
      // most-recently-updated remaining one (the list is sorted desc by
      // updatedDttm at hydrate time + insertions go to the front), or null
      // if there are no conversations left.
      const nextActive = s.activeId === id ? (nextConvs[0]?.id ?? null) : s.activeId;
      return {
        conversations: nextConvs,
        messages: nextMessages,
        activeId: nextActive,
      };
    });
    // Backend delete is ownership-scoped + idempotent; best-effort.
    try {
      await conversationService.deleteConversation(id);
    } catch {
      // Offline — the local row is already gone; the backend keeps it until
      // a future reconcile. Acceptable for v1.
    }
  },

  clearAllConversations: async (userId) => {
    const ids = get().conversations.map((c) => c.id);
    await conversationQueries.removeAllForUser(userId);
    set({
      conversations: [],
      activeId: null,
      messages: {},
    });
    // No bulk-delete route — delete each on the backend, best-effort.
    await Promise.all(
      ids.map((id) => conversationService.deleteConversation(id).catch(() => undefined)),
    );
  },

  setConversationLanguage: async (id, language) => {
    await conversationQueries.setLanguage(id, language);
    const now = Date.now();
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, language, updatedAt: now } : c,
      ),
    }));
  },

  reset: () =>
    set({
      conversations: [],
      activeId: null,
      messages: {},
      streamingConversationId: null,
      streamingText: '',
      streamingStage: null,
      dbReady: db ? true : false,
    }),

  startStreaming: (conversationId) =>
    set({
      streamingConversationId: conversationId,
      streamingText: '',
      streamingStage: 'streaming',
    }),

  setStreamingStage: (stage) => set({ streamingStage: stage }),

  appendStreamingToken: (text) => set((s) => ({ streamingText: s.streamingText + text })),

  commitStreaming: async (conversationId, finalText) => {
    const sequence = get().messages[conversationId]?.length ?? 0;
    const id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const message: Message = {
      id,
      conversationId,
      role: 'assistant',
      content: finalText,
      createdAt: Date.now(),
    };
    await messageQueries.insert({
      id: message.id,
      conversationId,
      role: 'assistant',
      content: finalText,
      createdDttm: new Date(message.createdAt),
    });
    await conversationQueries.touch(conversationId);
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] ?? []), message],
      },
      streamingConversationId: null,
      streamingText: '',
      streamingStage: null,
    }));

    // Persist the assistant turn to the backend (best-effort).
    try {
      await conversationService.postMessages(conversationId, [
        {
          messageId: message.id,
          messageRole: 'assistant',
          messageBody: finalText,
          messageSequence: sequence,
        },
      ]);
      get().markSynced(conversationId, true);
    } catch {
      get().markSynced(conversationId, false);
    }
  },

  clearStreaming: () =>
    set({ streamingConversationId: null, streamingText: '', streamingStage: null }),

  /**
   * Flip a conversation's `isSynced` flag after a backend write-through.
   * Kept on the store (not a free function) so the streaming + message
   * paths share one implementation.
   */
  markSynced: (conversationId: string, synced: boolean) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, isSynced: synced, syncedAt: synced ? Date.now() : c.syncedAt }
          : c,
      ),
    })),
}));
