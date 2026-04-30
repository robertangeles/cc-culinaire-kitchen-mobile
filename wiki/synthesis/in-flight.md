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

**Inference tuning + RAG cache landed on `main` this morning.** PR #11 squash-merged as `5be7079`, superseding PR #10. Conversational multi-turn is shipped: turn 2+ prefill is ~2s on the Moto G86 Power, ~9 tok/s prefill baseline. Turn 1 still pays the full ~75–80s cold prefill — that's the next target.

`feature/ck-mob/inference-tuning` and `feature/ck-mob/antoine-v2-q4_0` deleted on remote. Local `main` is in sync with origin.

## Last completed (this session)

- **PR #11 merged (`5be7079`):** Antoine V2 Q4_0 + n_ctx=2048 + RAG cache per conversation + four-stage param sweep (net zero, documented). Closes/supersedes PR #10.
- **PR #10 closed as superseded** with comment pointing to #11.
- **Pre-flight all green pre-merge:** `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test` (125 tests / 23 suites).

## Currently in flight

Nothing blocked. Next-session work is gated only on disciplined hash-invalidation in the saveSession/loadSession code (see #1 below).

## Next action — RECOMMENDED ORDER

1. **Half-day: ship `saveSession`/`loadSession` for the system-prompt KV state.** This is the next big win — cuts turn 1 cold-launch prefill from ~78s to ~37s on every launch after the first ever. Spec at [docs/specs/kv-prefix-cache-via-parallel-state.md](../docs/specs/kv-prefix-cache-via-parallel-state.md). Risk profile: same shape as the RAG cache, with bigger consequences if hash invalidation has bugs (silent wrong outputs).
2. **Bundle into #1: pre-warm `initLlama()` on app launch.** Loads the model into memory while the user is on the chat tab, before the first send. Saves another ~10–30s on cold start. Cheap addition once #1 is in flight; the saveSession piece is what makes the prefill skip-able.
3. **Polish: streaming bubble micro-animation (typing dots / pulse).** Already streams a "consulting your library…" subtitle on send, but a subtle motion makes the wait feel responsive rather than dead. ~30 min in [ChatList.tsx](../src/components/chat/ChatList.tsx). Low impact, low effort, do whenever there's a free hour.
4. **Backlog: PR #7 (wiki CRLF parser fix) and PR #8 (CI workflow)** are still open and unrelated to inference. Triage when convenient.

## Open questions / blockers

- llama.rn 0.12.0-rc.5 pin (last RC with prebuilt JNI libs). Future stable bump needs source-build fix for Python 3.14 / CMake 3.22.
- The cached `LlamaContext` is module-level; settings path-override UI (future) must call `releaseAllLlama()` AND clear any saveSession files.
- Latent: duplicate-row race in `modelDownloadService.start()` (concurrent calls).
- `apiClient.post` doesn't thread an `AbortSignal`, so the 3s RAG timeout drops the response but doesn't cancel the fetch.
- Generation is now the bottleneck on multi-turn (~4 tok/s decode = ~16s for a 64-token reply). Speculative decoding is the next big lever after #1/#2 land, but that's full-session work.

## See also

- [[project-status]] — slow-changing narrative of shipped milestones
- [[llama-rn-inference-params]] — current parameter table with reasoning
- [[rag-architecture]] — the data flow that shipped in PR #9
- [[server-managed-prompts]] — the cache-with-fallback pattern
- [[privacy-invariant]] — the rule the RAG-cache fix preserves
- [[model-quantization-must-be-mainline]] — why Q4_0 + mainline llama.cpp
- `docs/specs/kv-prefix-cache-via-parallel-state.md` — full spec for #1 above
- `wiki/log.md` — append-only history
