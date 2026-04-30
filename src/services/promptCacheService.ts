/**
 * promptCacheService — fetch + cache the Antoine system prompt from the
 * web backend's mobile prompt-fetch route.
 *
 * Web admin authors the prompt with version history at
 * `https://www.culinaire.kitchen/admin/prompts/antoine-system-prompt`.
 * Each save bumps `version` (monotonic). Mobile fetches via
 * `GET /api/mobile/prompts/antoine-system-prompt` (Bearer-auth required)
 * and caches `{ promptBody, version, cachedAt }` in SecureStore.
 *
 * On every app launch:
 *   1. `refreshAndCache()` is fired off (best-effort, no blocking).
 *   2. The next chat message reads `getActivePrompt()` which returns the
 *      cached body if any, or the baked-in `ANTOINE_SYSTEM_PROMPT`
 *      fallback if the cache is empty (first launch + offline).
 *
 * Privacy invariant: this service does NOT send conversation content.
 * Only the auth token leaves the device, used to identify the user for
 * rate limiting (30 requests / minute / user per the web contract).
 *
 * Web contract (verified 2026-04-30):
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

/** Shape persisted in SecureStore. JSON-serialised under STORAGE_KEYS.antoinePrompt. */
interface CachedPrompt {
  body: string;
  version: number;
  /** Epoch ms when the cache was last written. Diagnostic only. */
  cachedAt: number;
}

/**
 * Fetch the active prompt from the server. Throws on network error,
 * non-200 response, or unexpected payload shape.
 */
async function fetchActivePrompt(): Promise<PromptResponse> {
  return apiClient.get<PromptResponse>(`/api/mobile/prompts/${ANTOINE_PROMPT_SLUG}`);
}

async function readCache(): Promise<CachedPrompt | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEYS.antoinePrompt);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedPrompt>;
    if (typeof parsed.body === 'string' && typeof parsed.version === 'number') {
      return {
        body: parsed.body,
        version: parsed.version,
        cachedAt: typeof parsed.cachedAt === 'number' ? parsed.cachedAt : 0,
      };
    }
  } catch {
    // Corrupt entry — treat as missing. The next refresh overwrites.
  }
  return null;
}

async function writeCache(body: string, version: number): Promise<void> {
  const value: CachedPrompt = { body, version, cachedAt: Date.now() };
  await SecureStore.setItemAsync(STORAGE_KEYS.antoinePrompt, JSON.stringify(value));
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

/**
 * Returns the prompt the inference layer should use right now.
 *
 * Resolution order:
 *   1. SecureStore cache (server prompt that was fetched on a prior launch).
 *   2. Baked-in `ANTOINE_SYSTEM_PROMPT` constant (first-launch offline fallback).
 *
 * This call NEVER hits the network. The fetch happens via
 * `refreshAndCache()` at app boot, fire-and-forget. The chat hot path
 * stays synchronous-feeling. The returned body is capped to fit the
 * device's context window — see `fitToBudget()`.
 */
export async function getActivePrompt(): Promise<string> {
  const cached = await readCache();
  return fitToBudget(cached ? cached.body : ANTOINE_SYSTEM_PROMPT);
}

/**
 * Boot-time refresh. Fetches the latest prompt and writes to cache if
 * the server's `version` differs from what we have. Called from
 * RootLayout's effect chain — best-effort, never throws to the caller.
 *
 * Returns the body that's now active (cached or fetched). Useful for
 * tests; production callers can ignore the return value.
 */
export async function refreshAndCache(): Promise<string> {
  const cached = await readCache();
  try {
    const fresh = await fetchActivePrompt();
    if (!cached || cached.version !== fresh.version) {
      await writeCache(fresh.promptBody, fresh.version);
    }
    return fresh.promptBody;
  } catch {
    // Offline, 404, 429, 5xx — anything. Use cached if we have it,
    // baked-in fallback otherwise. Never crash app boot on this.
    if (cached) return cached.body;
    return ANTOINE_SYSTEM_PROMPT;
  }
}

/**
 * Test/diagnostic helper. Reads the cached version number, or null if
 * the cache is empty. Useful for asserting "prompt was refreshed" in
 * boot-flow integration tests without comparing prompt bodies.
 */
export async function getCachedVersion(): Promise<number | null> {
  const cached = await readCache();
  return cached?.version ?? null;
}
