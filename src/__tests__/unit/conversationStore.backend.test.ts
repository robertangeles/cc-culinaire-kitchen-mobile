/**
 * Backend-integration tests for conversationStore after the 2026-06-15
 * pivot. The SQLite query layer AND the backend conversation API are mocked;
 * we assert the store fetches from the backend (source of truth), falls back
 * to SQLite when offline, and writes through on every mutation.
 */
/* eslint-disable import/first */
jest.mock('@/db/client', () => ({ db: {} }));

jest.mock('@/db/queries/messages', () => ({
  insert: jest.fn(async () => undefined),
  listByConversation: jest.fn(async () => []),
  deleteByConversation: jest.fn(async () => undefined),
}));

jest.mock('@/db/queries/conversations', () => ({
  insert: jest.fn(async () => undefined),
  listByUser: jest.fn(async () => []),
  touch: jest.fn(async () => undefined),
  setTitle: jest.fn(async () => undefined),
  setLanguage: jest.fn(async () => undefined),
  remove: jest.fn(async () => undefined),
  removeAllForUser: jest.fn(async () => undefined),
}));

jest.mock('@/services/conversationService', () => ({
  createConversation: jest.fn(async () => undefined),
  listConversations: jest.fn(async () => []),
  getConversation: jest.fn(async () => ({ conversationId: 'x', messages: [] })),
  postMessages: jest.fn(async () => undefined),
  updateTitle: jest.fn(async () => undefined),
  deleteConversation: jest.fn(async () => undefined),
}));

import * as conversationQueries from '@/db/queries/conversations';
import * as messageQueries from '@/db/queries/messages';
import * as conversationService from '@/services/conversationService';
import { useConversationStore } from '@/store/conversationStore';
import type { Message } from '@/types/chat';
/* eslint-enable import/first */

function resetStore() {
  useConversationStore.setState({
    conversations: [],
    activeId: null,
    messages: {},
    streamingConversationId: null,
    streamingText: '',
    streamingStage: null,
    dbReady: true,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
});

const userMsg = (id: string, conversationId: string, content: string): Message => ({
  id,
  conversationId,
  role: 'user',
  content,
  createdAt: 1000,
});

describe('conversationStore — backend as source of truth', () => {
  describe('hydrate', () => {
    it('loads conversations from the backend list', async () => {
      (conversationService.listConversations as jest.Mock).mockResolvedValueOnce([
        {
          conversationId: 'c1',
          conversationTitle: 'Sauces',
          userId: 7,
          guestSessionToken: null,
          createdDttm: '2026-06-17T01:00:00.000Z',
          updatedDttm: '2026-06-17T01:05:00.000Z',
        },
      ]);
      (conversationService.getConversation as jest.Mock).mockResolvedValueOnce({
        conversationId: 'c1',
        messages: [],
      });

      await useConversationStore.getState().hydrate('7');

      const s = useConversationStore.getState();
      expect(conversationService.listConversations).toHaveBeenCalledTimes(1);
      expect(s.conversations).toHaveLength(1);
      expect(s.conversations[0]).toMatchObject({ id: 'c1', title: 'Sauces', isSynced: true });
      expect(s.activeId).toBe('c1');
      // Did not need the SQLite fallback.
      expect(conversationQueries.listByUser).not.toHaveBeenCalled();
    });

    it('falls back to the SQLite mirror when the backend is unreachable', async () => {
      (conversationService.listConversations as jest.Mock).mockRejectedValueOnce(
        new Error('offline'),
      );
      (conversationQueries.listByUser as jest.Mock).mockResolvedValueOnce([
        {
          id: 'local1',
          userId: '7',
          title: 'Cached',
          language: null,
          createdDttm: new Date(1000),
          updatedDttm: new Date(2000),
          isSynced: false,
          syncedDttm: null,
        },
      ]);

      await useConversationStore.getState().hydrate('7');

      const s = useConversationStore.getState();
      expect(conversationQueries.listByUser).toHaveBeenCalledWith('7');
      expect(s.conversations[0]).toMatchObject({ id: 'local1', title: 'Cached' });
      expect(s.activeId).toBe('local1');
    });
  });

  describe('setActive', () => {
    it('fetches messages from the backend for the selected conversation', async () => {
      (conversationService.getConversation as jest.Mock).mockResolvedValueOnce({
        conversationId: 'c1',
        messages: [
          {
            messageId: 'm1',
            conversationId: 'c1',
            messageRole: 'user',
            messageBody: 'How do I fix a split hollandaise?',
            messageSequence: 0,
            createdDttm: '2026-06-17T01:00:01.000Z',
          },
        ],
      });

      await useConversationStore.getState().setActive('c1');

      const s = useConversationStore.getState();
      expect(conversationService.getConversation).toHaveBeenCalledWith('c1');
      expect(s.messages.c1 ?? []).toHaveLength(1);
      expect(s.messages.c1?.[0]).toMatchObject({ role: 'user', content: expect.any(String) });
      expect(messageQueries.listByConversation).not.toHaveBeenCalled();
    });

    it('falls back to SQLite messages when the backend fetch fails', async () => {
      (conversationService.getConversation as jest.Mock).mockRejectedValueOnce(
        new Error('offline'),
      );
      (messageQueries.listByConversation as jest.Mock).mockResolvedValueOnce([
        {
          id: 'm1',
          conversationId: 'c1',
          role: 'assistant',
          content: 'cached reply',
          createdDttm: new Date(1000),
        },
      ]);

      await useConversationStore.getState().setActive('c1');

      const s = useConversationStore.getState();
      expect(messageQueries.listByConversation).toHaveBeenCalledWith('c1');
      expect(s.messages.c1?.[0]).toMatchObject({ content: 'cached reply' });
    });
  });

  describe('startNew', () => {
    it('mirrors locally and creates the conversation on the backend', async () => {
      const id = await useConversationStore.getState().startNew('7');
      expect(conversationQueries.insert).toHaveBeenCalledTimes(1);
      expect(conversationService.createConversation).toHaveBeenCalledWith(id, 'New conversation');
      expect(useConversationStore.getState().activeId).toBe(id);
    });

    it('still returns a usable local id when the backend create fails', async () => {
      (conversationService.createConversation as jest.Mock).mockRejectedValueOnce(
        new Error('offline'),
      );
      const id = await useConversationStore.getState().startNew('7');
      expect(id).toBeTruthy();
      expect(useConversationStore.getState().conversations[0]?.id).toBe(id);
    });
  });

  describe('addMessage write-through', () => {
    it('posts the user message to the backend with its sequence and marks synced', async () => {
      useConversationStore.setState({
        conversations: [
          {
            id: 'c1',
            userId: '7',
            title: 'Existing',
            language: null,
            createdAt: 1,
            updatedAt: 1,
            isSynced: false,
            syncedAt: null,
          },
        ],
        messages: { c1: [] },
      });

      await useConversationStore.getState().addMessage('c1', userMsg('m1', 'c1', 'first question'));

      expect(conversationService.postMessages).toHaveBeenCalledWith('c1', [
        { messageId: 'm1', messageRole: 'user', messageBody: 'first question', messageSequence: 0 },
      ]);
      expect(useConversationStore.getState().conversations[0]?.isSynced).toBe(true);
    });

    it('uses the in-memory length as the next sequence number', async () => {
      useConversationStore.setState({
        conversations: [
          {
            id: 'c1',
            userId: '7',
            title: 'T',
            language: null,
            createdAt: 1,
            updatedAt: 1,
            isSynced: true,
            syncedAt: 1,
          },
        ],
        messages: {
          c1: [userMsg('m0', 'c1', 'q0'), { ...userMsg('m0b', 'c1', 'a0'), role: 'assistant' }],
        },
      });

      await useConversationStore.getState().addMessage('c1', userMsg('m1', 'c1', 'q1'));

      expect(conversationService.postMessages).toHaveBeenCalledWith('c1', [
        expect.objectContaining({ messageSequence: 2 }),
      ]);
    });

    it('leaves isSynced false when the backend write fails (offline)', async () => {
      (conversationService.postMessages as jest.Mock).mockRejectedValueOnce(new Error('offline'));
      useConversationStore.setState({
        conversations: [
          {
            id: 'c1',
            userId: '7',
            title: 'T',
            language: null,
            createdAt: 1,
            updatedAt: 1,
            isSynced: true,
            syncedAt: 1,
          },
        ],
        messages: { c1: [] },
      });

      await useConversationStore.getState().addMessage('c1', userMsg('m1', 'c1', 'q'));

      expect(useConversationStore.getState().conversations[0]?.isSynced).toBe(false);
    });

    it('updates the backend title on the first user message of an untitled conversation', async () => {
      useConversationStore.setState({
        conversations: [
          {
            id: 'c1',
            userId: '7',
            title: null,
            language: null,
            createdAt: 1,
            updatedAt: 1,
            isSynced: false,
            syncedAt: null,
          },
        ],
        messages: { c1: [] },
      });

      await useConversationStore
        .getState()
        .addMessage('c1', userMsg('m1', 'c1', 'How do I fix a split hollandaise?'));

      expect(conversationService.updateTitle).toHaveBeenCalledWith(
        'c1',
        'How do I fix a split hollandaise?',
      );
    });
  });

  describe('commitStreaming write-through', () => {
    it('persists the assistant message to the backend', async () => {
      useConversationStore.setState({
        conversations: [
          {
            id: 'c1',
            userId: '7',
            title: 'T',
            language: null,
            createdAt: 1,
            updatedAt: 1,
            isSynced: true,
            syncedAt: 1,
          },
        ],
        messages: { c1: [userMsg('m1', 'c1', 'q')] },
      });

      await useConversationStore.getState().commitStreaming('c1', 'Here is the fix.');

      expect(conversationService.postMessages).toHaveBeenCalledWith('c1', [
        expect.objectContaining({
          messageRole: 'assistant',
          messageBody: 'Here is the fix.',
          messageSequence: 1,
        }),
      ]);
    });
  });

  describe('deletion write-through', () => {
    it('removeConversation deletes on the backend', async () => {
      useConversationStore.setState({
        conversations: [
          {
            id: 'c1',
            userId: '7',
            title: 'T',
            language: null,
            createdAt: 1,
            updatedAt: 1,
            isSynced: true,
            syncedAt: 1,
          },
        ],
        activeId: 'c1',
        messages: { c1: [] },
      });

      await useConversationStore.getState().removeConversation('c1');

      expect(conversationService.deleteConversation).toHaveBeenCalledWith('c1');
      expect(useConversationStore.getState().conversations).toHaveLength(0);
    });

    it('clearAllConversations deletes every conversation on the backend', async () => {
      useConversationStore.setState({
        conversations: [
          {
            id: 'c1',
            userId: '7',
            title: 'A',
            language: null,
            createdAt: 1,
            updatedAt: 1,
            isSynced: true,
            syncedAt: 1,
          },
          {
            id: 'c2',
            userId: '7',
            title: 'B',
            language: null,
            createdAt: 1,
            updatedAt: 1,
            isSynced: true,
            syncedAt: 1,
          },
        ],
      });

      await useConversationStore.getState().clearAllConversations('7');

      expect(conversationService.deleteConversation).toHaveBeenCalledWith('c1');
      expect(conversationService.deleteConversation).toHaveBeenCalledWith('c2');
      expect(useConversationStore.getState().conversations).toHaveLength(0);
    });
  });

  describe('markSynced', () => {
    it('flips the isSynced flag for a single conversation', () => {
      useConversationStore.setState({
        conversations: [
          {
            id: 'c1',
            userId: '7',
            title: 'T',
            language: null,
            createdAt: 1,
            updatedAt: 1,
            isSynced: false,
            syncedAt: null,
          },
        ],
      });
      useConversationStore.getState().markSynced('c1', true);
      expect(useConversationStore.getState().conversations[0]?.isSynced).toBe(true);
    });
  });
});
