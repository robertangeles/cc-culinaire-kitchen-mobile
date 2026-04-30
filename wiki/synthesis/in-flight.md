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

**Antoine V2 (Q4_0) shipped to config — pending device verification.** Branch `feature/ck-mob/antoine-v2-q4_0` has the model swap + n_ctx bump. After device test confirms ~5× prefill speedup, this is the milestone where Antoine becomes conversational rather than glacial.

**On main today:**

- PR #9 (RAG retrieval, dynamic system prompt, streaming UX, four device hotfixes)
- `c31efef` — KV cache Q4_0 (saves ~50 MB at n_ctx=2048)
- `e44b087` — Sources footer removed from chat UI

**On feature branch (uncommitted, awaiting device verify):**

- `MODEL.files.main` → `antoine-v2-q4_0.gguf` (5,185,929,024 bytes; SHA `86b4b9d8...`)
- `MODEL.files.mmproj` → `antoine-v2-mmproj-bf16.gguf` (same bytes as v1 mmproj, just renamed on R2; SHA `737485f5...`)
- `n_ctx: 1536 → 2048` in `inferenceService.ts` (now safe with Q4_0 weights + Q4_0 KV cache)

## Last completed

- **PR #9 merged to main.** llama.rn 0.12.0-rc.5, RAG service, prompt cache service, useAntoine rewrite, three-stage streaming bubble, keyboard layout fix, hydration race fix, four device hotfixes.
- **KV cache quantized to Q4_0** (`c31efef`). Frees ~50 MB at n_ctx=2048. tsc + lint + 122 tests green.
- **Sources footer removed from chat UI** (`e44b087`). RAG chunks remain as the model's PRIVATE system context — only Antoine's reply (with any inline `[n]` citations he writes) is rendered in the chat. Earlier appendSourcesFooter that leaked corpus titles into the UI is gone.
- **Q4_0 re-quantization completed in Colab.** Two new files on R2: `antoine-v2-q4_0.gguf` (Q4_0 main) + `antoine-v2-mmproj-bf16.gguf` (BF16 vision encoder, unchanged from v1).

## Currently in flight

- **Branch `feature/ck-mob/antoine-v2-q4_0`** ready for commit + device verification. After verify, merge to main.

## Next action

1. **Run tsc + lint + tests** on the feature branch to confirm green.
2. **Commit** the model swap + n_ctx bump + wiki/shared-context updates on the feature branch.
3. **Pause and ask before push** (per `feedback_ask_before_push.md`).
4. **After push:** wipe old Q4_K_M off device:
   ```
   adb shell run-as com.anonymous.ccculinairekitchenmob rm files/models/antoine/v1/antoine_mobile_gemma3n.gguf
   ```
   Force-stop app, reopen → boot disk-check sees no file → DownloadingScreen → fetches Q4_0 (~4.83 GB) → SHA verifies → loads.
5. **Verify on device:** send "Why does my hollandaise break?" — measure tokens/sec. Expected: ~5 tok/s prefill (5× over Q4_K_M).
6. **Open PR + merge once verified.**
7. **Optional follow-ups** once Q4_0 baseline is solid: raise RAG `limit: 2 → 3` for richer grounding (third chunk is ~100 tokens, fits comfortably). Retry Vulkan offload (`n_gpu_layers: 99`) on Q4_0 — different layout might unblock the Mali driver.

## Open questions / blockers

- llama.rn 0.12.0-rc.5 is the pin (last RC with prebuilt JNI libs). Future stable bump needs source-build + Python 3.14/CMake 3.22 fix.
- The cached `LlamaContext` is module-level; future settings path-override UI must call `releaseAllLlama()` and reset.
- Latent: duplicate-row race in `modelDownloadService.start()` (concurrent `start()` calls). Doesn't cause file deletion but is messy.
- `apiClient.post` doesn't thread an `AbortSignal`, so the 3s RAG timeout drops the response but doesn't cancel the fetch.
- Multi-turn KV-prefix reuse (`n_keep`) — every send re-prefills the system prompt. ~3× speedup deferred until basic chat is fast on Q4_0.

## See also

- [[project-status]] — slow-changing narrative of shipped milestones
- [[llama-rn-inference-params]] — current parameter table with reasoning
- [[rag-architecture]] — the data flow that shipped in PR #9
- [[server-managed-prompts]] — the cache-with-fallback pattern that shipped in PR #9
- [[privacy-invariant]] — the rule that PR #9's query-leaves boundary refines
- [[model-quantization-must-be-mainline]] — why Q4_0 + mainline llama.cpp is the only path
- `wiki/log.md` — append-only history
