---
title: In flight — what's being worked on right now
category: synthesis
created: 2026-04-29
updated: 2026-04-30
related: [[project-status]], [[model-quantization-must-be-mainline]], [[rag-architecture]], [[server-managed-prompts]], [[privacy-invariant]]
---

The single source of truth for "where we are right now". Updated at the end of every session and read at the start of every new one. Always short (under 30 lines).

> **Read this FIRST in any new session, before `index.md` or anything else.** It tells you what to pick up.

## Status

**RAG + dynamic system prompt code-complete and tested; pending device verification.** The full chat path now reads: persist user → fetch cached server prompt + retrieve RAG chunks (parallel) → ensure llama.rn context → completion(messages = [system prompt, RAG block, history, user]) → stream tokens → commit assistant message with Sources footer. 122 tests passing across 23 suites; tsc + lint clean.

The 10-star moment is unblocked: web-served prompt + corpus-grounded answers + on-device inference + privacy invariant intact (only the current query crosses the boundary).

Local working tree: branch `feature/ck-mob/llama-rn-integration` has unpushed work spanning the llama.rn upgrade to 0.12.0-rc.5, the four device-session hotfixes, the new `promptCacheService` + `ragService`, the `useAntoine` rewrite, the streaming-stage UX, the keyboard fix, and today's wiki updates. Web pin advanced to `8a72295` (RAG endpoint deploy).

## Last completed

- **RAG retrieval wired.** `src/services/ragService.ts` wraps `POST /api/mobile/rag/retrieve`, 3s hard timeout, silent fallback to `[]` on every failure mode. Citation-aware `[n]` formatting. Unit tests cover request shape, response handling, error fallbacks, timeout.
- **Dynamic system prompt fetched + cached.** `src/services/promptCacheService.ts` fetches `GET /api/mobile/prompts/antoine-system-prompt` on boot, caches in SecureStore with version comparison, falls back to baked-in `ANTOINE_SYSTEM_PROMPT` when offline.
- **`useAntoine.send()` rewritten.** Three-stage streaming bubble (`retrieving` → `warming` → `streaming`), parallel prompt + RAG fetch, Sources footer appended on commit.
- **Streaming-bubble UX.** `ChatList` now renders virtual bubble whenever `streamingStage !== null`; subtitles "Antoine is consulting your library…" / "Antoine is warming up…" surface the silent gaps the user flagged earlier.
- **Keyboard dismiss fix.** Replaced `useAnimatedKeyboard` with explicit `Keyboard.addListener` + `withTiming` (Android 14+ edge-to-edge bug).
- **Cross-project shared dir at `../cc-culinaire-shared-context/`** seeded with `model-config.md` (mobile-owned) per CLAUDE.md ownership rules.
- **Tests.** 13 unit (`promptCacheService`), 11 unit (`ragService`), 7 integration (`useAntoine.streaming` rewrite covering RAG injection, Sources footer, fallback paths).
- **Wiki.** `privacy-invariant.md` rewritten for the queries-leave/responses-stay boundary; new `concepts/rag-architecture.md`; new `decisions/server-managed-prompts.md`; `entities/antoine.md` gets Knowledge sources section.

## Currently in flight

Nothing blocked. Code-complete. Awaiting commit + device verification.

## Next action

1. **Commit + push.** Stage the llama.rn upgrade, the four hotfixes, the RAG/prompt services, hook + UI updates, tests, and wiki. Single feature branch, single PR.
2. **Device verification.** With Metro reloaded and the new app installed:
   - Ask "Why does my hollandaise break?" → confirm streaming bubble shows "consulting your library…" → "warming up…" → tokens stream → Sources footer renders with `[1] On Food and Cooking` etc.
   - Multi-turn: ask follow-up. Confirm prior turn's chunks aren't re-sent (each query gets fresh retrieval); confirm history is included.
   - Airplane mode: ask a question. RAG fetches fail silently (3s); Antoine answers without citations using cached system prompt + history.
   - Update server-side prompt via web admin → relaunch app → confirm new prompt active on next chat.
3. **Open PR** with description summarizing the three subsystems (llama.rn integration, RAG, dynamic prompts) once verified.

## Open questions / blockers

- llama.rn 0.12.0-rc.5 is the pin (last RC with prebuilt JNI libs). Future bump to a stable 0.12.0 will need source-build + Python 3.14/CMake 3.22 fix.
- The cached `LlamaContext` is module-level; a future settings path-override UI must call `releaseAllLlama()` and reset the cache. TODO comment is in place.
- Latent: duplicate-Q4_K_M-row race in `modelDownloadService.start()` — two concurrent `start()` calls create duplicate Room rows. Doesn't cause file deletion but is messy.
- The `apiClient.post` doesn't yet thread an `AbortSignal`, so the 3s RAG timeout drops the response but doesn't cancel the fetch. Cheap follow-up.

## See also

- [[project-status]] — slow-changing narrative of shipped milestones
- [[rag-architecture]] — the data flow shipped today
- [[server-managed-prompts]] — the cache-with-fallback pattern shipped today
- [[privacy-invariant]] — the rule that the new query-leaves boundary refines
- [[model-quantization-must-be-mainline]] — why mainline llama.cpp tooling is the only way
- `wiki/log.md` — append-only history
