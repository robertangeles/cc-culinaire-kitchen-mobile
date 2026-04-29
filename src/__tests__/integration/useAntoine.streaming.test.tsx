/**
 * useAntoine integration test — streaming end-to-end with mocked
 * native layers (llama.rn jest mock, mocked DB queries, mocked
 * model locator). Verifies the data flow:
 *
 *   send(text) → user message persisted → ensureContext() → stream tokens
 *     → streamingText accumulates → completion resolves → assistant
 *     message persisted → streaming state cleared
 */
/* eslint-disable import/first */
jest.mock('@/db/queries/messages', () => ({
  insert: jest.fn(async () => undefined),
  listByConversation: jest.fn(async () => []),
  deleteByConversation: jest.fn(async () => undefined),
}));

jest.mock('@/db/queries/conversations', () => ({
  insert: jest.fn(async () => undefined),
  listByUser: jest.fn(async () => []),
  touch: jest.fn(async () => undefined),
}));

jest.mock('@/services/modelLocator', () => ({
  getMainModelPath: jest.fn(async () => '/mock/path/antoine.gguf'),
  getMmprojPath: jest.fn(async () => '/mock/path/antoine-mmproj.gguf'),
  verifyModelFiles: jest.fn(async () => ({ ok: true, missing: [] })),
}));

import { act, renderHook } from '@testing-library/react-native';

import * as messageQueries from '@/db/queries/messages';
import { useAntoine } from '@/hooks/useAntoine';
import { __forceError } from '@/services/inferenceService';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import { useModelStore } from '@/store/modelStore';
import type { AuthUser } from '@/types/auth';
/* eslint-enable import/first */

const fakeUser: AuthUser = {
  userId: 42,
  userName: 'Test',
  userEmail: 't@example.com',
  emailVerified: true,
  mfaEnabled: false,
  userPhotoPath: null,
  freeSessions: 0,
  subscriptionStatus: 'active',
  subscriptionTier: 'monthly',
  userStatus: 'active',
  roles: [],
  permissions: [],
};

describe('useAntoine — streaming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __forceError.value = false;
    useAuthStore.setState({
      user: fakeUser,
      token: 'tok',
      refreshToken: 'r',
      isHydrated: true,
    });
    useModelStore.setState({
      state: 'ready',
      progress: 1,
      isActive: true,
      error: null,
      wifiOnly: true,
      isPrefsHydrated: true,
    });
    useConversationStore.setState({
      conversations: [],
      activeId: null,
      messages: {},
      streamingConversationId: null,
      streamingText: '',
      dbReady: true,
    });
  });

  it('persists the user message, streams tokens, and commits the assistant message', async () => {
    const { result } = renderHook(() => useAntoine());

    await act(async () => {
      await result.current.send('How do I rescue broken hollandaise?');
    });

    // Both the user message and the committed assistant message must hit
    // SQLite. The mocked llama.rn returns `*giggles*` as the final text.
    const insertCalls = (messageQueries.insert as jest.Mock).mock.calls.map((c) => c[0]);
    const userInsert = insertCalls.find((c) => c.role === 'user');
    const assistantInsert = insertCalls.find((c) => c.role === 'assistant');
    expect(userInsert?.content).toBe('How do I rescue broken hollandaise?');
    expect(assistantInsert?.content).toBe('*giggles*');

    // Streaming state must be cleared after commit.
    const s = useConversationStore.getState();
    expect(s.streamingConversationId).toBeNull();
    expect(s.streamingText).toBe('');

    // Both messages should be visible in the conversation's in-memory list.
    const conversationId = userInsert?.conversationId;
    expect(conversationId).toBeTruthy();
    const list = s.messages[conversationId!] ?? [];
    expect(list.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(list[1]?.content).toBe('*giggles*');
  });

  it('clears streaming state and writes a fallback message on inference error', async () => {
    __forceError.value = true;

    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('test');
    });

    const insertCalls = (messageQueries.insert as jest.Mock).mock.calls.map((c) => c[0]);
    const fallback = insertCalls.find(
      (c) => c.role === 'assistant' && c.content.includes('Antoine stalled'),
    );
    expect(fallback).toBeTruthy();

    const s = useConversationStore.getState();
    expect(s.streamingConversationId).toBeNull();
    expect(s.streamingText).toBe('');
  });

  it('writes the "pick a chef" fallback when the model is not active, without invoking inference', async () => {
    useModelStore.setState({ isActive: false });
    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('test');
    });

    const insertCalls = (messageQueries.insert as jest.Mock).mock.calls.map((c) => c[0]);
    const fallback = insertCalls.find(
      (c) => c.role === 'assistant' && c.content.includes('Pick a Chef'),
    );
    expect(fallback).toBeTruthy();
  });
});
