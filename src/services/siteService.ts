/**
 * siteService — fetch + cache mobile-surface legal/static pages from
 * the web backend.
 *
 * v1.2 scope:
 *   `GET /api/site-pages/:slug?surface=mobile` returns a JSON envelope
 *   with `bodyMd` (markdown) + `title`. The mobile app renders the
 *   markdown natively via LegalPageScreen, so legal copy stays a single
 *   source of truth on the web (legal counsel updates the web admin's
 *   "Settings → Mobile → Pages" surface; the device picks up the new
 *   body on the next fetch — no mobile release required).
 *
 * Caching:
 *   - Each slug's full envelope is cached in SecureStore under a single
 *     keyed JSON map (STORAGE_KEYS.sitePages). Read at render time;
 *     refresh is fired in parallel and updates state when it lands.
 *   - Cache survives app restart so the user can read the legal copy
 *     offline after one online fetch (e.g. on a flight before signing
 *     up).
 *
 * 404 SEMANTICS:
 *   The endpoint returns 404 when the row is unpublished (draft on the
 *   admin side) OR doesn't exist. We surface this distinctly via
 *   `status: 'unavailable'` so the UI can show a "this page is being
 *   prepared — check back soon" placeholder instead of an empty body.
 *
 * Privacy invariant: this service does NOT send conversation content.
 * The endpoint is public (no auth) and serves static legal/marketing
 * markdown only.
 *
 * Web contract (verified 2026-05-03):
 *   GET /api/site-pages/:slug?surface=mobile
 *   Auth: none
 *   200: {
 *     pageId, slug, surface: "mobile",
 *     title, bodyMd, publishedInd: true,
 *     createdDttm, updatedDttm
 *   }
 *   404: page is unpublished/missing on the requested surface
 *   5xx: { error: string }
 */
import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL, STORAGE_KEYS } from '@/constants/config';
import { ApiError, NetworkError } from '@/services/__errors__';

/**
 * Server response shape for a 200. Field names verbatim from the
 * web-side controller (see api-contracts.md `site-pages` section).
 */
interface SitePageResponse {
  pageId: string;
  slug: string;
  surface: 'mobile' | 'web';
  title: string;
  bodyMd: string;
  publishedInd: boolean;
  createdDttm: string;
  updatedDttm: string;
}

/**
 * Public resolution shape. The status field discriminates the three
 * outcomes the UI cares about:
 *   - `ok`: page is available, has body + title.
 *   - `unavailable`: server returned 404 — the page is unpublished or
 *     missing on the requested surface. Show the friendly placeholder.
 *   - `error`: network or 5xx — show retry UI. Cached body, if any,
 *     is still returned alongside so the user isn't stranded offline.
 */
export type SitePageResolution =
  | { status: 'ok'; title: string; bodyMd: string; updatedAt: string; fromCache: boolean }
  | { status: 'unavailable' }
  | { status: 'error'; cached: { title: string; bodyMd: string } | null };

interface CacheEntry {
  title: string;
  bodyMd: string;
  updatedAt: string;
  cachedAt: number;
}

type CacheMap = Record<string, CacheEntry | undefined>;

async function readCacheMap(): Promise<CacheMap> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEYS.sitePages);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheMap;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Corrupt — overwrite next refresh.
  }
  return {};
}

async function writeCacheMap(map: CacheMap): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.sitePages, JSON.stringify(map));
}

/**
 * Fetch `slug` from the mobile-surface site-pages endpoint and cache
 * the result. Returns a discriminated resolution covering ok / 404 /
 * other errors.
 *
 * The hot UI path is:
 *   1. Render whatever's in `getCachedSitePage(slug)` immediately.
 *   2. Call `fetchSitePage(slug)` in parallel; when it resolves, swap
 *      the rendered body + title to the fresh server copy.
 *
 * Public endpoint — no Bearer header. We use plain `fetch` instead of
 * apiClient so we don't accidentally attach the user's auth token to
 * an unauthenticated request.
 */
export async function fetchSitePage(slug: string): Promise<SitePageResolution> {
  const url = `${API_BASE_URL}/api/site-pages/${slug}?surface=mobile`;
  const map = await readCacheMap();

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new NetworkError(`Failed to reach ${url}`);
  }

  if (res.status === 404) {
    return { status: 'unavailable' };
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Site-page fetch failed (${res.status})`);
  }

  const json = (await res.json()) as SitePageResponse;
  if (typeof json.bodyMd !== 'string' || typeof json.title !== 'string') {
    throw new ApiError(res.status, 'Malformed site-page response');
  }

  // Update cache.
  map[slug] = {
    title: json.title,
    bodyMd: json.bodyMd,
    updatedAt: json.updatedDttm,
    cachedAt: Date.now(),
  };
  await writeCacheMap(map).catch(() => undefined);

  return {
    status: 'ok',
    title: json.title,
    bodyMd: json.bodyMd,
    updatedAt: json.updatedDttm,
    fromCache: false,
  };
}

/**
 * Read the most recently cached body for a slug. Used by
 * LegalPageScreen for an immediate render before the fresh fetch lands.
 * Returns null if the slug has never been fetched successfully.
 */
export async function getCachedSitePage(
  slug: string,
): Promise<Extract<SitePageResolution, { status: 'ok' }> | null> {
  const map = await readCacheMap();
  const entry = map[slug];
  if (!entry) return null;
  return {
    status: 'ok',
    title: entry.title,
    bodyMd: entry.bodyMd,
    updatedAt: entry.updatedAt,
    fromCache: true,
  };
}

/**
 * Convenience: try fetch first; on network/server error, fall back to
 * the cached entry if any. Returns a discriminated resolution that
 * includes the cached payload on the error branch so callers can
 * still render something useful offline.
 */
export async function loadSitePage(slug: string): Promise<SitePageResolution> {
  try {
    return await fetchSitePage(slug);
  } catch {
    const cached = await getCachedSitePage(slug);
    return {
      status: 'error',
      cached: cached ? { title: cached.title, bodyMd: cached.bodyMd } : null,
    };
  }
}
