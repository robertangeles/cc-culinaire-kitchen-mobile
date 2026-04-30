# Spec — Persist system-prompt KV state across app launches via `saveSession`/`loadSession`

Status: not started; problem statement + plan only.
Last updated: 2026-04-30 (rewritten to drop the parallel-completion path, which became unnecessary once the per-conversation RAG cache shipped tonight).
Owner: next session, fresh eyes.
Estimated effort: half-day.
Stacks with: pre-warm `initLlama()` on launch (~1 hour add-on inside this same change).

## Problem

Antoine on the Moto G86 Power runs at ~9 tok/s prefill. The system prompt is ~410 tokens (~700-token cap minus chat-template wrappers); the RAG block is ~250 tokens; the user message is ~30 tokens. Every cold app launch re-prefills the system prompt from scratch on the first message — ~45 seconds of CPU time the user waits through.

The `2fcc8b3` RAG-cache fix already addressed turn 2+ within a session (cache_n extends through the prior assistant reply, prompt_n drops to ~17, prompt_ms to ~2s). **What's left is turn 1 of every cold launch.**

## What works in our llama.rn version

`llama.rn 0.12.0-rc.5` exposes session save/load on the regular `LlamaContext` (verified by reading `node_modules/llama.rn/src/index.ts:632-645`):

```ts
async loadSession(filepath: string): Promise<NativeSessionLoadResult>
async saveSession(filepath: string, options?: { tokenSize: number }): Promise<number>
```

`tokenSize` lets us cap the saved KV state to just the system prompt's tokens (without the user/assistant turns that would follow). On next launch, `loadSession` restores that KV state — the system prompt prefix is already in cache, no re-prefill needed for those tokens.

## Approach

### After turn 1 of any session that does a fresh prefill

1. After the first successful `completion()` call following a cold `initLlama`, save just the system-prompt prefix. The number of tokens to cap at = the position of the last system-message token in the rendered prompt. Use `ctx.native.tokenize(systemPromptOnly)` (or `getFormattedChat(messages.slice(0, sys-message-count))`) to compute the boundary.
2. Save to a stable file path under the app's private files directory (same parent as the GGUFs). Filename includes a hash so we can detect prompt changes:
   ```
   files/kv-state/system-prompt-{sha256-of-prompt-body-first-12-chars}.bin
   ```
3. Sidecar JSON next to the file with full hash + prompt body length + saved timestamp + llama.rn version (the binary KV format may change across releases).

### On app launch (boot effect, after `isActive=true`)

1. Compute the current system prompt's hash (via `getActivePrompt()` + sha256).
2. Look for `files/kv-state/system-prompt-{hash-prefix}.bin`. If absent → no warm-up; first send pays the full prefill (and writes the state file when complete).
3. If present + sidecar matches:
   - `await ensureContext()` — loads the model.
   - `await ctx.native.loadSession(filepath)` — restores KV state. ~3-5s on Android internal eMMC for a ~3-4 MB file.
   - Mark a flag (`kvSessionWarmed = true`) so the next `send()` knows it can skip the system-prompt prefill.
4. If hash mismatch (server prompt changed since last save) → delete the stale file + sidecar.

### On the first send AFTER a warm load

The send path needs to know: "the system prompt is already in KV; don't re-render it as a system message." Two options:

**(a) Pass `[ragBlock, ...history]` instead of `[system, ragBlock, ...history]` and rely on llama.cpp's automatic prefix match to recognize the saved KV state still applies.** Risky — llama.cpp might re-prefill from scratch if the chat template includes the system prompt as wrapped tokens (`<start_of_turn>user\n{sys}\n...`) and the new render doesn't start with those exact bytes.

**(b) Pass the full message array as today; let llama.cpp's automatic prefix cache match the saved-and-restored KV state against the rendered prompt and skip the prefilled tokens.** This is what we verified works for the RAG cache fix tonight. Higher chance of working out-of-the-box.

**Pick (b) initially.** Verify with the same `[inferenceService] turn=N cache_n=...` instrumentation we already have. If `cache_n` after a `loadSession` reflects the system-prompt token count, we're done. If not, fall back to (a) and do the surgery.

## Stacking with #4 (pre-warm `initLlama` on app launch)

Cheap add-on, ship in the same session:

- After auth + `isActive=true`, fire `void ensureContext().catch(() => undefined)` from a boot effect. This loads the model into memory in the background while the user is reading the chat tab UI before typing.
- Saves the cold-load latency (~10-30s) on first send.
- Combine with the loadSession step: pre-warm AND restore KV in one boot effect.
- Memory safeguard: skip pre-warming if the device is under memory pressure (check `MemoryInfo` or just read available RAM via a native module). The LMK killed the app once tonight — eagerly loading 5 GB of weights when the user might just be checking notifications could cascade.

## Cache invalidation — the dangerous bit

**Wrong invalidation = model attends to KV from a different prompt = silent garbage output.** This is the failure mode that ships and quietly degrades the product. Same shape as the RAG cache's invalidation but with bigger consequences.

Invalidate (delete file + sidecar) when ANY of:

1. **Hash mismatch** between current `getActivePrompt()` body and saved sidecar's hash. The server-side prompt was edited via the admin UI; mobile pulled the new version on boot via `refreshAndCache`.
2. **llama.rn version changed** since save (sidecar tracks the llama.rn version; binary KV format might not be compatible across releases).
3. **n_ctx, cache_type_k, cache_type_v, n_batch changed** since save (the KV layout depends on these). Sidecar tracks them; mismatch deletes.
4. **Loading the file throws** (corrupt, partial write from prior crash) → catch, delete, fallback to fresh prefill.
5. **Disk-full on save** → log a warning, skip the save, fall back to today's behavior. Don't crash.

## Privacy

State file lives in app-private storage, never syncs, never uploads. Add the path to the audit list in [wiki/concepts/privacy-invariant.md](../wiki/concepts/privacy-invariant.md). State contains the system prompt body's KV representation — already on-device, but explicit acknowledgment in the doc.

## Expected payoff

| Scenario                      | Today                             | After this spec                                                                                  |
| ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| First-ever app launch, turn 1 | ~78s prefill                      | ~78s prefill (saves on the way out for next time)                                                |
| Subsequent app launch, turn 1 | ~78s prefill                      | **~37s prefill** (system prompt skipped via loadSession; only RAG block + user pay full prefill) |
| Turn 2+ within same session   | **~2s** (already shipped tonight) | **~2s** (unchanged — RAG cache handles this)                                                     |
| Cold model load on launch     | first-message-pays                | parallelized via #4 pre-warm                                                                     |

Stacked with the RAG cache that shipped tonight, the chat experience becomes:

- First-ever launch: 78s for first message, then conversational pacing
- Every other launch: 37s for first message, then conversational pacing

## Implementation surface

| File                                                      | Change                                                                                                                                                                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/kvSessionService.ts` (new)                  | `saveSystemPromptKV(ctx, prompt) => Promise<void>`, `loadSystemPromptKV(ctx, prompt) => Promise<boolean>`, hash + sidecar handling, invalidation                                                                                                              |
| `src/hooks/useAntoine.ts`                                 | After first successful completion, call `saveSystemPromptKV` (fire-and-forget, doesn't block UI). Track a flag for "saved this session" to avoid repeat saves.                                                                                                |
| `app/_layout.tsx` boot effect                             | After `isActive=true`, fire `ensureContext()` then `loadSystemPromptKV(ctx, await getActivePrompt())`. All best-effort, all `void`.                                                                                                                           |
| `src/services/inferenceService.ts`                        | `releaseAllLlama()` should ALSO delete saved session files (when settings path-override UI ships). Add a helper.                                                                                                                                              |
| `src/__tests__/unit/kvSessionService.test.ts` (new)       | Mock SecureStore + filesystem. Test: clean first launch, valid load, hash-mismatch invalidation, corrupt-file fallback, disk-full graceful degrade.                                                                                                           |
| `src/__tests__/integration/useAntoine.streaming.test.tsx` | Extend the streaming integration test: after first turn, save call fires; mock the second app boot, loadSession returns true, the inferenceService completion call has `cache_n >= systemPromptTokens` (or whatever assertion verifies the warm-load worked). |
| `wiki/concepts/privacy-invariant.md`                      | Add `files/kv-state/*.bin` + sidecar JSON to the audit list.                                                                                                                                                                                                  |
| `wiki/decisions/llama-rn-inference-params.md`             | Add a "KV session persistence" subsection capturing the design.                                                                                                                                                                                               |

## Verification on device (Moto G86 Power)

After implementation:

- [ ] Clean first launch (delete app data → reinstall → first message): turn 1 prefill ~78s. Save fires after completion. State file present in `files/kv-state/` per `adb shell run-as ... ls -la files/kv-state/`.
- [ ] Force-stop app + reopen: boot effect runs `loadSession`. Metro log shows `[kvSession] loaded N tokens in Xms`. Turn 1 prefill drops to ~37s; `cache_n` in the timing line ~410 (system-prompt token count); `prompt_n` ~330 (RAG + user only).
- [ ] Edit system prompt on web admin → relaunch app → boot effect's `refreshAndCache` updates the cached body → loadSession's hash-check fails → state file deleted → first message pays full prefill (correctness, not regression).
- [ ] Multi-turn after warm load: turn 2 still cache-hits per the RAG-cache fix from tonight (regression check).
- [ ] Storage stress: fill device to <100 MB → trigger save → save fails gracefully, no crash.
- [ ] Memory stress: open 5 heavy apps in background → relaunch Antoine → confirm pre-warm doesn't OOM (or, if it does, the LMK gracefully restarts the app and the next launch falls back).

## Risks

- **Cache-invalidation bugs ship as silent wrong outputs.** This is the worst failure mode. Mitigate with comprehensive tests AND a defensive "log loud" stance — if `cache_n` after a load doesn't match the saved token count, log a warning and probably invalidate-and-retry.
- **Binary KV format may change across llama.rn releases.** The sidecar's llama.rn version field is the contract. If this hits, we just regenerate.
- **eMMC write speed varies** across phones. 3-4 MB write is small but on a stressed device might still take 100ms+. Save is fire-and-forget, so the user doesn't wait, but log the timing for observability.

## Out of scope

- **Per-conversation KV state persistence.** Only the system prompt's KV gets saved across launches. Conversation history KV state stays in-memory; if the user kills the app mid-conversation, history is in SQLite and the next message rebuilds the cache from scratch (with cache_n=0 for that session's first turn).
- **Speculative decoding / draft model.** Generation throughput is now the bottleneck (~4 tok/s decode); speculative decoding is the next big lever AFTER this spec ships. Full session of work.
