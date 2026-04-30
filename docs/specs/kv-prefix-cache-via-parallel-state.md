# Spec — KV-prefix caching across turns via llama.rn's parallel-mode state save/load

Status: not started; problem statement only.
Last updated: 2026-04-30
Owner: next session
Estimated effort: half-day

## Problem

Antoine runs on-device via `llama.rn 0.12.0-rc.5` (CPU-only) on a Moto G86 Power. Verified baseline: ~9 tok/s prefill on Q4_0 weights → ~75 seconds before first token on a ~700-token prompt (system prompt + RAG block + user message).

Every `send()` re-prefills the entire prompt from scratch, including the unchanged system prompt + RAG block + history. The unchanged prefix is the bulk of what's slow.

## The constraint that shapes the design

There is no `n_keep` / `cache_prompt` / `prefix_tokens` parameter on `context.completion()` in llama.rn 0.12.0-rc.5. Verified by reading `node_modules/llama.rn/src/types.ts:130-318` and `lib/typescript/*.d.ts`.

The only KV-state retention surface in this version is **file-backed**, available via:

1. `context.loadSession(filepath)` / `context.saveSession(filepath, { tokenSize })` — full session save/restore. `node_modules/llama.rn/src/index.ts:632-645`.
2. `context.parallel.completion(params, onToken)` accepting `ParallelCompletionParams` with:
   - `load_state_path?: string` — file path; loaded BEFORE processing
   - `save_state_path?: string` — file path; saved AFTER completion finishes
   - `save_prompt_state_path?: string` — saves prompt-only state (post-prefill, pre-generate). Package comment: _"Useful for fast prompt reuse (especially for recurrent/hybrid models)."_
   - `load_state_size?: number` — # tokens to load (default: all)
   - `save_state_size?: number` — # tokens to save (default: all)

   Refs: `node_modules/llama.rn/src/index.ts:360`, `node_modules/llama.rn/src/types.ts:324-363`.

The result type already has `cache_n` in `NativeCompletionResultTimings` (`types.ts:375`), suggesting llama.cpp's internal prompt-cache logic runs automatically during regular `completion()` — but is not user-controllable from JS in this version.

## Approach

Build the design on `parallel.completion` + `save_prompt_state_path` / `load_state_path`. This is a significantly different implementation shape from a hypothetical in-memory `n_keep`; the change has to be verified empirically (disk I/O on saving/loading the KV state on Android internal storage may cost more than it saves at 700 tokens of prefill).

### Lifecycle

After turn 1's completion finishes, save the prompt KV state to a stable on-device path (under the app's files directory; same parent as the GGUFs). Compute a hash key from the exact prompt-prefix bytes (system prompt body + RAG block content) so we can detect when the prefix has changed between turns.

On turn 2's `send()`:

- Hash the new prefix
- Compare to the saved hash
- **If identical:** pass `load_state_path` pointing to the saved file, plus the new tail (current user message + any new turns of history). Model resumes inference without re-prefilling.
- **If different:** invalidate — delete the saved file, run a fresh full prefill, save again.

## Key constraints

- **API change.** Switching from `context.completion()` to `context.parallel.completion()` returns `{ requestId, promise, stop }` instead of a `Promise<NativeCompletionResult>`. The streaming-callback signature also changes — it's `(requestId, data) => void` not `(data) => void`. Streaming-bubble wiring in `src/store/conversationStore.ts` and `src/hooks/useAntoine.ts` needs adjustment.
- **Activation contract.** `parallel.completion` requires `context.parallel.enable({ n_parallel?, n_batch? })` to be called once per context lifetime. Read `node_modules/llama.rn/src/index.ts:573` to confirm.
- **State file size.** At `n_ctx=2048` with Q4_0 KV (~18 MB), files are small. Disk I/O cost on Android internal eMMC for an 18 MB read is roughly 50-200ms — well below the prefill savings we're targeting (60+ seconds). But verify on the actual device, not on assumption.
- **Privacy invariant.** State files live in app-private storage, never sync, never upload. Add path to the audit list in `wiki/concepts/privacy-invariant.md`.
- **Sources-footer behavior** shipped 2026-04-30. Cached state contains the full RAG block as system context; the chat UI continues to display only the model's reply.
- **Cache invalidation MUST trigger when:**
  - Cached server prompt body changes (compare against the hash baked into the saved state file's filename or sidecar JSON)
  - User clears the conversation
  - User starts a new conversation
  - RAG block content for the current turn differs from the saved prefix
  - Wrong invalidation → model attends to KV from a different prompt → silent garbage output. **This is the dangerous failure mode; it must have integration tests.**
- **State file lifecycle:**
  - Graceful first-launch (no file yet)
  - Corrupt state files (delete + re-prefill, don't crash)
  - Android low-storage events (don't crash if write fails)

## Expected payoff

Turn 2+ drops from ~75s to ~10-20s before first token (skipping the 700-token prefill of the unchanged prefix; only paying for the new ~30-token user message + any new RAG chunks if retrieval returned a different set). Turn 1 is unchanged.

## Verification checklist

- [ ] **Same-prompt-second-turn:** send "Why does my hollandaise break?", measure t1; send "Why is that?" follow-up, measure t2. Target: t2 ≤ 25s. Confirm `cache_n` in result timings reflects the saved prefix size.
- [ ] **Refreshed-system-prompt invalidation:** edit the prompt on the web admin, force the boot refresh to write a new version to SecureStore, send a message; confirm t = full prefill (no stale cache hit).
- [ ] **Different-RAG-block invalidation:** ask two questions with very different domain coverage so `retrieve()` returns different chunks; confirm turn 2 doesn't reuse turn 1's prefix.
- [ ] **Conversation cleared:** tap Clear Conversation → state file deleted; next message t = full prefill.
- [ ] **Multi-turn extended:** send 5 turns in a row, check that turn 2-5 all benefit (state file is rewritten each turn to capture growing history).
- [ ] **Storage stress:** fill the device to <100 MB free, send a message; confirm graceful degradation (warning logged, falls back to non-cached completion, doesn't crash).

## Risks worth calling out before starting

- **Disk I/O might cost more than it saves** if Android's eMMC is slow under memory pressure. Need a perf test before declaring victory.
- **`parallel.completion` may have subtle behavior differences** from regular `completion` (request queuing, parallel execution semantics). Read `node_modules/llama.rn/src/index.ts:355-450` carefully before assuming drop-in compatibility.
- **llama.rn 0.12.0-rc.5 is a release candidate.** The parallel-mode API may have bugs or contract changes vs. the eventual stable. If something behaves unexpectedly, check the llama.rn GitHub issues for `parallel.completion` reports.

## Reference points in the codebase

- `src/hooks/useAntoine.ts` `send()` — message array construction at lines ~138-151, completion call at line 159.
- `src/services/inferenceService.ts` `completion()` — wraps `ctx.native.completion`. Switching to `ctx.native.parallel.completion` happens here.
- `cachedContext` at `src/hooks/useAntoine.ts:21` is already module-level; extend its lifetime contract to include the prompt-state file path + hash. `releaseAllLlama()` invalidation hook in `inferenceService.ts` should also delete any saved state files.

## Fallback if this doesn't work

If `parallel.completion` turns out to be unworkable (API semantics mismatch, bugs, or unacceptable disk I/O), fallback is to upgrade llama.rn to a release that exposes `n_keep` directly. The known wall there is the source-build path requiring Python 3.14 / CMake 3.22 fixes; a proper upgrade session would solve that wall, then add `n_keep` cleanly via the standard `completion()` path.

## What was tried first that ruled out cheaper approaches

| Lever                                                          | Result                                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `kv_unified: true` on initLlama (off-grid recommendation)      | Param does not exist in 0.12.0-rc.5; tsc accepts via index-signature loophole, native binding silently drops it. Dead in this version.                       |
| `ctx_shift: true` on completion (off-grid recommendation)      | Param does not exist in 0.12.0-rc.5's TS surface. tsc rejects. Dead in this version.                                                                         |
| `reasoning_format: 'none'` (off-grid recommendation)           | Already the default in 0.12.0-rc.5. No-op.                                                                                                                   |
| `n_batch: 256 → 512`                                           | No prefill speedup (matmul-bound, not batch-overhead-bound). +308 MiB compute buffer for nothing. Reverted.                                                  |
| `cache_type: q4_0 → q8_0` + explicit `flash_attn_type: 'auto'` | Combined +18 MiB pushed past Android low-memory killer ceiling; SIGKILL'd the app. Reverted. Q4_0 KV + auto flash-attn (default) is the verified safe stack. |
| `n_threads: 4 → 6`                                             | No improvement on Dimensity 7300 (heterogeneous A78+A55; A55s drag synchronous matmul barriers).                                                             |
| `n_gpu_layers: 99` (Vulkan offload)                            | Vulkan backend not in llama.rn 0.12.0-rc.5's prebuilt JNI libs. Source-build wall (Python 3.14 / CMake 3.22). Silent no-op.                                  |
