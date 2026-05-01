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

**KV-state persistence shipped. Cold-launch turn 1 cut from ~80s → ~70s on a trimmed prompt; warm boot turn 1 cuts ~9s by skipping the system-prompt slice; turn 2 still ~1.5–2s.** PR #12 squash-merged as `1e90499` (super-bundle: saveSession/loadSession + boot-effect pre-warm + 5 invalidation triggers + orphan-cleanup helper + tsc fix for `useSegments`). Verified end-to-end across 5 device scenarios on the Moto G86 Power.

`feature/ck-mob/kv-session-persistence` branch deleted on remote. Local `main` synced.

## Last completed (this session)

- **PR #12 merged (`1e90499`).** New `kvSessionService` with SHA-256 (via `expo-crypto`) prompt-hash invalidation, runtime-fingerprint check, llama.rn version check, corrupt-file fallback, tokens_loaded mismatch check. Plus orphan-cleanup helper that runs after each save and deletes prior-prompt-version files (without it, every system-prompt edit leaked ~10–13 MB).
- **System prompt trimmed organically during testing** from 475 → 329 tokens (web admin, no code change). Cold turn 1 prefill 87.9s → 70.3s on Moto G86 Power.
- **Cross-version sweep verified:** v6 (412 tok, 44.7s) → v7 (736 tok, 81.6s) → v8 (786 tok, 87.9s) → v9 (642 tok, 70.3s). Per-prompt-token cost ~9 tok/s prefill.
- **Wiki updated:** privacy-invariant.md (kv-state files added to audit list), llama-rn-inference-params.md (KV session persistence subsection + 5 invalidation triggers).

## Currently in flight

Nothing blocked. Branch state clean.

## Next action — RECOMMENDED ORDER

1. **Vulkan GPU offload retry on Q4_0** (~30 min to confirm available; up to half-day to ship behind feature flag with CPU fallback). Mali-G615 + Q4_K_M crashed previously, but Q4_0's NEON-friendly layout might unblock the GPU path. If JNI doesn't include the Vulkan backend, abort + park. Upside if it works: prefill 9 → 30+ tok/s, cold turn 1 ~85s → ~20s.
2. **Park speculative decoding for v3** based on real user feedback after this milestone ships. Decode bottleneck is the next-biggest lever (~4 tok/s today → 8–12 tok/s with a 1B Gemma draft model), but it costs ~600–800 MB of additional model download. Wait for users to actually complain about decode latency before paying that.
3. **Polish: streaming-bubble micro-animation** in [src/components/chat/ChatList.tsx](../src/components/chat/ChatList.tsx). ~30 min, low impact, do whenever there's a free hour.
4. **Backlog:** PR #7 (wiki CRLF parser fix) and PR #8 (CI workflow) still open, unrelated to inference. Triage when convenient.

## Open questions / blockers

- llama.rn 0.12.0-rc.5 pin — Vulkan backend likely not in the prebuilt JNI; bump path needs a source build (Python 3.14 / CMake 3.22 issue from yesterday).
- The cached `LlamaContext` is module-level in `inferenceService.ts`. Settings path-override UI (future) must call `releaseCachedContext()` AND `deleteSavedKV()`.
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
- `docs/specs/kv-prefix-cache-via-parallel-state.md` — the spec we just executed against
- `wiki/log.md` — append-only history
