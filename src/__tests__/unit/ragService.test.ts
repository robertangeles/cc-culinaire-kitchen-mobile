/**
 * ragService unit tests.
 *
 * Mocks apiClient so we can assert request/response handling, the
 * silent-fallback behaviour, and the 3s timeout — all without hitting
 * the live web backend.
 */
/* eslint-disable import/first */
jest.mock('@/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    del: jest.fn(),
    request: jest.fn(),
  },
}));

import { ApiError, NetworkError } from '@/services/__errors__';
import { apiClient } from '@/services/apiClient';
import { formatRagContext, type RagChunk, retrieve } from '@/services/ragService';
/* eslint-enable import/first */

const apiPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

function chunk(overrides: Partial<RagChunk> = {}): RagChunk {
  return {
    id: 1,
    source: 'Salt Fat Acid Heat',
    document: 'Salt Fat Acid Heat',
    page: null,
    content: 'When emulsions break, restart from a fresh yolk and a teaspoon of warm water.',
    score: 0.91,
    category: 'Food Science and Cooking Principles',
    ...overrides,
  };
}

describe('ragService.retrieve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws on empty query (programming bug, not network condition)', async () => {
    await expect(retrieve('')).rejects.toThrow(/empty query/);
    await expect(retrieve('   ')).rejects.toThrow(/empty query/);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('POSTs the trimmed query + default limit to /api/mobile/rag/retrieve', async () => {
    apiPost.mockResolvedValueOnce({ chunks: [], vectorSearchEnabled: true });
    await retrieve('  how do I rescue broken hollandaise  ');
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('/api/mobile/rag/retrieve', {
      query: 'how do I rescue broken hollandaise',
      limit: 5,
    });
  });

  it('passes through caller-specified limit + category', async () => {
    apiPost.mockResolvedValueOnce({ chunks: [], vectorSearchEnabled: true });
    await retrieve('beurre blanc', { limit: 8, category: 'Recipes by Cuisine' });
    expect(apiPost).toHaveBeenCalledWith('/api/mobile/rag/retrieve', {
      query: 'beurre blanc',
      limit: 8,
      category: 'Recipes by Cuisine',
    });
  });

  it('returns the chunks array from a 200 response', async () => {
    const c1 = chunk({ id: 1, source: 'On Food and Cooking' });
    const c2 = chunk({ id: 2, source: 'The Flavor Bible' });
    apiPost.mockResolvedValueOnce({ chunks: [c1, c2], vectorSearchEnabled: true });
    const result = await retrieve('emulsion');
    expect(result).toEqual([c1, c2]);
  });

  it('returns [] when the server responds with no chunks', async () => {
    apiPost.mockResolvedValueOnce({ chunks: [], vectorSearchEnabled: false });
    expect(await retrieve('something obscure')).toEqual([]);
  });

  it('returns [] (silent fallback) on ApiError so inference can proceed', async () => {
    apiPost.mockRejectedValueOnce(new ApiError(404, 'Not found'));
    expect(await retrieve('test')).toEqual([]);
  });

  it('returns [] on NetworkError so inference can proceed', async () => {
    apiPost.mockRejectedValueOnce(new NetworkError('Failed to reach RAG endpoint'));
    expect(await retrieve('test')).toEqual([]);
  });

  it('returns [] on unexpected errors so inference can proceed', async () => {
    apiPost.mockRejectedValueOnce(new TypeError('boom'));
    expect(await retrieve('test')).toEqual([]);
  });

  it('returns [] when the response shape is malformed', async () => {
    apiPost.mockResolvedValueOnce({ unexpected: 'shape' } as never);
    expect(await retrieve('test')).toEqual([]);
  });

  it('honours the 3-second timeout when the network is slow', async () => {
    jest.useFakeTimers();
    let neverResolves: (value: unknown) => void = () => undefined;
    apiPost.mockReturnValueOnce(new Promise((resolve) => (neverResolves = resolve)));

    const promise = retrieve('test');
    // Race the manual timer past the 3s deadline.
    jest.advanceTimersByTime(3001);
    const result = await promise;
    expect(result).toEqual([]);

    // Resolving after the timeout has no effect on the caller.
    neverResolves({ chunks: [chunk()], vectorSearchEnabled: true });
    jest.useRealTimers();
  });
});

describe('formatRagContext', () => {
  it('returns null for an empty chunk list (caller omits the system message)', () => {
    expect(formatRagContext([])).toBeNull();
  });

  it('formats chunks with [n] citations + source + page when present', () => {
    const formatted = formatRagContext([
      chunk({ source: 'Salt Fat Acid Heat', page: 142, content: 'first chunk' }),
      chunk({ source: 'On Food and Cooking', page: 89, content: 'second chunk' }),
    ]);
    expect(formatted).toContain('[1] Salt Fat Acid Heat, p. 142: first chunk');
    expect(formatted).toContain('[2] On Food and Cooking, p. 89: second chunk');
    expect(formatted).toMatch(/cite by \[n\]/);
  });

  it('omits page when null (current production state)', () => {
    const formatted = formatRagContext([chunk({ source: 'The Flavor Bible', page: null })]);
    expect(formatted).toContain('[1] The Flavor Bible:');
    expect(formatted).not.toContain('p. ');
  });
});
