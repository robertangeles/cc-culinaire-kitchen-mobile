---
title: llama.rn inference parameters for Antoine
category: decision
created: 2026-04-29
updated: 2026-04-29
related: [[antoine]], [[on-device-inference]], [[streaming-architecture]]
---

The exact `initLlama` and `completion` parameters baked into `src/services/inferenceService.ts`, with the reasoning for each.

## Decision

| Param          | Value                                                                    | Where set    |
| -------------- | ------------------------------------------------------------------------ | ------------ |
| `n_ctx`        | 2048                                                                     | `initLlama`  |
| `n_threads`    | 4                                                                        | `initLlama`  |
| `n_gpu_layers` | 0 (CPU-only)                                                             | `initLlama`  |
| `n_predict`    | 1024                                                                     | `completion` |
| `temperature`  | 0.7                                                                      | `completion` |
| `top_p`        | 0.9                                                                      | `completion` |
| `stop`         | `<end_of_turn>`, `<\|end_of_turn\|>`, `<eos>`, `</s>`, `<\|endoftext\|>` | `completion` |

## Why these values

**`n_ctx = 2048`.** The KV cache scales linearly with context size; Gemma 3-4B at 4-bit needs ~250 MB per 1k tokens of cache. The Moto G86 Power has 8 GB RAM; Android keeps ~3 GB free for app processes after system overhead, of which the model weights consume ~5.34 GB once loaded (mmapped, so paged from disk). 2048 leaves headroom for the chat UI + Reanimated. We can revisit upward to 4096 once we measure RSS on real device — but starting conservative avoids OOM kills mid-conversation.

**`n_threads = 4`.** Phone CPUs have 6–8 cores but the OS doesn't guarantee dedicated cores. Four CPU threads gives the inference loop enough parallelism without starving UI rendering or the JS thread. llama.cpp's matmul scaling tapers off above ~4 threads on mobile-class CPUs anyway.

**`n_gpu_layers = 0`.** Vulkan/OpenCL paths exist in llama.rn but compatibility on Android is uneven (the OEM driver lottery). CPU-only is the predictable path. GPU offload is a possible follow-up if we measure tokens/sec under target on the Moto G86 Power.

**`n_predict = 1024`.** Antoine's voice (calm head chef) is direct; replies are not essays. 1024 tokens caps a runaway response while comfortably covering technique-explanation length. Most replies will hit a stop token well below the cap.

**`temperature = 0.7`, `top_p = 0.9`.** Standard chat-tuned defaults. Low-temp (≤ 0.5) makes Antoine stilted and repetitive; high-temp (≥ 1.0) breaks the voice rules (sentence case, no marketing language). 0.7 / 0.9 is the same combo most chat product UIs ship.

**Stop tokens — broad set.** Gemma 3's chat template emits `<end_of_turn>` to mark assistant turn end. We include the bracket-piped variants (`<|end_of_turn|>`) plus `<eos>`, `</s>`, `<|endoftext|>` as a safety net — extra stop tokens that don't appear in the model's vocabulary are harmless, and the broader set makes the inference layer resilient if we swap in a non-Gemma model later. The streaming callback also filters these out so they never leak into rendered text.

## What we're not configuring (yet)

- **`use_mmap`** — left at llama.rn's default (true). Critical for keeping the 5.34 GB weights paged rather than fully resident.
- **Repeat penalty / frequency penalty** — not set. Gemma 3 instruction-tuned variants don't usually loop; we'll revisit if device testing shows repetition.
- **Sampler chain** — using llama.cpp's default sampling order. Custom samplers (mirostat, dynamic temp) are complexity we don't need yet.

## When to revisit

- After first device run on the Moto G86 Power: record steady-state RSS and tokens/sec. If RSS is comfortable, bump `n_ctx` to 3072 or 4096 for longer multi-turn coherence.
- If responses feel slow: try `n_threads = 6` and benchmark.
- If responses feel repetitive: add `repeat_penalty: 1.05` to the completion params.

## See also

- [[antoine]] — model identity and lifecycle
- [[streaming-architecture]] — how tokens flow from llama.rn to the UI
- `src/services/inferenceService.ts` — implementation
