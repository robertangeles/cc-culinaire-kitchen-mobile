/**
 * Integration test for useAntoine — the backend-chat orchestrator.
 *
 * Exercises the real conversation + auth stores wired to a mocked chat
 * service, SQLite layer, and backend conversation API. Verifies the full
 * send → stream → persist flow plus abort and error handling.
 */
/* eslint-disable import/first */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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

jest.mock('@/services/chatService', () => {
  class ChatAbortError extends Error {
    constructor() {
      super('aborted');
      this.name = 'AbortError';
    }
  }
  return { streamChat: jest.fn(), ChatAbortError };
});

import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { useAntoine } from '@/hooks/useAntoine';
import { ApiError, NetworkError } from '@/services/__errors__';
import { ChatAbortError, streamChat } from '@/services/chatService';
import * as conversationService from '@/services/conversationService';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import type { Conversation } from '@/types/chat';
/* eslint-enable import/first */

const mockStreamChat = streamChat as jest.Mock;

function seedConversation(): Conversation {
  return {
    id: 'c1',
    userId: '7',
    title: 'Existing',
    language: null,
    createdAt: 1,
    updatedAt: 1,
    isSynced: true,
    syncedAt: 1,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    user: { userId: 7, userName: 'Chef', userEmail: 'c@x.com' } as never,
    token: 'jwt',
    refreshToken: 'refresh',
    isHydrated: true,
  });
  useConversationStore.setState({
    conversations: [seedConversation()],
    activeId: 'c1',
    messages: { c1: [] },
    streamingConversationId: null,
    streamingText: '',
    streamingStage: null,
    dbReady: true,
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('useAntoine.send', () => {
  it('ignores empty / whitespace-only input', async () => {
    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('   ');
    });
    expect(mockStreamChat).not.toHaveBeenCalled();
  });

  it('persists the user message, streams the reply, and commits the assistant message', async () => {
    mockStreamChat.mockImplementation(async (params) => {
      params.onTextDelta('Fix it ');
      params.onTextDelta('like this.');
      return 'Fix it like this.';
    });

    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('How do I fix a split hollandaise?');
    });

    const messages = useConversationStore.getState().messages.c1 ?? [];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: 'How do I fix a split hollandaise?',
    });
    expect(messages[1]).toMatchObject({ role: 'assistant', content: 'Fix it like this.' });
  });

  it('sends the prior history (user turn included) and the cookie token to the backend', async () => {
    mockStreamChat.mockResolvedValueOnce('ok');
    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('q1');
    });
    expect(mockStreamChat).toHaveBeenCalledTimes(1);
    const params = mockStreamChat.mock.calls[0][0];
    expect(params.messages).toEqual([{ role: 'user', content: 'q1' }]);
    expect(params.token).toBe('jwt');
  });

  it('creates a new conversation when none is active', async () => {
    useConversationStore.setState({ conversations: [], activeId: null, messages: {} });
    mockStreamChat.mockResolvedValueOnce('reply');

    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('first message');
    });

    expect(useConversationStore.getState().activeId).toBeTruthy();
    expect(conversationService.createConversation).toHaveBeenCalledTimes(1);
  });

  it('clears the streaming bubble and is not thinking after completion', async () => {
    mockStreamChat.mockResolvedValueOnce('done');
    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('q');
    });
    expect(useConversationStore.getState().streamingConversationId).toBeNull();
    expect(result.current.isThinking).toBe(false);
  });

  it('surfaces an offline alert on a network failure', async () => {
    mockStreamChat.mockRejectedValueOnce(new NetworkError('down'));
    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('q');
    });
    expect(Alert.alert).toHaveBeenCalledWith('chat.errorTitle', 'chat.errorOffline');
    expect(result.current.error).toBe('chat.errorOffline');
    expect(useConversationStore.getState().streamingConversationId).toBeNull();
  });

  it('surfaces a generic alert on a server error', async () => {
    mockStreamChat.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('q');
    });
    expect(Alert.alert).toHaveBeenCalledWith('chat.errorTitle', 'chat.errorGeneric');
    expect(result.current.error).toBe('chat.errorGeneric');
  });

  it('stays quiet on an intentional abort', async () => {
    mockStreamChat.mockRejectedValueOnce(new ChatAbortError());
    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('q');
    });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(useConversationStore.getState().streamingConversationId).toBeNull();
  });
});
