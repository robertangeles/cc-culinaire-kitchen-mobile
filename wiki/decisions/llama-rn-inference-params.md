---
title: llama.rn inference parameters for Antoine
category: decision
created: 2026-04-29
updated: 2026-04-30
related: [[antoine]], [[on-device-inference]], [[streaming-architecture]], [[model-quantization-must-be-mainline]]
---

The exact `initLlama` and `completion` parameters baked into `src/services/inferenceService.ts`, with the reasoning for each. Tuned empirically on the Moto G86 Power (Mediatek Dimensity 7300, 8 GB RAM, arm64-v8a) — values reflect what actually survives + streams, not what the model docs suggest.

## Decision

| Param                                  | Value                                                                    | Where set    |
| -------------------------------------- | ------------------------------------------------------------------------ | ------------ |
| `n_ctx`                                | 2048                                                                     | `initLlama`  |
| `n_batch`                              | 256                                                                      | `initLlama`  |
| `n_ubatch`                             | 256                                                                      | `initLlama`  |
| `n_threads`                            | 4                                                                        | `initLlama`  |
| `n_gpu_layers`                         | 0 (CPU-only)                                                             | `initLlama`  |
| `no_extra_bufts`                       | true                                                                     | `initLlama`  |
| `cache_type_k`                         | `q4_0`                                                                   | `initLlama`  |
| `cache_type_v`                         | `q4_0`                                                                   | `initLlama`  |
| `n_predict`                            | 384                                                                      | `completion` |
| `temperature`                          | 0.7                                                                      | `completion` |
| `top_p`                                | 0.9                                                                      | `completion` |
| `stop`                                 | `<end_of_turn>`, `<\|end_of_turn\|>`, `<eos>`, `</s>`, `<\|endoftext\|>` | `completion` |
| `chat_template_kwargs.enable_thinking` | `''` (empty string — Jinja-falsy)                                        | `completion` |

## Why these values

### Memory-driven choices (the device fights us back)

**`n_ctx = 2048`.** Bumped from 1536 on 2026-04-30 alongside the Q4_0 weight migration. The 1536 ceiling was forced by Q4_K_M's CPU_REPACK buffer colliding with Android's low-memory killer; Q4_0 weights have no repack buffer (NEON-friendly storage layout) and Q4_0 KV cache cuts that overhead ~4× — together they free enough headroom for 2048 tokens of context. The 2048 number is conservative; once we measure RSS on the Q4_0 build we can revisit pushing higher.

**`no_extra_bufts = true`.** Originally added to disable llama.cpp's SIMD-optimized weight repack — that repack allocates a ~2.8 GB CPU_REPACK buffer on top of mmap'd weights and was the original OOM trigger on Q4_K_M. With Q4_0 weights this flag is a no-op (Q4_0 has no repack to skip), but kept defensively in case llama.cpp adds extra buffer types in a future bump that would re-trigger the OOM.

**`n_batch = 256`, `n_ubatch = 256`.** llama.cpp's default of 2048 sizes the compute buffer for a 2048-token prefill at once (~2.5 GB). 256 sizes it to ~265 MiB, which fits. Smaller `n_batch` trades a bit of prefill throughput for survival.

**`cache_type_k = 'q4_0'`, `cache_type_v = 'q4_0'`.** F16 KV cache would use ~72 MB at `n_ctx=2048`. Q4_0 cuts this ~4× to ~18 MB. Quality impact on a 4B model is negligible per llama.cpp benchmarks. The KV cache savings are what enabled the n_ctx bump from 1536 → 2048 in the same memory budget.

### Throughput choices

**`n_threads = 4`.** Dimensity 7300 is 4× Cortex-A78 (fast) + 4× Cortex-A55 (slow). 4 threads target only the fast cores; pushing higher (6 or 8) means the slow A55s drag the synchronous matmul barriers. Worth a sweep once Q4_0 weights are in — heterogeneous-core scheduling can flip with the kernel.

**`n_gpu_layers = 0` (CPU-only).** Vulkan offload was tried and rejected on this Mali-G615 — driver crashed `initLlama`. Worth retrying on Q4_0 specifically (different weight layout) before declaring permanently unfit. CPU-only is the predictable path right now.

### Generation choices

**`n_predict = 384`.** Was 1024 originally; lowered to 384 when n_ctx was 1536 to leave room for system prompt + RAG block. With n_ctx=2048 we now have ~1600 tokens of input budget; 384 still produces a comfortable 150-250 word answer. Could raise to 512 or 768 if longer culinary explanations are wanted — but the system prompt is calm-head-chef terse anyway, so 384 is rarely the bottleneck.

**`temperature = 0.7`, `top_p = 0.9`.** Standard chat-tuned defaults. Lower (≤0.5) makes Antoine stilted; higher (≥1.0) breaks the voice rules (sentence case, no marketing language).

**Stop tokens — broad set.** Gemma 3n emits `<end_of_turn>`. Bracket-piped variants + `<eos>`, `</s>`, `<|endoftext|>` are safety nets in case we swap models. Extra stops that aren't in the vocab are harmless. The streaming callback filters these so they don't leak into rendered text.

**`chat_template_kwargs.enable_thinking = ''`.** Critical: empty string, NOT the literal `'false'`. The kwarg is rendered through the chat template's Jinja, where ANY non-empty string is truthy — so `'false'` was being read as truthy, leaving Gemma's `<|channel|>thought` reasoning block enabled. Empty string is the falsy value Jinja respects. Verified empirically by watching the output stream: `''` suppresses the thought block; `'false'` does not.

## What we're not configuring (yet)

- **`use_mmap`** — left at llama.rn's default (true). Critical for keeping the 5 GB weights paged rather than fully resident.
- **Repeat penalty / frequency penalty** — not set. Gemma 3n instruction-tuned doesn't loop noticeably; revisit if observed.
- **Sampler chain** — default ordering. No mirostat, no dynamic temp.
- **`n_keep` / KV-prefix reuse across turns** — every `send()` re-prefills the entire prompt today. Identifying the system-prompt prefix and skipping its re-prefill on turn 2+ would be ~3× speedup on multi-turn — deferred until basic chat is fast enough on Q4_0.

## When to revisit

- **Now that Q4_0 weights + n_ctx=2048 are live:** raise `retrieve(..., { limit: 2 })` to 3 chunks if grounding feels thin. The third chunk costs ~100 tokens at the 400-char clip; budget is there.
- **If still slow on Q4_0:** sweep `n_threads` 4 → 6 → 8 and pick the one that maxes tokens/sec without UI jank.
- **Vulkan offload retry on Q4_0:** the Mali-G615 driver crashed on Q4_K_M's repack-friendly layout. Q4_0's simpler layout might unblock the GPU path. Cheap to retest with `n_gpu_layers: 99`; revert if crash.
- **If responses feel slow on multi-turn:** wire `n_keep` for system-prompt KV reuse.
- **If responses feel repetitive:** add `repeat_penalty: 1.05` to completion params.

## See also

- [[antoine]] — model identity and lifecycle
- [[streaming-architecture]] — how tokens flow from llama.rn to the UI
- [[model-quantization-must-be-mainline]] — why Q4_0 is the next milestone
- `src/services/inferenceService.ts` — implementation
