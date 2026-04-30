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
| `n_ctx`                                | 1536                                                                     | `initLlama`  |
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

**`n_ctx = 1536`.** KV cache scales linearly with context. The wiki originally said 2048, which **OOM-killed the app during prefill** on the Moto G86. 1536 is the empirical survival ceiling once weights (~5 GB mmap) + JS runtime + Android system are all resident. Every value above was tested by getting kernel-level OOM-killed mid-chat.

**`no_extra_bufts = true`.** Disables llama.cpp's SIMD-optimized weight repack. Without this flag, the loader allocates a ~2.8 GB CPU_REPACK buffer on top of the 5 GB mmap'd weights, which triggers the kernel low-memory killer. The cost: prefill falls to a generic non-NEON path (~1 tok/s on Q4_K_M). Q4_0 weights bypass the repack entirely (NEON-friendly storage layout) — see [[model-quantization-must-be-mainline]] for the planned Q4_0 migration.

**`n_batch = 256`, `n_ubatch = 256`.** llama.cpp's default of 2048 sizes the compute buffer for a 2048-token prefill at once (~2.5 GB). 256 sizes it to ~265 MiB, which fits. Smaller `n_batch` trades a bit of prefill throughput for survival.

**`cache_type_k = 'q4_0'`, `cache_type_v = 'q4_0'`.** F16 KV cache uses ~54 MB at `n_ctx=1536` (24 MB + 30 MB SWA). Q4_0 cuts this ~4× to ~14 MB total. Quality impact on a 4B model is negligible per llama.cpp benchmarks. The freed RAM is headroom for either bumping `n_ctx` to ~2048 once Q4_0 _weights_ land, or absorbing transient OS pressure during prefill.

### Throughput choices

**`n_threads = 4`.** Dimensity 7300 is 4× Cortex-A78 (fast) + 4× Cortex-A55 (slow). 4 threads target only the fast cores; pushing higher (6 or 8) means the slow A55s drag the synchronous matmul barriers. Worth a sweep once Q4_0 weights are in — heterogeneous-core scheduling can flip with the kernel.

**`n_gpu_layers = 0` (CPU-only).** Vulkan offload was tried and rejected on this Mali-G615 — driver crashed `initLlama`. Worth retrying on Q4_0 specifically (different weight layout) before declaring permanently unfit. CPU-only is the predictable path right now.

### Generation choices

**`n_predict = 384`.** Was 1024 originally. The system prompt + RAG block + history + n_predict must all fit within `n_ctx=1536`. With a ~700-token prompt budget, leaving 384 for the reply is the comfortable upper bound — produces 150-250 word answers. Ran 1024 once: "Context is full" error. 384 stuck.

**`temperature = 0.7`, `top_p = 0.9`.** Standard chat-tuned defaults. Lower (≤0.5) makes Antoine stilted; higher (≥1.0) breaks the voice rules (sentence case, no marketing language).

**Stop tokens — broad set.** Gemma 3n emits `<end_of_turn>`. Bracket-piped variants + `<eos>`, `</s>`, `<|endoftext|>` are safety nets in case we swap models. Extra stops that aren't in the vocab are harmless. The streaming callback filters these so they don't leak into rendered text.

**`chat_template_kwargs.enable_thinking = ''`.** Critical: empty string, NOT the literal `'false'`. The kwarg is rendered through the chat template's Jinja, where ANY non-empty string is truthy — so `'false'` was being read as truthy, leaving Gemma's `<|channel|>thought` reasoning block enabled. Empty string is the falsy value Jinja respects. Verified empirically by watching the output stream: `''` suppresses the thought block; `'false'` does not.

## What we're not configuring (yet)

- **`use_mmap`** — left at llama.rn's default (true). Critical for keeping the 5 GB weights paged rather than fully resident.
- **Repeat penalty / frequency penalty** — not set. Gemma 3n instruction-tuned doesn't loop noticeably; revisit if observed.
- **Sampler chain** — default ordering. No mirostat, no dynamic temp.
- **`n_keep` / KV-prefix reuse across turns** — every `send()` re-prefills the entire prompt today. Identifying the system-prompt prefix and skipping its re-prefill on turn 2+ would be ~3× speedup on multi-turn — deferred until basic chat is fast enough on Q4_0.

## When to revisit

- **After Q4_0 weights land:** bump `n_ctx` to 2048, raise `retrieve(..., { limit: 2 })` to 3-4 chunks if context allows. Re-measure tokens/sec and RSS.
- **If still slow on Q4_0:** sweep `n_threads` 4 → 6 → 8 and pick the one that maxes tokens/sec without UI jank.
- **If responses feel slow on multi-turn:** wire `n_keep` for system-prompt KV reuse.
- **If responses feel repetitive:** add `repeat_penalty: 1.05` to completion params.

## See also

- [[antoine]] — model identity and lifecycle
- [[streaming-architecture]] — how tokens flow from llama.rn to the UI
- [[model-quantization-must-be-mainline]] — why Q4_0 is the next milestone
- `src/services/inferenceService.ts` — implementation
