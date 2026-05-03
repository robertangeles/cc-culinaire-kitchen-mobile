/**
 * useAntoine integration test — streaming end-to-end with mocked
 * native + service layers (llama.rn jest mock, mocked DB queries,
 * mocked model locator, mocked promptCacheService, mocked ragService).
 *
 * Verifies the data flow:
 *   send(text)
 *     → user message persisted
 *     → fetch system prompt + retrieve RAG chunks (parallel)
 *     → ensureContext()
 *     → completion(messages = [system prompt, RAG block, history])
 *     → stream tokens
 *     → commitStreaming
 *     → assistant message persisted with Sources footer
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
  setTitle: jest.fn(async () => undefined),
  remove: jest.fn(async () => undefined),
  removeAllForUser: jest.fn(async () => undefined),
}));

jest.mock('@/services/modelLocator', () => ({
  getMainModelPath: jest.fn(async () => '/mock/path/antoine.gguf'),
  getMmprojPath: jest.fn(async () => '/mock/path/antoine-mmproj.gguf'),
  verifyModelFiles: jest.fn(async () => ({ ok: true, missing: [] })),
}));

jest.mock('@/services/promptCacheService', () => ({
  getActivePrompt: jest.fn(async () => 'CACHED_SERVER_PROMPT'),
  refreshAndCache: jest.fn(async () => 'CACHED_SERVER_PROMPT'),
  getCachedVersion: jest.fn(async () => 1),
}));

jest.mock('@/services/ragService', () => {
  const actual = jest.requireActual('@/services/ragService');
  return {
    ...actual,
    retrieve: jest.fn(async () => []),
  };
});

// Self-contained mock for kvSessionService. Holds the `kvHandled` flag
// inside the factory closure so tests can call markKvHandled / reset
// without touching real expo-crypto + filesystem modules.
jest.mock('@/services/kvSessionService', () => {
  let flag = false;
  return {
    saveSystemPromptKV: jest.fn(async () => undefined),
    loadSystemPromptKV: jest.fn(async () => false),
    deleteSavedKV: jest.fn(async () => undefined),
    markKvHandled: jest.fn(() => {
      flag = true;
    }),
    wasKvHandledThisSession: jest.fn(() => flag),
    __resetKvSessionFlagForTests: jest.fn(() => {
      flag = false;
    }),
  };
});

import { act, renderHook } from '@testing-library/react-native';

import * as messageQueries from '@/db/queries/messages';
import { useAntoine } from '@/hooks/useAntoine';
import { __forceError } from '@/services/inferenceService';
import {
  __resetKvSessionFlagForTests,
  markKvHandled,
  saveSystemPromptKV,
} from '@/services/kvSessionService';
import { retrieve } from '@/services/ragService';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import { useModelStore } from '@/store/modelStore';
import type { AuthUser } from '@/types/auth';
/* eslint-enable import/first */

const retrieveMock = retrieve as jest.MockedFunction<typeof retrieve>;
const saveKvMock = saveSystemPromptKV as jest.MockedFunction<typeof saveSystemPromptKV>;

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

describe('useAntoine — streaming + RAG + prompt fetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __forceError.value = false;
    retrieveMock.mockResolvedValue([]);
    __resetKvSessionFlagForTests();
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
      streamingStage: null,
      ragChunksByConversation: {},
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
    // No RAG chunks → no Sources footer → assistant content is just the model's reply.
    expect(assistantInsert?.content).toBe('*giggles*');

    // Streaming state must be cleared after commit.
    const s = useConversationStore.getState();
    expect(s.streamingConversationId).toBeNull();
    expect(s.streamingText).toBe('');
    expect(s.streamingStage).toBeNull();

    // Both messages visible in the conversation's in-memory list.
    const conversationId = userInsert?.conversationId;
    expect(conversationId).toBeTruthy();
    const list = s.messages[conversationId!] ?? [];
    expect(list.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('passes the cached server prompt + history to inferenceService.completion', async () => {
    const llamaCompletion = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/services/inferenceService'),
      'completion',
    );
    const { result } = renderHook(() => useAntoine());

    await act(async () => {
      await result.current.send('What temperature for a 1.5-inch ribeye?');
    });

    expect(llamaCompletion).toHaveBeenCalled();
    const callArg = (llamaCompletion.mock.calls[0]?.[1] as { messages: unknown[] }).messages;
    // First message must be the cached server prompt; user message at the end.
    expect(callArg[0]).toMatchObject({ role: 'system', content: 'CACHED_SERVER_PROMPT' });
    expect(callArg[callArg.length - 1]).toMatchObject({
      role: 'user',
      content: 'What temperature for a 1.5-inch ribeye?',
    });
    llamaCompletion.mockRestore();
  });

  it('injects the RAG context block as a second system message when chunks were retrieved', async () => {
    retrieveMock.mockResolvedValueOnce([
      {
        id: 1,
        source: 'Salt Fat Acid Heat',
        document: 'Salt Fat Acid Heat',
        page: null,
        content: 'Hollandaise breaks when heat denatures the lecithin emulsifier.',
        score: 0.93,
        category: 'Food Science and Cooking Principles',
      },
    ]);

    const llamaCompletion = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/services/inferenceService'),
      'completion',
    );
    const { result } = renderHook(() => useAntoine());

    await act(async () => {
      await result.current.send('Why does hollandaise break?');
    });

    const callArg = (
      llamaCompletion.mock.calls[0]?.[1] as { messages: { role: string; content: string }[] }
    ).messages;
    // System prompt at index 0, RAG context system message at index 1.
    expect(callArg[0]).toMatchObject({ role: 'system', content: 'CACHED_SERVER_PROMPT' });
    const ragMessage = callArg[1]!;
    expect(ragMessage.role).toBe('system');
    expect(ragMessage.content).toContain('[1] Salt Fat Acid Heat');
    expect(ragMessage.content).toContain('cite by [n]');
    llamaCompletion.mockRestore();
  });

  it('commits the model reply verbatim without a Sources footer or chunk metadata', async () => {
    // RAG chunks are the model's PRIVATE context — the chunk text + book
    // titles must never leak into the user-visible message. Antoine's
    // inline [n] citations within his reply are fine; the raw source
    // block is not.
    retrieveMock.mockResolvedValueOnce([
      {
        id: 1,
        source: 'On Food and Cooking',
        document: 'On Food and Cooking',
        page: 89,
        content: 'Emulsions stabilise via lecithin from the egg yolk.',
        score: 0.88,
        category: 'Food Science and Cooking Principles',
      },
      {
        id: 2,
        source: 'The Flavor Bible',
        document: 'The Flavor Bible',
        page: null,
        content: 'Lemon brightens richness in butter sauces.',
        score: 0.71,
        category: 'Ingredients and Flavour Pairing',
      },
    ]);

    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('Why does hollandaise break?');
    });

    const insertCalls = (messageQueries.insert as jest.Mock).mock.calls.map((c) => c[0]);
    const assistantInsert = insertCalls.find((c) => c.role === 'assistant');
    // Mocked llama.rn returns `*giggles*` as the final text. The committed
    // message must equal exactly that — no Sources block, no separator,
    // no chunk titles, no chunk content.
    expect(assistantInsert?.content).toBe('*giggles*');
    expect(assistantInsert?.content).not.toContain('Sources:');
    expect(assistantInsert?.content).not.toContain('---');
    expect(assistantInsert?.content).not.toContain('On Food and Cooking');
    expect(assistantInsert?.content).not.toContain('The Flavor Bible');
    expect(assistantInsert?.content).not.toContain('lecithin');
  });

  it('proceeds with inference when ragService returns [] (endpoint offline / network error)', async () => {
    retrieveMock.mockResolvedValueOnce([]);
    const llamaCompletion = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/services/inferenceService'),
      'completion',
    );
    const { result } = renderHook(() => useAntoine());

    await act(async () => {
      await result.current.send('What temperature for confit?');
    });

    const callArg = (llamaCompletion.mock.calls[0]?.[1] as { messages: { role: string }[] })
      .messages;
    // Only system prompt + history (no RAG block injected). 2 messages: system + user.
    const systemMessages = callArg.filter((m) => m.role === 'system');
    expect(systemMessages.length).toBe(1);
    llamaCompletion.mockRestore();
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
    expect(s.streamingStage).toBeNull();
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
    // RAG should not have been consulted in this short-circuit path.
    expect(retrieveMock).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------
  // RAG cache (per-conversation, freeze on first non-empty result)
  // -----------------------------------------------------------------

  it('caches a non-empty RAG result on the first turn under the conversation id', async () => {
    const chunks = [
      {
        id: 1,
        source: 'On Food and Cooking',
        document: 'On Food and Cooking',
        page: 89,
        content: 'Emulsions stabilise via lecithin from the egg yolk.',
        score: 0.88,
        category: 'Food Science and Cooking Principles',
      },
    ];
    retrieveMock.mockResolvedValueOnce(chunks);

    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('Why does hollandaise break?');
    });

    expect(retrieveMock).toHaveBeenCalledTimes(1);
    const s = useConversationStore.getState();
    const activeId = s.activeId!;
    expect(activeId).toBeTruthy();
    expect(s.ragChunksByConversation[activeId]).toEqual(chunks);
  });

  it('reuses cached chunks on the second turn without calling retrieve()', async () => {
    const chunks = [
      {
        id: 1,
        source: 'Salt Fat Acid Heat',
        document: 'Salt Fat Acid Heat',
        page: null,
        content: 'Salt sharpens, fat carries, acid balances, heat transforms.',
        score: 0.91,
        category: 'Food Science and Cooking Principles',
      },
    ];
    // First turn: retrieve returns the chunks (gets cached).
    retrieveMock.mockResolvedValueOnce(chunks);

    const llamaCompletion = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/services/inferenceService'),
      'completion',
    );
    const { result } = renderHook(() => useAntoine());

    await act(async () => {
      await result.current.send('What temperature for a 1.5-inch ribeye?');
    });
    await act(async () => {
      await result.current.send('What about a strip steak instead?');
    });

    // retrieve() should have been invoked exactly ONCE across both
    // sends — turn 2 reused the cached chunks.
    expect(retrieveMock).toHaveBeenCalledTimes(1);

    // Both completion calls should have a RAG-block system message at
    // index 1 with the SAME content (byte-identical), proving the
    // cached chunks were rendered into turn 2's prompt.
    expect(llamaCompletion).toHaveBeenCalledTimes(2);
    const turn1Args = (
      llamaCompletion.mock.calls[0]?.[1] as { messages: { role: string; content: string }[] }
    ).messages;
    const turn2Args = (
      llamaCompletion.mock.calls[1]?.[1] as { messages: { role: string; content: string }[] }
    ).messages;
    expect(turn1Args[1]?.role).toBe('system');
    expect(turn2Args[1]?.role).toBe('system');
    expect(turn2Args[1]?.content).toBe(turn1Args[1]?.content);

    llamaCompletion.mockRestore();
  });

  // -----------------------------------------------------------------
  // KV-state save (system-prompt KV cache persistence across launches)
  // -----------------------------------------------------------------

  it('fires saveSystemPromptKV exactly once after the first successful completion', async () => {
    const { result } = renderHook(() => useAntoine());

    await act(async () => {
      await result.current.send('hello');
    });

    expect(saveKvMock).toHaveBeenCalledTimes(1);
    // First arg is the LlamaContext (we only assert it's defined),
    // second arg is the system prompt — the cached server prompt.
    const [, prompt] = saveKvMock.mock.calls[0] ?? [];
    expect(prompt).toBe('CACHED_SERVER_PROMPT');
  });

  it('does NOT call saveSystemPromptKV again on the second turn (flag latches for the session)', async () => {
    const { result } = renderHook(() => useAntoine());

    await act(async () => {
      await result.current.send('first turn');
    });
    await act(async () => {
      await result.current.send('second turn');
    });

    // saveSystemPromptKV must fire on turn 1 only, regardless of how
    // many subsequent sends happen during the same JS lifetime.
    expect(saveKvMock).toHaveBeenCalledTimes(1);
  });

  it('skips saveSystemPromptKV on the first send if the kvHandled flag is already set (warm-boot scenario)', async () => {
    // Simulate the boot effect having already loaded a saved KV state
    // and called markKvHandled() before the user opened the chat.
    markKvHandled();

    const { result } = renderHook(() => useAntoine());
    await act(async () => {
      await result.current.send('hello');
    });

    // No save — the saved KV state on disk is already current.
    expect(saveKvMock).not.toHaveBeenCalled();
  });

  it('does NOT cache an empty RAG result, so the second turn retries retrieval', async () => {
    // First turn: retrieve returns []. Second turn: retrieve returns
    // chunks. The contract: empty results are never cached, so the
    // second turn must call retrieve() fresh.
    retrieveMock.mockResolvedValueOnce([]);
    retrieveMock.mockResolvedValueOnce([
      {
        id: 1,
        source: 'The Flavor Bible',
        document: 'The Flavor Bible',
        page: null,
        content: 'Coffee pairs with cardamom, dark chocolate, and orange zest.',
        score: 0.84,
        category: 'Ingredients and Flavour Pairing',
      },
    ]);

    const { result } = renderHook(() => useAntoine());

    await act(async () => {
      await result.current.send('hello');
    });
    // After turn 1, the cache for this conversation must still be
    // undefined (empty arrays are not cached).
    const sAfter1 = useConversationStore.getState();
    const activeId = sAfter1.activeId!;
    expect(sAfter1.ragChunksByConversation[activeId]).toBeUndefined();

    await act(async () => {
      await result.current.send('What pairs with coffee?');
    });

    // retrieve() must have been called twice — once on turn 1
    // (returned [], not cached) and once on turn 2 (returned chunks,
    // now cached).
    expect(retrieveMock).toHaveBeenCalledTimes(2);
    const sAfter2 = useConversationStore.getState();
    expect(sAfter2.ragChunksByConversation[activeId]).toBeDefined();
    expect(sAfter2.ragChunksByConversation[activeId]?.length).toBe(1);
  });
});
