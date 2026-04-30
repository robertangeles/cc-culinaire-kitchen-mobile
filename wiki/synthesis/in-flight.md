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

**PR #9 merged to main.** RAG retrieval, dynamic system prompt, streaming UX, keyboard fix, and four hotfixes from the device session are all on main. Antoine answers grounded in the corpus on the Moto G86 Power, with `[n]` citations + Sources footer. The 10-star moment is shipped — it's just slow.

**Speed is the only blocker.** Q4_K_M weights run at ~1 tok/s prefill on this device because we had to disable the NEON-friendly weight repack to avoid OOM. **Q4_0 re-quantization is in flight in a separate Colab session** (user is running it). When it lands, expected ~5× prefill speedup with no code change beyond `MODEL.files.main` config update.

**Just shipped (post-merge):** KV cache quantization to Q4_0 (`cache_type_k`/`cache_type_v: 'q4_0'`). Frees ~40 MB on the device — RAM headroom that lets us bump `n_ctx` to ~2048 once Q4_0 _weights_ arrive, or absorb prefill memory pressure today.

## Last completed

- **PR #9 merged to main.** llama.rn 0.12.0-rc.5, RAG service, prompt cache service, useAntoine rewrite, three-stage streaming bubble, Sources footer, keyboard layout fix, hydration race fix, four device hotfixes. 122 tests green.
- **KV cache quantized to Q4_0.** One-line change in `inferenceService.ts`. Saves ~40 MB. tsc + lint + 122 tests still green. See [[llama-rn-inference-params]] for the updated parameter table.
- **Wiki: `decisions/llama-rn-inference-params.md` rewritten** to reflect the empirically-tuned values (n_ctx=1536, n_predict=384, no_extra_bufts:true, KV Q4_0) — the page was stale with the original pre-device-verification numbers.

## Currently in flight

- **Colab re-quantization to Q4_0 weights** (user-driven, separate session). Output: `antoine_mobile_q4_0.gguf` on R2 + SHA-256 + size in bytes.

## Next action

When Colab finishes and the user pastes the SHA/size/URL:

1. Update `MODEL.files.main` in `src/constants/config.ts` (URL, SHA-256, size in bytes, filename).
2. Update `../cc-culinaire-shared-context/model-config.md` to the new quantization.
3. Wipe the old Q4_K_M file off the device: `adb shell run-as com.anonymous.ccculinairekitchenmob rm files/models/antoine/v1/antoine_mobile_gemma3n.gguf`. Force-stop. Reopen.
4. App routes to DownloadingScreen → fetches Q4_0 file → SHA verifies → loads.
5. Send "Why does my hollandaise break?" — measure tokens/sec. Expected: ~5 tok/s prefill, ~5× faster overall.
6. With Q4_0 baseline established, **bump `n_ctx` from 1536 → 2048** (room created by KV Q4_0). Optionally raise RAG `limit: 2 → 3-4` chunks for richer grounding.
7. Re-attempt Vulkan offload (`n_gpu_layers: 99`) on Q4_0 specifically. The Mali-G615 may handle Q4_0's simpler layout where it choked on Q4_K_M.

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
