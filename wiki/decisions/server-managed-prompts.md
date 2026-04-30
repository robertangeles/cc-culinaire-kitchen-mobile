---
title: System prompt is fetched from the server, not bundled
category: decision
created: 2026-04-30
updated: 2026-04-30
related: [[antoine]], [[privacy-invariant]], [[rag-architecture]], [[web-backend]]
---

The Antoine system prompt is authored on the web admin (with version history), fetched on app boot, cached in SecureStore, and used on the next message. The baked-in `ANTOINE_SYSTEM_PROMPT` constant becomes the offline-first-launch fallback, not the source of truth.

## The decision

Source of truth for the active system prompt: **web admin → `GET /api/mobile/prompts/antoine-system-prompt`**.

On-device cache: SecureStore key `STORAGE_KEYS.antoinePrompt`, shape `{ body: string, version: number, cachedAt: number }`.

Fallback chain at chat time (`promptCacheService.getActivePrompt()`):

1. Cache present → return cached body.
2. Cache empty or corrupt → return baked-in `ANTOINE_SYSTEM_PROMPT` from `src/constants/antoine.ts`.

Refresh trigger: `app/_layout.tsx` boot effect calls `refreshAndCache()` fire-and-forget. Compares server `version` to cached `version`; writes to SecureStore only when different. No TTL, no background refresh — boot-time pull is sufficient.

## Why fetch instead of bundle

1. **Iteration speed.** Tweaking Antoine's voice, tightening a prompt rule, or trying a new instruction shouldn't require a Play Store release (7-day review). Author server-side, observe on-device on the next app launch.
2. **Version history is server-side already.** The web's prompts table is versioned (`updatedAtDttm`, sequence numbers). Bundling forfeits that.
3. **Single body of truth across the product surface.** The same prompt powers the web's server-runtime prompts and the mobile's device-runtime prompt. They're authored in the same admin UI; runtime is just a column.
4. **No new SDK or service.** The fetch reuses `apiClient` (auth headers, 401-refresh-retry single-flight, error normalization) and `expo-secure-store` (already there for tokens). Net new code: ~80 lines, one service file.

## Why the cache-with-fallback pattern

The product must boot and chat **even when offline** — Antoine's pitch is "private culinary intelligence on your phone, no internet required for inference." If the boot-time prompt fetch fails, we don't want a degraded experience.

Cache-with-fallback gives:

| Condition                                        | Outcome                                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| First launch, online                             | Boot effect fetches → caches → next chat uses fresh prompt.                                   |
| First launch, offline                            | Cache empty → `getActivePrompt()` returns baked-in `ANTOINE_SYSTEM_PROMPT`. App fully usable. |
| Later launch, online, prompt unchanged on server | Boot effect hits server, sees same `version`, skips SecureStore write.                        |
| Later launch, online, prompt updated server-side | Boot effect writes new body + version. Next chat picks it up.                                 |
| Later launch, offline                            | Cached body used.                                                                             |

## Why a single prompt, not a switcher

The web admin manages six prompts (server-runtime: patisserie, recipe, etc.). For mobile v1, **only one slug ships**: `antoine-system-prompt`, the conversational head-chef voice. Reasons:

- The 10-star moment is a calm, grounded conversation — not a mode-switcher UI. Adding a chooser dilutes the feel.
- Multi-mode would mean fetching 6 prompts on boot or lazy-fetching per mode. Both add latency and offline edge cases.
- If a mode ever ships (patisserie focus, recipe-only mode), it's an additive change: add a slug, add a fetch, add a UI control. The current pattern doesn't preclude it.

## Why version-only refresh, not body-diff

The server returns a `version: number` in the response. We compare cached vs server version and skip the SecureStore write when equal. Why not always overwrite? SecureStore writes on Android route through Keystore and aren't free — small but real I/O on every boot. Saving the write when the prompt is unchanged keeps the boot path lean.

## Privacy posture

The prompt body crosses the boundary inbound only — server → device. The device never re-uploads it; it doesn't appear in any payload sent back to the web. The fetch URL contains a non-secret slug, not user data.

## Failure modes

| Condition          | Behavior                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| 401                | `apiClient` refreshes the token + retries single-flight. Transparent.                                |
| 5xx / network down | `refreshAndCache()` returns the cached body if present, else the baked-in fallback. App still chats. |
| Malformed response | Falls back to cached body, then baked-in.                                                            |
| Cache JSON corrupt | Returns baked-in body.                                                                               |

## Trade-offs explicitly accepted

- **First-launch online users get the baked-in prompt for one turn.** The boot effect is fire-and-forget; if a user fires off a message before the fetch resolves, their first reply uses `ANTOINE_SYSTEM_PROMPT`. Cost: ~one turn of slightly older voice. Mitigation: keep the baked-in body close to the current server state at every release.
- **No TTL.** A user with stale cache who never goes online won't get prompt updates. Acceptable — by definition, an offline user has bigger problems than a one-week-old prompt rev.
- **No graceful migration if the prompt schema changes.** If the server adds, say, `tokenLimits` to the response, mobile silently ignores fields it doesn't read. If the server _removes_ `promptBody`, mobile falls back. We keep the contract additive on the web side.

## See also

- [[privacy-invariant]] — what crosses the boundary
- [[rag-architecture]] — the sibling fetch that introduced the same pattern
- `src/services/promptCacheService.ts` — implementation
- `src/constants/antoine.ts` — the baked-in fallback
- `src/constants/config.ts` → `STORAGE_KEYS.antoinePrompt` + `ANTOINE_PROMPT_SLUG`
