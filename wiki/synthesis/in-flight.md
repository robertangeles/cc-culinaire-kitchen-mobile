---
title: In flight — what's being worked on right now
category: synthesis
created: 2026-04-29
updated: 2026-05-01
related: [[project-status]], [[model-quantization-must-be-mainline]], [[rag-architecture]], [[server-managed-prompts]], [[privacy-invariant]], [[llama-rn-inference-params]]
---

The single source of truth for "where we are right now". Updated at the end of every session and read at the start of every new one. Always short (under 30 lines).

> **Read this FIRST in any new session, before `index.md` or anything else.** It tells you what to pick up.

## Status

**Lite branding shipped + post-auth onboarding flash fixed.** PR #14 squash-merged as `f143b49`. The app is now visibly differentiated as the Lite build wherever the brand mark appears, and returning users no longer see the onboarding screen flash between sign-in and the chat tab. Display name in `app.config.ts` is `CulinAIre Kitchen Lite` — picks up on next `pnpm android` rebuild for the home-screen icon label.

Earlier today: PR #13 (`190bc64`) — streaming-bubble verb rotation; PR #12 (`1e90499`) — KV-state persistence + boot pre-warm. Plus branch protection on main applied via `gh api`. All branches deleted on remote, local `main` synced.

## Last completed (today)

- **PR #14 merged (`f143b49`).** Rebrand to "CulinAIre Kitchen Lite" — display name in `app.config.ts`, new `LiteBadge` component (copper-outlined Inter pill), wired into `Wordmark` and `BrandGlyph` (auto-suppressed on tiny compact icons via the `withLiteBadge ?? (!compact && size >= 80)` heuristic). Plus drive-by fixes: `app/(auth)/login.tsx` reads `useModelStore.getState().isActive` to skip onboarding when the model is on disk; `app/_layout.tsx` RouteGuard subscribes to `isActive` as a backstop for the hydratePrefs race; new `[login] onAuthed → isActive=… target=…` breadcrumb log.
- **PR #13 merged (`190bc64`).** Rotate 84 culinary verbs in the streaming bubble during the pre-token prefill wait. `src/constants/culinaryVerbs.ts` + inline `useRotatingCulinaryVerb` in `ChatList`. 2.2s cadence, never repeats back-to-back.
- **PR #12 merged (`1e90499`).** KV-state save/load via `kvSessionService` with five invalidation triggers + orphan-cleanup helper. Cuts cold-launch turn 1 prefill from ~80s to ~70s on the trimmed v9 prompt; warm boot saves another ~9s.
- **Branch protection on main applied** via `gh api`: `enforce_admins`, `required_linear_history`, no force pushes, no deletions. Status checks (lint/tsc/test) deferred until PR #8 (CI workflow) lands.
- **System prompt trimmed** organically during testing: 475 → 329 tokens. Cold turn 1 prefill ~88s → ~70s.

## Currently in flight

Nothing blocked. Branch state clean. **Vulkan GPU offload investigated and parked** — see decision log entry [2026-05-01] in `../cc-culinaire-shared-context/decisions.md`. Weekly recurring monitor (claude.ai routine `trig_01S6Yk7CnGzxVzo2J698aaCv`) watches llama.rn for Vulkan in the prebuilt JNI; fires every Mon 09:00 AEST.

## Next action — RECOMMENDED ORDER

1. **Run `pnpm android` locally** to rebuild the dev client APK so the home-screen icon label updates from `cc-culinaire-kitchen-mob` to `CulinAIre Kitchen Lite`. Native rebuild step — JS hot reload doesn't pick up `app.config.ts` `name` changes. ~3–5 min.
2. **Wait for the weekly Vulkan monitor to fire green.** Until upstream llama.rn ships Vulkan in the standard prebuilt JNI, GPU offload is blocked. When the agent reports "Vulkan in prebuilt", bump the pin, set `n_gpu_layers > 0`, test on device with CPU fallback wired in.
3. **Decide the Full-fork strategy** (separate repo vs. branch vs. build-time flag) before doing Layer 2 of the rename — production-ready bundle id (e.g. `kitchen.culinaire.lite`) needs to align with whatever the Full fork uses.
4. **Speculative decoding for v3** — parked, gated on user feedback about decode speed (~4 tok/s today → 8–12 tok/s with a 1B Gemma draft model, costs ~600–800 MB extra download). Wait for users to complain.
5. **Backlog:** PR #7 (wiki CRLF parser fix) and PR #8 (CI workflow) still open. Triage when convenient.

## Open questions / blockers

- llama.rn 0.12.0-rc.5 pin — Vulkan backend confirmed NOT in any published prebuilt JNI through rc.9 (verified via `find -iname '*vulkan*'` + binary `strings` probe + release-notes scan). Source-build path requires fixing the Python 3.14 / CMake 3.22 issue. Parked until upstream ships or speculative decoding becomes the priority.
- The cached `LlamaContext` is module-level in `inferenceService.ts`. Future settings path-override UI must call `releaseCachedContext()` AND `deleteSavedKV()`.
- Latent: duplicate-row race in `modelDownloadService.start()` (concurrent calls).
- `apiClient.post` doesn't thread an `AbortSignal`, so the 3s RAG timeout drops the response but doesn't cancel the fetch.
- KV-state files are bounded to ONE per launch now (orphan prune), but per-conversation KV state is out of scope this milestone.

## See also

- [[project-status]] — slow-changing narrative of shipped milestones
- [[llama-rn-inference-params]] — current parameter table + KV session persistence design
- [[rag-architecture]] — the data flow that shipped in PR #9
- [[server-managed-prompts]] — the cache-with-fallback pattern (now also the hash source for KV invalidation)
- [[privacy-invariant]] — kv-state files added to the audit list
- [[model-quantization-must-be-mainline]] — why Q4_0 + mainline llama.cpp
- `docs/specs/kv-prefix-cache-via-parallel-state.md` — the spec we executed against for PR #12
- `wiki/log.md` — append-only history
