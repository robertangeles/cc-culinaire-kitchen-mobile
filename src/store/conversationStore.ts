import { create } from 'zustand';

import { db } from '@/db/client';
import * as conversationQueries from '@/db/queries/conversations';
import * as messageQueries from '@/db/queries/messages';
import type { Conversation, Message } from '@/types/chat';

function rowToMessage(r: {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUri: string | null;
  createdDttm: Date;
}): Message {
  const base: Message = {
    id: r.id,
    conversationId: r.conversationId,
    role: r.role,
    content: r.content,
    createdAt: r.createdDttm.getTime(),
  };
  return r.imageUri ? { ...base, imageUri: r.imageUri } : base;
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

interface ConversationStore {
  dbReady: boolean;
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, Message[]>;

  setDbReady: (next: boolean) => void;
  hydrate: (userId: string) => Promise<void>;
  startNew: (userId: string) => Promise<string>;
  setActive: (id: string | null) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => Promise<void>;
  clearActive: () => Promise<void>;
  reset: () => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  dbReady: false,
  conversations: [],
  activeId: null,
  messages: {},

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
      imageUri: message.imageUri ?? null,
      createdDttm: new Date(message.createdAt),
    });
    await conversationQueries.touch(conversationId);
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] ?? []), message],
      },
    }));
  },

  clearActive: async () => {
    const id = get().activeId;
    if (!id) return;
    await messageQueries.deleteByConversation(id);
    set((s) => ({ messages: { ...s.messages, [id]: [] } }));
  },

  reset: () => set({ conversations: [], activeId: null, messages: {}, dbReady: db ? true : false }),
}));
