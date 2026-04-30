/**
 * promptCacheService unit tests.
 *
 * Mocks apiClient + SecureStore so we can assert pure cache behaviour
 * without hitting the network or device storage. Order of declarations
 * matters: jest.mock calls must precede the imports that consume them.
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

import * as SecureStore from 'expo-secure-store';

import { ANTOINE_SYSTEM_PROMPT } from '@/constants/antoine';
import { ANTOINE_PROMPT_SLUG, STORAGE_KEYS } from '@/constants/config';
import { apiClient } from '@/services/apiClient';
import { getActivePrompt, getCachedVersion, refreshAndCache } from '@/services/promptCacheService';
/* eslint-enable import/first */

const apiGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const secureGet = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const secureSet = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;

const SERVER_BODY = 'You are Antoine, the calm head chef.';
const SERVER_VERSION = 7;

function serverPrompt(overrides: Partial<{ body: string; version: number }> = {}) {
  return {
    promptKey: ANTOINE_PROMPT_SLUG,
    promptBody: overrides.body ?? SERVER_BODY,
    runtime: 'device' as const,
    modelId: null,
    version: overrides.version ?? SERVER_VERSION,
    updatedAtDttm: '2026-04-30T01:00:00.000Z',
  };
}

describe('promptCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureGet.mockResolvedValue(null);
  });

  describe('getActivePrompt', () => {
    it('returns the baked-in fallback when the cache is empty', async () => {
      const result = await getActivePrompt();
      expect(result).toBe(ANTOINE_SYSTEM_PROMPT);
      expect(apiGet).not.toHaveBeenCalled();
    });

    it('returns the cached body when present, never hitting the network', async () => {
      secureGet.mockResolvedValueOnce(
        JSON.stringify({ body: SERVER_BODY, version: SERVER_VERSION, cachedAt: 1 }),
      );
      const result = await getActivePrompt();
      expect(result).toBe(SERVER_BODY);
      expect(apiGet).not.toHaveBeenCalled();
    });

    it('falls back to the baked-in prompt when the cache JSON is corrupt', async () => {
      secureGet.mockResolvedValueOnce('not valid json {');
      const result = await getActivePrompt();
      expect(result).toBe(ANTOINE_SYSTEM_PROMPT);
    });
  });

  describe('refreshAndCache', () => {
    it('hits the slug-specific mobile prompts endpoint', async () => {
      apiGet.mockResolvedValueOnce(serverPrompt());
      await refreshAndCache();
      expect(apiGet).toHaveBeenCalledWith(`/api/mobile/prompts/${ANTOINE_PROMPT_SLUG}`);
    });

    it('writes the freshly fetched body + version to SecureStore', async () => {
      apiGet.mockResolvedValueOnce(serverPrompt());
      const returned = await refreshAndCache();
      expect(returned).toBe(SERVER_BODY);
      const writes = secureSet.mock.calls;
      expect(writes.length).toBe(1);
      const [key, value] = writes[0]!;
      expect(key).toBe(STORAGE_KEYS.antoinePrompt);
      const parsed = JSON.parse(value as string);
      expect(parsed.body).toBe(SERVER_BODY);
      expect(parsed.version).toBe(SERVER_VERSION);
    });

    it('skips the SecureStore write when the cached version equals the server version', async () => {
      secureGet.mockResolvedValueOnce(
        JSON.stringify({ body: SERVER_BODY, version: SERVER_VERSION, cachedAt: 1 }),
      );
      apiGet.mockResolvedValueOnce(serverPrompt());
      await refreshAndCache();
      expect(secureSet).not.toHaveBeenCalled();
    });

    it('overwrites when the server version differs', async () => {
      secureGet.mockResolvedValueOnce(JSON.stringify({ body: 'old', version: 1, cachedAt: 1 }));
      apiGet.mockResolvedValueOnce(serverPrompt({ version: 9, body: 'new' }));
      const returned = await refreshAndCache();
      expect(returned).toBe('new');
      expect(secureSet).toHaveBeenCalledTimes(1);
    });

    it('returns the cached body on network failure', async () => {
      secureGet.mockResolvedValueOnce(
        JSON.stringify({ body: 'cached body', version: 3, cachedAt: 1 }),
      );
      apiGet.mockRejectedValueOnce(new Error('network down'));
      const returned = await refreshAndCache();
      expect(returned).toBe('cached body');
    });

    it('returns the baked-in fallback on network failure with empty cache', async () => {
      secureGet.mockResolvedValueOnce(null);
      apiGet.mockRejectedValueOnce(new Error('network down'));
      const returned = await refreshAndCache();
      expect(returned).toBe(ANTOINE_SYSTEM_PROMPT);
    });
  });

  describe('getCachedVersion', () => {
    it('returns null when the cache is empty', async () => {
      secureGet.mockResolvedValueOnce(null);
      expect(await getCachedVersion()).toBeNull();
    });

    it('returns the version field from a populated cache', async () => {
      secureGet.mockResolvedValueOnce(JSON.stringify({ body: 'x', version: 42, cachedAt: 1 }));
      expect(await getCachedVersion()).toBe(42);
    });
  });
});
