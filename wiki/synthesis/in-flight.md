---
title: In flight — what's being worked on right now
category: synthesis
created: 2026-04-29
updated: 2026-04-29
related: [[project-status]]
---

The single source of truth for "where we are right now". Updated at the end of every session and read at the start of every new one. Always short (under 30 lines).

> **Read this FIRST in any new session, before `index.md` or anything else.** It tells you what to pick up.

## Status

**llama.rn integration code-complete; awaiting device verification.** All JS/TS pieces landed locally on `feature/ck-mob/ci-workflow` (or the next branch — confirm with `git status`); device build + on-device sanity check pending.

## Last completed

- **llama.rn integration (code path).** Replaced the stub in `src/services/inferenceService.ts` with real `llama.rn` calls. Added `src/services/modelLocator.ts` (resolves the GGUF path from the BackgroundDownloadModule's `getDocumentDirectory()` with SecureStore override). Added a streaming slice to `conversationStore` (`startStreaming` / `appendStreamingToken` / `commitStreaming` / `clearStreaming`). `useAntoine.send()` now streams tokens as the user watches Antoine type. `ChatList` renders a virtual in-progress bubble during streaming. Added `plugins/withLlamaRn` config plugin for the ProGuard keep rule. New tests: `inferenceService` (rewritten against llama.rn jest mock), `modelLocator`, `conversationStore.streaming`, integration `useAntoine.streaming`. Privacy audit clean. tsc + lint + 94 tests green.
- PR #5 — Wi-Fi/cellular toggle + unified DownloadingScreen routing + safe-area fix. Merged.

## Currently in flight

The llama.rn integration is **not yet device-verified.** Next session must:

1. Run `pnpm android` (triggers `expo prebuild` + native rebuild — first build will be long, llama.rn ships ~150 MB of native libs).
2. On the Moto G86 Power: ask Antoine "How do I rescue broken hollandaise?" → confirm reply streams token-by-token from real Gemma weights.
3. Multi-turn: confirm Antoine refers back to earlier turns.
4. Record steady-state RAM via `adb shell dumpsys meminfo com.anonymous.ccculinairekitchenmob`. Add the number to [[llama-rn-inference-params]].
5. Commit + open PR.

## Next action — pick one

1. **Device verify llama.rn (recommended).** Fastest path to MVP. Likely surfaces small fixes (cold-load UX, peer-dep mismatches, stop-token leakage) — keep them small.
2. **Streaming polish.** Token throttling (only if device shows render thrash) and a "stop generating" button. Defer unless device run reveals a need.
3. **`react-native-iap` for Google Play Billing.** Independent track from inference; can run in parallel.

## Open questions / blockers

- llama.rn 0.11.5 ships native libs for arm64-v8a + x86_64. Moto G86 Power is arm64 → fine. iOS path is untested.
- The cached `LlamaContext` in `useAntoine.ts` is module-level; a future settings path-override UI must call `releaseAllLlama()` and reset the cache. TODO comment is in place.

## How to update this page

End of every session, before stopping:

1. Move what was just completed into "Last completed" (keep only the 2–3 most recent — older work belongs in `wiki/log.md`).
2. Update "Currently in flight" to reflect what got paused mid-flight, if anything (a branch name, an open PR number, a function half-written).
3. Update "Next action" to the _one or two_ concrete next steps.
4. Append today's session summary to `wiki/log.md` for the long-form record.

If a session ended with no in-flight work and no obvious next step, write that explicitly: "Idle between milestones. User to pick direction." That's a valid state.

## See also

- [[project-status]] — slow-changing narrative of shipped milestones
- `wiki/log.md` — append-only history
- `tasks/todo.md` — prioritized roadmap
