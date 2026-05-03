/**
 * featureFlagsService — fetch + cache the mobile feature-flag bundle
 * from the web backend.
 *
 * v1.2 scope:
 *   `GET /api/mobile/feature-flags` returns `{ languages_enabled: string[] }`
 *   listing the BCP 47 codes whose authored Antoine system prompt slugs
 *   are signed-off on the web side. Mobile uses this list to decide
 *   which languages the picker surfaces; non-listed languages stay
 *   hidden from the user even if their UI bundle is shipped.
 *
 * Cache strategy:
 *   - Fetched at boot (best-effort, never blocks app launch).
 *   - Persisted in SecureStore so the picker can populate offline on
 *     subsequent cold launches.
 *   - Default before first successful fetch: `['en']` only — the
 *     conservative shape every build can serve regardless of network
 *     state.
 *
 * Privacy invariant: this service does NOT send conversation content.
 * Only the auth token leaves the device for rate-limit identification.
 *
 * Web contract (verified 2026-05-03):
 *   GET /api/mobile/feature-flags
 *   Auth: required (Bearer JWT)
 *   200: { languages_enabled: string[] }
 *   429: rate limited
 *   5xx: { error: string }
 *   Cache-Control: public, max-age=3600
 */
import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from '@/constants/config';
import { apiClient } from '@/services/apiClient';

export interface FeatureFlags {
  /** BCP 47 codes whose authored prompt slugs are signed off. */
  languagesEnabled: string[];
}

interface FeatureFlagsResponse {
  languages_enabled: string[];
}

/**
 * Default flag set used when neither cache nor server has an answer.
 * Intentionally minimal — every build ships the EN bundle and has a
 * baked-in EN system prompt fallback, so EN is always safe.
 */
const DEFAULT_FLAGS: FeatureFlags = { languagesEnabled: ['en'] };

async function readCache(): Promise<FeatureFlags | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEYS.featureFlags);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    if (Array.isArray(parsed.languagesEnabled)) {
      const langs = parsed.languagesEnabled.filter((x): x is string => typeof x === 'string');
      return { languagesEnabled: langs };
    }
  } catch {
    // Corrupt — fall through to null so refresh repopulates.
  }
  return null;
}

async function writeCache(flags: FeatureFlags): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.featureFlags, JSON.stringify(flags));
}

/**
 * Returns the current feature flags. Reads cache only — never hits the
 * network. Falls back to `DEFAULT_FLAGS` if no cache exists yet.
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const cached = await readCache();
  return cached ?? DEFAULT_FLAGS;
}

/**
 * Boot-time refresh. Fetches the latest feature-flag bundle from the
 * server and writes to cache. Best-effort — never throws to the caller.
 *
 * On any error (offline, 429, 5xx, malformed payload) the existing
 * cached value (or DEFAULT_FLAGS if none) is returned, so the picker
 * stays usable.
 */
export async function refreshFeatureFlags(): Promise<FeatureFlags> {
  try {
    const res = await apiClient.get<FeatureFlagsResponse>('/api/mobile/feature-flags');
    const flags: FeatureFlags = {
      languagesEnabled: Array.isArray(res.languages_enabled)
        ? res.languages_enabled.filter((x): x is string => typeof x === 'string')
        : ['en'],
    };
    // Defensive: server should never return an empty list, but if it
    // does, refuse to cache an empty bundle — picker would have nothing
    // to show. Keep whatever was cached before, or fall back to default.
    if (flags.languagesEnabled.length === 0) {
      const cached = await readCache();
      return cached ?? DEFAULT_FLAGS;
    }
    await writeCache(flags);
    return flags;
  } catch {
    const cached = await readCache();
    return cached ?? DEFAULT_FLAGS;
  }
}
