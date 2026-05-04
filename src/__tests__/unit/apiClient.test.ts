/**
 * apiClient unit tests — focused on the AbortSignal threading +
 * AbortError propagation contract that ragService relies on for its
 * 3-second timeout. Other apiClient behaviour (auth header injection,
 * 401 → refresh → retry, error parsing) is exercised end-to-end by the
 * service tests that consume it.
 */
/* eslint-disable import/first */
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.3.0-test',
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      token: null,
      refreshToken: null,
      signOut: jest.fn(),
      setSession: jest.fn(),
    })),
  },
}));

import { apiClient } from '@/services/apiClient';
import { ApiError, NetworkError, UpgradeRequiredError } from '@/services/__errors__';
/* eslint-enable import/first */

describe('apiClient — AbortSignal threading', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('threads the caller-provided signal through to fetch', async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const controller = new AbortController();
    await apiClient.get('/api/something', { signal: controller.signal });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });

  it('propagates AbortError as-is when the signal aborts', async () => {
    // Simulate fetch throwing an AbortError (which is what happens when
    // an attached signal is aborted mid-flight).
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    global.fetch = jest.fn(async () => {
      throw abortError;
    }) as unknown as typeof fetch;

    const controller = new AbortController();
    controller.abort();

    await expect(
      apiClient.get('/api/something', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('still wraps non-abort fetch failures as NetworkError (regression)', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;

    await expect(apiClient.get('/api/something')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('apiClient — X-Mobile-App-Version + 426/429 handling', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('injects X-Mobile-App-Version on every outbound request', async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiClient.get('/api/something');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Mobile-App-Version']).toBeDefined();
    expect(headers['X-Mobile-App-Version']).toBe('1.3.0-test');
  });

  it('throws UpgradeRequiredError on 426 response', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ error: 'upgrade_required' }), {
          status: 426,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch;

    await expect(apiClient.post('/api/mobile/feedback', {})).rejects.toBeInstanceOf(
      UpgradeRequiredError,
    );
  });

  it('attaches Retry-After to ApiError on 429', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '90' },
        }),
    ) as unknown as typeof fetch;

    let caught: unknown;
    try {
      await apiClient.post('/api/mobile/feedback', {});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(429);
    expect((caught as ApiError).retryAfter).toBe(90);
  });

  it('429 without Retry-After header sets retryAfter undefined', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch;

    let caught: unknown;
    try {
      await apiClient.get('/api/something');
    } catch (e) {
      caught = e;
    }
    expect((caught as ApiError).retryAfter).toBeUndefined();
  });
});
