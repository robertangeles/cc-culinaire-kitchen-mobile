---
title: In flight — what's being worked on right now
category: synthesis
created: 2026-04-29
updated: 2026-04-30
related: [[project-status]], [[model-quantization-must-be-mainline]], [[rag-architecture]], [[server-managed-prompts]], [[privacy-invariant]], [[llama-rn-inference-params]]
---

The single source of truth for "where we are right now". Updated at the end of every session and read at the start of every new one. Always short (under 30 lines).

> **Read this FIRST in any new session, before `index.md` or anything else.** It tells you what to pick up.

## Status

**Conversational multi-turn unlocked tonight.** RAG chunks now cache per-conversation; turn 2+ prefill drops from ~50s to ~2s on the Moto G86 Power. Turn 1 still pays the full ~75s cold prefill. Whole stack shipped + verified on device.

Latest commit on `feature/ck-mob/inference-tuning`: **`2fcc8b3` (pushed)** — RAG cache per conversation. Branch has 4 commits total (Stage 1 n_batch experiment, Stage 2+3 q8_0+flash-attn experiment that OOM'd, revert, then the RAG cache fix). Awaiting PR + merge to main.

## Last completed (this session)

- **PR #10 merged:** Antoine V2 Q4_0 weights live, n_ctx=2048, KV cache Q4_0. Verified ~9 tok/s prefill (9× over Q4_K_M baseline).
- **RAG cache per conversation (`2fcc8b3`):** first user message retrieves; chunks frozen for the rest of the conversation. Empty results NOT cached so a chitchat opener doesn't lock out citations on the real follow-up. Stabilises the message-array prefix across turns so llama.cpp's automatic KV-prefix cache reuses everything past the system prompt. Verified on device: turn 2 `prompt_n` 433 → **17**, `prompt_ms` 50s → **1.9s**.
- **Investigations that paid off:** `getFormattedChat` byte-diff between turns showed cache match terminated at end of system prompt because RAG block at index [1] differed across turns. Web-side investigation confirmed there's no similarity threshold filter — empty results are upstream blips (likely OpenAI embedding service rate limits).
- **Dead ends recorded:** off-grid `kv_unified` / `ctx_shift` not in our llama.rn 0.12.0-rc.5. n_batch 256→512 no-op. q8_0 KV + explicit flash_attn OOM'd. n_threads 6 no improvement. Vulkan backend not in the prebuilt JNI.

## Currently in flight

Nothing blocked. Code-complete on RAG cache. PR description for `feature/ck-mob/inference-tuning` not yet written.

## Next action — RECOMMENDED ORDER FOR NEXT SESSION

1. **Open + merge the PR for `feature/ck-mob/inference-tuning`** (top of next session, fresh eyes). Commit `2fcc8b3` is the keeper; the earlier 3 commits are documented experiments that net to zero change. Squash-merge with a description capturing the journey.
2. **Half-day: ship `saveSession`/`loadSession` for the system-prompt KV state.** This is the next big win — cuts turn 1 cold-launch prefill from ~78s to ~37s on every launch after the first ever. Spec at [docs/specs/kv-state-persistence-via-savesession.md](../docs/specs/kv-prefix-cache-via-parallel-state.md). Risk profile: same shape as the RAG cache, with bigger consequences if hash invalidation has bugs (silent wrong outputs).
3. **Bundle into #2: pre-warm `initLlama()` on app launch.** Loads the model into memory while the user is on the chat tab, before the first send. Saves another ~10-30s on cold start. Cheap addition once #2 is in flight; the saveSession piece is what makes the prefill skip-able.
4. **Polish: streaming bubble micro-animation (typing dots / pulse).** Already streams a "consulting your library…" subtitle on send, but a subtle motion makes the wait feel responsive rather than dead. ~30 min in [ChatList.tsx](../src/components/chat/ChatList.tsx). Low impact, low effort, do whenever there's a free hour.

## Open questions / blockers

- llama.rn 0.12.0-rc.5 pin (last RC with prebuilt JNI libs). Future stable bump needs source-build fix for Python 3.14 / CMake 3.22.
- The cached `LlamaContext` is module-level; settings path-override UI (future) must call `releaseAllLlama()` AND clear any saveSession files.
- Latent: duplicate-row race in `modelDownloadService.start()` (concurrent calls).
- `apiClient.post` doesn't thread an `AbortSignal`, so the 3s RAG timeout drops the response but doesn't cancel the fetch.
- Generation is now the bottleneck on multi-turn (~4 tok/s decode = ~16s for a 64-token reply). Speculative decoding is the next big lever after #2/#3 land, but that's full-session work.

## See also

- [[project-status]] — slow-changing narrative of shipped milestones
- [[llama-rn-inference-params]] — current parameter table with reasoning
- [[rag-architecture]] — the data flow that shipped in PR #9
- [[server-managed-prompts]] — the cache-with-fallback pattern
- [[privacy-invariant]] — the rule the RAG-cache fix preserves
- [[model-quantization-must-be-mainline]] — why Q4_0 + mainline llama.cpp
- `docs/specs/kv-prefix-cache-via-parallel-state.md` — full spec for the next-session work (#2 above)
- `wiki/log.md` — append-only history
