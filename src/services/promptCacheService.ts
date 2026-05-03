/**
 * promptCacheService — fetch + cache the Antoine system prompt(s) from
 * the web backend's mobile prompt-fetch route, keyed by slug.
 *
 * v1.2 MULTI-LANGUAGE CACHE
 * -------------------------
 * Web admin authors prompts per language with version history at
 * `https://www.culinaire.kitchen/admin/prompts/{slug}`. Each save bumps
 * `version` (monotonic). Mobile fetches `GET /api/mobile/prompts/{slug}`
 * (Bearer-auth required) and caches responses keyed by slug in a single
 * SecureStore entry (one JSON map under STORAGE_KEYS.antoinePromptMap).
 *
 * The slug naming convention is locked at `antoine-system-prompt` (EN
 * base) and `antoine-system-prompt-{lang}` for each non-EN locale (e.g.
 * `antoine-system-prompt-fr`). Use `slugForLanguage(lang)` to derive.
 *
 * 404 SEMANTICS — partial-language UX
 * -----------------------------------
 * When a user picks a language whose slug has not been authored yet on
 * the web side, the fetch returns a clean 404. We mark the slug with
 * `{ status: 'not_found' }` in the cache so:
 *   1. Subsequent boots skip retrying for the duration of the cache (a
 *      future `refreshAndCache` call always retries — boot refresh
 *      naturally retries every cold launch).
 *   2. The next chat read for that slug resolves to the EN baked-in
 *      fallback AND signals `isFallback: true` so the chat surface can
 *      show a "this language has no authored prompt yet" banner.
 *
 * On every app launch:
 *   1. `refreshAndCache()` is fired off for the EN base slug AND for
 *      the user's currently selected language (best-effort, no blocking).
 *   2. The next chat message reads `getActivePrompt(slug)` which returns
 *      the cached body if any, or the baked-in `ANTOINE_SYSTEM_PROMPT`
 *      fallback when the cache is empty (first launch + offline).
 *
 * Privacy invariant: this service does NOT send conversation content.
 * Only the auth token leaves the device, used to identify the user for
 * rate limiting (30 requests / minute / user per the web contract).
 *
 * Web contract (verified 2026-04-30, extended for per-language v1.2):
 *   GET /api/mobile/prompts/:slug
 *   Auth: required
 *   200: { promptKey, promptBody, runtime: "device", modelId, version, updatedAtDttm }
 *   404: prompt not found OR is server-runtime (intentionally indistinguishable)
 *   429: rate limited
 *   5xx: { error: string }
 */
import * as SecureStore from 'expo-secure-store';

import { ANTOINE_SYSTEM_PROMPT } from '@/constants/antoine';
import { ANTOINE_PROMPT_SLUG, STORAGE_KEYS } from '@/constants/config';
import { apiClient } from '@/services/apiClient';
import { isApiError } from '@/services/__errors__';

/**
 * Server response for `GET /api/mobile/prompts/:slug` per the
 * 2026-04-30 web contract. Field names verbatim from the controller.
 */
interface PromptResponse {
  promptKey: string;
  promptBody: string;
  runtime: 'device';
  modelId: string | null;
  version: number;
  updatedAtDttm: string;
}

/**
 * Per-slug cache entry. Discriminated union so a slug can be
 * "successfully fetched once" OR "known-missing on the web side". The
 * not_found branch drives the partial-language banner UX in v1.2.
 */
type CacheEntry =
  | { status: 'ok'; body: string; version: number; cachedAt: number }
  | { status: 'not_found'; checkedAt: number };

type CacheMap = Record<string, CacheEntry | undefined>;

/**
 * Return shape for v1.2 callers. Most callers will read `.body`; the
 * inference + boot paths just need the prompt body. The chat surface
 * additionally inspects `isFallback` to decide whether to show the
 * "this language has no authored prompt yet" banner.
 */
export interface PromptResolution {
  /** The prompt body to use for inference. Capped to fit n_ctx. */
  body: string;
  /** Slug actually resolved (post-fallback). Either `slug` or the EN base. */
  resolvedSlug: string;
  /**
   * True when the requested slug is known-missing (404'd on a prior
   * fetch) and we fell back to the EN body. Drives partial-language
   * banner UX. False when the slug resolved cleanly OR when we're using
   * the baked-in EN fallback because nothing has been cached yet.
   */
  isFallback: boolean;
}

/**
 * Derive the per-language prompt slug from a BCP 47 language code.
 * Locked naming convention (Eng review D1, 2026-05-03):
 *   - 'en' → 'antoine-system-prompt' (base, no suffix)
 *   - 'fr' → 'antoine-system-prompt-fr'
 *   - 'it' → 'antoine-system-prompt-it'
 *   - etc.
 *
 * Dash separator only. URL/slug-safe. Mirrors the web admin's slug input.
 */
export function slugForLanguage(language: string): string {
  if (language === 'en') return ANTOINE_PROMPT_SLUG;
  return `${ANTOINE_PROMPT_SLUG}-${language}`;
}

async function readCacheMap(): Promise<CacheMap> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEYS.antoinePromptMap);
    if (raw) {
      const parsed = JSON.parse(raw) as CacheMap;
      if (parsed && typeof parsed === 'object') return parsed;
      return {};
    }
  } catch {
    // Corrupt entry — overwrite next refresh.
    return {};
  }

  // One-shot v1.1→v1.2 migration: read the legacy single-slug cache key
  // and lift it into the new keyed map. After migration, delete the
  // legacy key so it doesn't clutter SecureStore. If migration fails
  // for any reason (corrupt JSON, missing fields), just return empty —
  // refresh will repopulate on next boot.
  try {
    const legacy = await SecureStore.getItemAsync(STORAGE_KEYS.antoinePrompt);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<{
        body: string;
        version: number;
        cachedAt: number;
      }>;
      if (typeof parsed.body === 'string' && typeof parsed.version === 'number') {
        const map: CacheMap = {
          [ANTOINE_PROMPT_SLUG]: {
            status: 'ok',
            body: parsed.body,
            version: parsed.version,
            cachedAt: typeof parsed.cachedAt === 'number' ? parsed.cachedAt : 0,
          },
        };
        await writeCacheMap(map).catch(() => undefined);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.antoinePrompt).catch(() => undefined);
        return map;
      }
    }
  } catch {
    // Fall through — empty cache is fine.
  }
  return {};
}

async function writeCacheMap(map: CacheMap): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.antoinePromptMap, JSON.stringify(map));
}

/**
 * Cap the system prompt length at the cache boundary. Antoine runs at
 * n_ctx=1536 on the test device (Moto G86 Power, 8 GB) — anything more
 * OOMs the kernel low-memory killer. With n_predict=384 reserved for the
 * reply and ~1000 chars set aside for the RAG block + user query + chat
 * template wrappers, the system prompt must fit in roughly 3000 chars
 * (~750 tokens).
 *
 * If the server-authored prompt exceeds this, we truncate at the cache
 * boundary and log a warning so the developer knows to shorten it on the
 * web admin. Truncation slices on a sentence boundary when possible to
 * avoid leaving the model staring at a half-word.
 */
const MAX_SYSTEM_PROMPT_CHARS = 3000;

function fitToBudget(body: string): string {
  if (body.length <= MAX_SYSTEM_PROMPT_CHARS) return body;
  console.warn(
    `[promptCacheService] system prompt is ${body.length} chars — truncating to ${MAX_SYSTEM_PROMPT_CHARS} for n_ctx=1536. Shorten it on the web admin to avoid this.`,
  );
  const slice = body.slice(0, MAX_SYSTEM_PROMPT_CHARS);
  const lastSentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'));
  return lastSentence > MAX_SYSTEM_PROMPT_CHARS - 400 ? slice.slice(0, lastSentence + 1) : slice;
}

async function fetchActivePrompt(slug: string): Promise<PromptResponse> {
  return apiClient.get<PromptResponse>(`/api/mobile/prompts/${slug}`);
}

/**
 * Pure resolution from a known cache map. Extracted so refreshAndCache
 * can resolve in-memory after a write without paying for a redundant
 * SecureStore round-trip (and also so unit tests with a stateless
 * SecureStore mock don't have to simulate read-after-write).
 *
 * Resolution order:
 *   1. `map[slug]` with `status: 'ok'` → use it.
 *   2. `map[slug]` with `status: 'not_found'` → fall back to EN slug's
 *      cached body (or baked-in default), with `isFallback: true` to
 *      drive the partial-language banner.
 *   3. No `map[slug]` AND slug is not the EN base → fall back to EN
 *      slug's cached body or baked-in default. `isFallback: false`
 *      because we haven't yet confirmed the slug is missing.
 *   4. EN base slug, no cache → baked-in `ANTOINE_SYSTEM_PROMPT`.
 */
function resolveFromMap(map: CacheMap, slug: string): PromptResolution {
  const entry = map[slug];

  if (entry?.status === 'ok') {
    return { body: fitToBudget(entry.body), resolvedSlug: slug, isFallback: false };
  }

  // Slug is known-missing OR not yet attempted: fall back to EN.
  if (slug !== ANTOINE_PROMPT_SLUG) {
    const fallbackEntry = map[ANTOINE_PROMPT_SLUG];
    const fallbackBody =
      fallbackEntry?.status === 'ok' ? fallbackEntry.body : ANTOINE_SYSTEM_PROMPT;
    return {
      body: fitToBudget(fallbackBody),
      resolvedSlug: ANTOINE_PROMPT_SLUG,
      // Only flag isFallback when slug is KNOWN missing (404). If never
      // attempted (offline first launch after picker), leave isFallback
      // false so the banner doesn't shame us during in-flight refresh.
      isFallback: entry?.status === 'not_found',
    };
  }

  // EN base slug, no cache: baked-in fallback. Not a partial-language
  // situation — there's always an EN prompt baked into the binary.
  return {
    body: fitToBudget(ANTOINE_SYSTEM_PROMPT),
    resolvedSlug: ANTOINE_PROMPT_SLUG,
    isFallback: false,
  };
}

/**
 * Resolve the prompt body the inference layer should use right now for
 * the given slug.
 *
 * This call NEVER hits the network. The fetch happens via
 * `refreshAndCache()` at app boot, fire-and-forget. The chat hot path
 * stays synchronous-feeling. The returned body is capped to fit the
 * device's context window — see `fitToBudget()`. See `resolveFromMap`
 * for the full resolution order.
 */
export async function getActivePrompt(
  slug: string = ANTOINE_PROMPT_SLUG,
): Promise<PromptResolution> {
  const map = await readCacheMap();
  return resolveFromMap(map, slug);
}

/**
 * Boot-time refresh. Fetches the latest prompt for `slug` and writes
 * to the cache map. Called from RootLayout's effect chain — best-effort,
 * never throws to the caller.
 *
 * On 404: marks the slug as `status: 'not_found'` so the next
 * `getActivePrompt(slug)` returns the EN body with `isFallback: true`.
 * On other errors (network, 429, 5xx): leaves the cache untouched so a
 * pre-existing `status: 'ok'` entry continues to serve.
 *
 * Returns the resolved prompt — useful for tests and for the boot
 * effect's downstream KV-state warmup which needs the prompt body
 * already in hand.
 */
export async function refreshAndCache(
  slug: string = ANTOINE_PROMPT_SLUG,
): Promise<PromptResolution> {
  const map = await readCacheMap();
  try {
    const fresh = await fetchActivePrompt(slug);
    const prior = map[slug];
    // Only write when the version differs (or no prior). Avoids a
    // SecureStore round-trip on every boot when nothing has changed.
    if (!(prior && prior.status === 'ok' && prior.version === fresh.version)) {
      map[slug] = {
        status: 'ok',
        body: fresh.promptBody,
        version: fresh.version,
        cachedAt: Date.now(),
      };
      await writeCacheMap(map);
    }
    return { body: fitToBudget(fresh.promptBody), resolvedSlug: slug, isFallback: false };
  } catch (e) {
    if (isApiError(e) && e.status === 404) {
      // Mark known-missing so subsequent reads can short-circuit and the
      // chat surface can show a partial-language banner. The next cold
      // launch's refresh will retry naturally and overwrite if the web
      // admin has authored the prompt in the meantime.
      map[slug] = { status: 'not_found', checkedAt: Date.now() };
      await writeCacheMap(map).catch(() => undefined);
    }
    // Any other error: don't touch the cache. Resolve from whatever
    // we already have (either the slug's own cache, EN fallback cache,
    // or baked-in EN). Use the in-memory map post-write rather than
    // re-reading SecureStore — both faster and tolerant of a stateless
    // SecureStore mock in unit tests.
    return resolveFromMap(map, slug);
  }
}

/**
 * Test/diagnostic helper. Reads the cached version number for `slug`,
 * or null if the cache is empty / not_found. Useful for asserting
 * "prompt was refreshed" in boot-flow integration tests without
 * comparing prompt bodies.
 */
export async function getCachedVersion(slug: string = ANTOINE_PROMPT_SLUG): Promise<number | null> {
  const map = await readCacheMap();
  const entry = map[slug];
  return entry?.status === 'ok' ? entry.version : null;
}
