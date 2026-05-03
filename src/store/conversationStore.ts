import { create } from 'zustand';

import { db } from '@/db/client';
import * as conversationQueries from '@/db/queries/conversations';
import * as messageQueries from '@/db/queries/messages';
import type { RagChunk } from '@/services/ragService';
import type { Conversation, Message } from '@/types/chat';

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
  createdDttm: Date;
  updatedDttm: Date;
  isSynced: boolean;
  syncedDttm: Date | null;
}): Conversation {
  return {
    id: r.id,
    userId: r.userId,
    title: r.title,
    createdAt: r.createdDttm.getTime(),
    updatedAt: r.updatedDttm.getTime(),
    isSynced: r.isSynced,
    syncedAt: r.syncedDttm ? r.syncedDttm.getTime() : null,
  };
}

/**
 * Derive a conversation title from the first user message. Strips
 * whitespace, collapses newlines, truncates to ~40 chars on a word
 * boundary, adds an ellipsis when truncated. The title persists to
 * `ckm_conversation.title` so subsequent History sheet renders show
 * something more useful than "Untitled conversation".
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
   *   - 'retrieving': RAG fetch + prompt cache lookup in flight (~0–3s)
   *   - 'warming':    model load on cold start (~5–30s, first message only)
   *   - 'streaming':  tokens are arriving (subtitle replaced with token text)
   *   - null:         no stream in progress
   */
  streamingStage: 'retrieving' | 'warming' | 'streaming' | null;

  /**
   * RAG chunks frozen per conversation. The first user message in a
   * conversation triggers `retrieve()`; on a non-empty result, the
   * chunks are stored here and reused on every subsequent turn within
   * the same conversation. This stabilises the message-array structure
   * so llama.cpp's automatic prompt cache reuses the prefix across
   * turns instead of re-prefilling 700+ tokens of system prompt + RAG
   * block on every send.
   *
   * Empty results are NOT cached — the next turn retries naturally
   * (so a conversation that opens with chitchat and then asks a real
   * culinary question still gets RAG help on the real question).
   *
   * In-memory only; not persisted to SQLite. Lost on app restart, which
   * is fine — the next first-turn fetch repopulates from the web.
   */
  ragChunksByConversation: Record<string, RagChunk[]>;

  setDbReady: (next: boolean) => void;
  hydrate: (userId: string) => Promise<void>;
  startNew: (userId: string) => Promise<string>;
  setActive: (id: string | null) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => Promise<void>;
  clearActive: () => Promise<void>;
  /**
   * Permanently delete a single conversation (and its messages, via
   * `onDelete: 'cascade'` on the FK). Updates the local conversation
   * list, drops cached messages + RAG chunks, and re-points `activeId`
   * to the next conversation if the deleted one was active.
   */
  removeConversation: (id: string) => Promise<void>;
  /**
   * Permanently delete every conversation for a user. Wipes local
   * state. Used by the History sheet's "Clear all" action.
   */
  clearAllConversations: (userId: string) => Promise<void>;
  reset: () => void;

  startStreaming: (conversationId: string) => void;
  setStreamingStage: (stage: 'retrieving' | 'warming' | 'streaming' | null) => void;
  appendStreamingToken: (text: string) => void;
  commitStreaming: (conversationId: string, finalText: string) => Promise<void>;
  clearStreaming: () => void;

  /**
   * Store the first-turn RAG chunks for a conversation. Called by
   * `useAntoine.send()` only when the result was non-empty — empty
   * arrays are intentionally not cached so the next turn retries.
   */
  setRagChunksForConversation: (conversationId: string, chunks: RagChunk[]) => void;
  /**
   * Drop the cached chunks for a conversation. Called when the user
   * clears the conversation (`clearActive`) so the next message in the
   * same conversation gets a fresh retrieval — the prior RAG context
   * was tied to the deleted history.
   */
  clearRagChunksForConversation: (conversationId: string) => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  dbReady: false,
  conversations: [],
  activeId: null,
  messages: {},
  streamingConversationId: null,
  streamingText: '',
  streamingStage: null,
  ragChunksByConversation: {},

  setDbReady: (next) => set({ dbReady: next }),

  hydrate: async (userId) => {
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
      createdDttm: now,
      updatedDttm: now,
      isSynced: false,
    });
    const conv: Conversation = {
      id,
      userId,
      title: null,
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
    return id;
  },

  setActive: async (id) => {
    set({ activeId: id });
    if (id && !get().messages[id]) {
      const msgs = await messageQueries.listByConversation(id);
      set((s) => ({ messages: { ...s.messages, [id]: msgs.map(rowToMessage) } }));
    }
  },

  addMessage: async (conversationId, message) => {
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
    // conversation" (per chat.untitledConversation fallback) and rows
    // are indistinguishable.
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
  },

  clearActive: async () => {
    const id = get().activeId;
    if (!id) return;
    await messageQueries.deleteByConversation(id);
    set((s) => {
      // Also drop the cached RAG chunks for this conversation so the
      // next user message after the clear gets a fresh retrieval that
      // matches whatever new direction the conversation takes.
      const nextRag = { ...s.ragChunksByConversation };
      delete nextRag[id];
      return {
        messages: { ...s.messages, [id]: [] },
        ragChunksByConversation: nextRag,
      };
    });
  },

  removeConversation: async (id) => {
    await conversationQueries.remove(id);
    set((s) => {
      const nextConvs = s.conversations.filter((c) => c.id !== id);
      const nextMessages = { ...s.messages };
      delete nextMessages[id];
      const nextRag = { ...s.ragChunksByConversation };
      delete nextRag[id];
      // If the deleted conversation was active, point activeId at the
      // most-recently-updated remaining one (the list is sorted desc by
      // updatedDttm at hydrate time + insertions go to the front), or
      // null if there are no conversations left.
      const nextActive = s.activeId === id ? (nextConvs[0]?.id ?? null) : s.activeId;
      return {
        conversations: nextConvs,
        messages: nextMessages,
        ragChunksByConversation: nextRag,
        activeId: nextActive,
      };
    });
  },

  clearAllConversations: async (userId) => {
    await conversationQueries.removeAllForUser(userId);
    set({
      conversations: [],
      activeId: null,
      messages: {},
      ragChunksByConversation: {},
    });
  },

  reset: () =>
    set({
      conversations: [],
      activeId: null,
      messages: {},
      streamingConversationId: null,
      streamingText: '',
      streamingStage: null,
      ragChunksByConversation: {},
      dbReady: db ? true : false,
    }),

  startStreaming: (conversationId) =>
    set({
      streamingConversationId: conversationId,
      streamingText: '',
      streamingStage: 'retrieving',
    }),

  setStreamingStage: (stage) => set({ streamingStage: stage }),

  appendStreamingToken: (text) => set((s) => ({ streamingText: s.streamingText + text })),

  commitStreaming: async (conversationId, finalText) => {
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
  },

  clearStreaming: () =>
    set({ streamingConversationId: null, streamingText: '', streamingStage: null }),

  setRagChunksForConversation: (conversationId, chunks) =>
    set((s) => ({
      ragChunksByConversation: { ...s.ragChunksByConversation, [conversationId]: chunks },
    })),

  clearRagChunksForConversation: (conversationId) =>
    set((s) => {
      const next = { ...s.ragChunksByConversation };
      delete next[conversationId];
      return { ragChunksByConversation: next };
    }),
}));
