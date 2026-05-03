/**
 * promptCacheService unit tests.
 *
 * Mocks apiClient + SecureStore so we can assert pure cache behaviour
 * without hitting the network or device storage. Order of declarations
 * matters: jest.mock calls must precede the imports that consume them.
 *
 * v1.2 cache shape: a single SecureStore entry under
 * STORAGE_KEYS.antoinePromptMap holds a JSON object keyed by slug. Each
 * entry is either `{ status: 'ok', body, version, cachedAt }` or
 * `{ status: 'not_found', checkedAt }`. The not_found branch drives the
 * partial-language banner UX.
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
import { ApiError } from '@/services/__errors__';
import {
  getActivePrompt,
  getCachedVersion,
  refreshAndCache,
  slugForLanguage,
} from '@/services/promptCacheService';
/* eslint-enable import/first */

const apiGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const secureGet = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const secureSet = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const secureDelete = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

const SERVER_BODY = 'You are Antoine, the calm head chef.';
const SERVER_VERSION = 7;
const FR_SLUG = `${ANTOINE_PROMPT_SLUG}-fr`;
const FR_BODY = 'Vous êtes Antoine, le chef de cuisine.';

function serverPrompt(overrides: Partial<{ body: string; version: number; key: string }> = {}) {
  return {
    promptKey: overrides.key ?? ANTOINE_PROMPT_SLUG,
    promptBody: overrides.body ?? SERVER_BODY,
    runtime: 'device' as const,
    modelId: null,
    version: overrides.version ?? SERVER_VERSION,
    updatedAtDttm: '2026-04-30T01:00:00.000Z',
  };
}

/** Helper: stub readCacheMap by returning the given map JSON-serialised. */
function mockCacheMap(map: Record<string, unknown>) {
  secureGet.mockImplementation(async (key: string) => {
    if (key === STORAGE_KEYS.antoinePromptMap) return JSON.stringify(map);
    return null;
  });
}

/** Helper: simulate empty cache for both v1.2 map AND legacy v1.1 single-slug. */
function mockEmptyCache() {
  secureGet.mockResolvedValue(null);
}

describe('promptCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEmptyCache();
  });

  describe('slugForLanguage', () => {
    it('returns the base slug for en (no suffix)', () => {
      expect(slugForLanguage('en')).toBe(ANTOINE_PROMPT_SLUG);
    });

    it('appends a dash + lang code for non-en locales', () => {
      expect(slugForLanguage('fr')).toBe(`${ANTOINE_PROMPT_SLUG}-fr`);
      expect(slugForLanguage('it')).toBe(`${ANTOINE_PROMPT_SLUG}-it`);
    });
  });

  describe('getActivePrompt', () => {
    it('returns the baked-in fallback when the cache is empty', async () => {
      const result = await getActivePrompt();
      expect(result.body).toBe(ANTOINE_SYSTEM_PROMPT);
      expect(result.resolvedSlug).toBe(ANTOINE_PROMPT_SLUG);
      expect(result.isFallback).toBe(false);
      expect(apiGet).not.toHaveBeenCalled();
    });

    it('returns the cached body when present, never hitting the network', async () => {
      mockCacheMap({
        [ANTOINE_PROMPT_SLUG]: {
          status: 'ok',
          body: SERVER_BODY,
          version: SERVER_VERSION,
          cachedAt: 1,
        },
      });
      const result = await getActivePrompt();
      expect(result.body).toBe(SERVER_BODY);
      expect(result.resolvedSlug).toBe(ANTOINE_PROMPT_SLUG);
      expect(result.isFallback).toBe(false);
      expect(apiGet).not.toHaveBeenCalled();
    });

    it('falls back to the baked-in prompt when the cache JSON is corrupt', async () => {
      secureGet.mockResolvedValueOnce('not valid json {');
      const result = await getActivePrompt();
      expect(result.body).toBe(ANTOINE_SYSTEM_PROMPT);
    });

    it('returns the FR cached body when slug=fr is cached', async () => {
      mockCacheMap({
        [FR_SLUG]: { status: 'ok', body: FR_BODY, version: 1, cachedAt: 1 },
      });
      const result = await getActivePrompt(FR_SLUG);
      expect(result.body).toBe(FR_BODY);
      expect(result.resolvedSlug).toBe(FR_SLUG);
      expect(result.isFallback).toBe(false);
    });

    it('falls back to EN cache with isFallback=true when fr slug is known not_found', async () => {
      mockCacheMap({
        [ANTOINE_PROMPT_SLUG]: {
          status: 'ok',
          body: SERVER_BODY,
          version: SERVER_VERSION,
          cachedAt: 1,
        },
        [FR_SLUG]: { status: 'not_found', checkedAt: 1 },
      });
      const result = await getActivePrompt(FR_SLUG);
      expect(result.body).toBe(SERVER_BODY);
      expect(result.resolvedSlug).toBe(ANTOINE_PROMPT_SLUG);
      expect(result.isFallback).toBe(true);
    });

    it('falls back to baked-in EN with isFallback=true when fr is not_found AND EN is uncached', async () => {
      mockCacheMap({
        [FR_SLUG]: { status: 'not_found', checkedAt: 1 },
      });
      const result = await getActivePrompt(FR_SLUG);
      expect(result.body).toBe(ANTOINE_SYSTEM_PROMPT);
      expect(result.resolvedSlug).toBe(ANTOINE_PROMPT_SLUG);
      expect(result.isFallback).toBe(true);
    });

    it('does NOT mark isFallback=true when fr was never attempted (cache miss)', async () => {
      mockCacheMap({
        [ANTOINE_PROMPT_SLUG]: {
          status: 'ok',
          body: SERVER_BODY,
          version: SERVER_VERSION,
          cachedAt: 1,
        },
      });
      const result = await getActivePrompt(FR_SLUG);
      expect(result.body).toBe(SERVER_BODY);
      expect(result.resolvedSlug).toBe(ANTOINE_PROMPT_SLUG);
      // Never attempted → not yet known to be missing → no banner.
      expect(result.isFallback).toBe(false);
    });
  });

  describe('refreshAndCache', () => {
    it('hits the slug-specific mobile prompts endpoint (default = EN)', async () => {
      apiGet.mockResolvedValueOnce(serverPrompt());
      await refreshAndCache();
      expect(apiGet).toHaveBeenCalledWith(`/api/mobile/prompts/${ANTOINE_PROMPT_SLUG}`);
    });

    it('hits the per-language endpoint when slug is supplied', async () => {
      apiGet.mockResolvedValueOnce(serverPrompt({ key: FR_SLUG, body: FR_BODY, version: 1 }));
      await refreshAndCache(FR_SLUG);
      expect(apiGet).toHaveBeenCalledWith(`/api/mobile/prompts/${FR_SLUG}`);
    });

    it('writes the freshly fetched body + version into the cache map', async () => {
      apiGet.mockResolvedValueOnce(serverPrompt());
      const result = await refreshAndCache();
      expect(result.body).toBe(SERVER_BODY);
      expect(result.resolvedSlug).toBe(ANTOINE_PROMPT_SLUG);
      expect(result.isFallback).toBe(false);

      expect(secureSet).toHaveBeenCalledTimes(1);
      const [key, value] = secureSet.mock.calls[0]!;
      expect(key).toBe(STORAGE_KEYS.antoinePromptMap);
      const parsed = JSON.parse(value as string);
      expect(parsed[ANTOINE_PROMPT_SLUG]).toMatchObject({
        status: 'ok',
        body: SERVER_BODY,
        version: SERVER_VERSION,
      });
    });

    it('skips the SecureStore write when the cached version equals the server version', async () => {
      mockCacheMap({
        [ANTOINE_PROMPT_SLUG]: {
          status: 'ok',
          body: SERVER_BODY,
          version: SERVER_VERSION,
          cachedAt: 1,
        },
      });
      apiGet.mockResolvedValueOnce(serverPrompt());
      await refreshAndCache();
      expect(secureSet).not.toHaveBeenCalled();
    });

    it('overwrites when the server version differs', async () => {
      mockCacheMap({
        [ANTOINE_PROMPT_SLUG]: { status: 'ok', body: 'old', version: 1, cachedAt: 1 },
      });
      apiGet.mockResolvedValueOnce(serverPrompt({ version: 9, body: 'new' }));
      const result = await refreshAndCache();
      expect(result.body).toBe('new');
      expect(secureSet).toHaveBeenCalledTimes(1);
    });

    it('marks slug as not_found on a 404 ApiError', async () => {
      apiGet.mockRejectedValueOnce(new ApiError(404, 'not found'));
      const result = await refreshAndCache(FR_SLUG);
      // After 404, the resolution falls back to EN baked-in (no EN cache
      // either) and isFallback=true because FR is now known-missing.
      expect(result.resolvedSlug).toBe(ANTOINE_PROMPT_SLUG);
      expect(result.isFallback).toBe(true);
      // The cache map gets a not_found entry for the FR slug.
      expect(secureSet).toHaveBeenCalledTimes(1);
      const [, value] = secureSet.mock.calls[0]!;
      const parsed = JSON.parse(value as string);
      expect(parsed[FR_SLUG]).toMatchObject({ status: 'not_found' });
    });

    it('does NOT mark slug as not_found on a non-404 ApiError', async () => {
      apiGet.mockRejectedValueOnce(new ApiError(500, 'server error'));
      const result = await refreshAndCache(FR_SLUG);
      expect(result.body).toBe(ANTOINE_SYSTEM_PROMPT);
      // No cache write — 500 leaves the cache map untouched so a prior
      // ok/not_found entry survives the transient outage.
      expect(secureSet).not.toHaveBeenCalled();
    });

    it('returns the cached body on network failure', async () => {
      mockCacheMap({
        [ANTOINE_PROMPT_SLUG]: { status: 'ok', body: 'cached body', version: 3, cachedAt: 1 },
      });
      apiGet.mockRejectedValueOnce(new Error('network down'));
      const result = await refreshAndCache();
      expect(result.body).toBe('cached body');
    });

    it('returns the baked-in fallback on network failure with empty cache', async () => {
      apiGet.mockRejectedValueOnce(new Error('network down'));
      const result = await refreshAndCache();
      expect(result.body).toBe(ANTOINE_SYSTEM_PROMPT);
    });
  });

  describe('legacy v1.1 cache migration', () => {
    it('lifts the legacy single-slug cache into the map on first read', async () => {
      // v1.2 map missing, legacy key populated.
      secureGet.mockImplementation(async (key: string) => {
        if (key === STORAGE_KEYS.antoinePromptMap) return null;
        if (key === STORAGE_KEYS.antoinePrompt)
          return JSON.stringify({ body: 'legacy', version: 5, cachedAt: 99 });
        return null;
      });
      const result = await getActivePrompt();
      expect(result.body).toBe('legacy');
      // Migration should write the new map AND delete the legacy key.
      expect(secureSet).toHaveBeenCalledTimes(1);
      const [key] = secureSet.mock.calls[0]!;
      expect(key).toBe(STORAGE_KEYS.antoinePromptMap);
      expect(secureDelete).toHaveBeenCalledWith(STORAGE_KEYS.antoinePrompt);
    });
  });

  describe('getCachedVersion', () => {
    it('returns null when the cache is empty', async () => {
      expect(await getCachedVersion()).toBeNull();
    });

    it('returns the version field from a populated cache', async () => {
      mockCacheMap({
        [ANTOINE_PROMPT_SLUG]: { status: 'ok', body: 'x', version: 42, cachedAt: 1 },
      });
      expect(await getCachedVersion()).toBe(42);
    });

    it('returns null for a not_found slug', async () => {
      mockCacheMap({
        [FR_SLUG]: { status: 'not_found', checkedAt: 1 },
      });
      expect(await getCachedVersion(FR_SLUG)).toBeNull();
    });
  });
});
