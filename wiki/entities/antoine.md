---
title: Antoine — the on-device culinary AI
category: entity
created: 2026-04-29
updated: 2026-04-30
related: [[design-system]], [[screens]], [[on-device-inference]], [[privacy-invariant]], [[streaming-architecture]], [[llama-rn-inference-params]], [[rag-architecture]], [[server-managed-prompts]]
---

Antoine is the AI persona that lives inside CulinAIre Mobile. He is a Gemma 3-4B multimodal model running entirely on the user's Android phone via `llama.rn`, with the voice of a calm head chef.

## Identity

- **Name:** Antoine (`ASSISTANT_NAME` in `src/constants/config.ts`)
- **Role:** culinary intelligence — recipes, conversions, plating ideas, technique, timing, troubleshooting
- **Voice:** calm head chef. Direct, technical when needed, never twee. (Same voice as the [[design-system]].)
- **Privacy invariant:** conversation content NEVER leaves the device. See [[privacy-invariant]].

The system prompt is the single source of Antoine's personality. As of 2026-04-30 it is **server-managed** (`promptCacheService` fetches `GET /api/mobile/prompts/antoine-system-prompt`, caches in SecureStore, falls back to the baked-in body if cache + network both miss). The constant in `src/constants/antoine.ts` is now the offline-first-launch fallback, not the source of truth. See [[server-managed-prompts]].

## Knowledge sources

Antoine is grounded at query time in the user's culinary corpus on the web — 4,400+ chunks across 18 books (Salt Fat Acid Heat, On Food and Cooking, Mastering the Art of French Cooking, The Flavor Bible, etc.). When the user asks a question, `ragService.retrieve()` fetches the top-k chunks (default 5) and they're injected as a second system message numbered `[1]`, `[2]`, ... The system prompt instructs Antoine to cite `[n]` when consulting them; the chat UI surfaces them as a "Sources" footer on the assistant message. See [[rag-architecture]].

This is the difference between "generic small model that runs offline" and "private culinary librarian + chef." The retrieval is silent and best-effort — if the network is offline or slow, Antoine still answers (no citations that turn). Privacy boundary: only the current query crosses; response + history stay on device. See [[privacy-invariant]].

## Model artefact

Antoine is shipped as two GGUF files downloaded once at first launch:

| File                              | Size                       | Purpose                              |
| --------------------------------- | -------------------------- | ------------------------------------ |
| `gemma-4-e4b-it.Q4_K_M.gguf`      | 5,335,285,376 B (~5.34 GB) | Main weights (4-bit quantized)       |
| `gemma-4-e4b-it.BF16-mmproj.gguf` | 991,551,904 B (~0.99 GB)   | Multimodal projector for image input |

Total: **6.33 GB.** SHA-256 verified after download (see `MODEL` in `src/constants/config.ts`).

Hosted on Cloudflare R2 public bucket: `https://pub-7a835c8f4b344301811de8e23b8b3983.r2.dev/`

## On-device path

After download, files land at the app's private files directory:

```
/data/data/com.anonymous.ccculinairekitchenmob/files/models/antoine/v1/
  gemma-4-e4b-it.Q4_K_M.gguf
  gemma-4-e4b-it.BF16-mmproj.gguf
```

JS uses `BackgroundDownloadModule.getDocumentDirectory()` to discover the absolute base path; it does NOT need to know Android filesystem layout.

## Lifecycle in the app

1. **First launch.** User signs in → OnboardingScreen → tap "Get Antoine" → DownloadingScreen auto-fires the download (PR #3, PR #4).
2. **Download** runs in a foreground WorkManager service. Survives backgrounding + process kill via Room persistence + HTTP 206 range resume. See [[background-download]].
3. **Verification.** SHA-256 checked after each file lands; mismatch deletes + retries.
4. **Inference.** `inferenceService.ts` loads the model on first chat via `llama.rn` (`initLlama`). Tokens stream back via the completion callback, accumulate in `conversationStore.streamingText`, render in a virtual chat bubble, then commit as a real SQLite row on completion. See [[streaming-architecture]] and [[llama-rn-inference-params]].
5. **Persistence.** Conversations live in `expo-sqlite` via Drizzle (`ckm_conversation`, `ckm_message`). Never synced to backend.

## Why on-device

- **Privacy.** No cloud round-trips during inference means no surface area for conversation leakage. The "kitchen IP stays in the kitchen" promise is only credible if the model runs locally.
- **Offline.** Works in the walk-in fridge, in basements, on planes — nowhere a cellular signal reaches matters.
- **Cost model.** No per-inference fees. The user pays once (subscription) for the app + model; inference is free forever.

## Inspiration

The on-device model architecture is adapted from [off-grid-mobile-ai](https://github.com/alichherawalla/off-grid-mobile-ai) (MIT). Their patterns for chunked download, range resume, checksum verification, and llama.rn integration informed PR #4 (CDN download) and will inform the upcoming inference PR.

## See also

- [[design-system]] — Antoine's voice rules align with the design voice rules
- [[screens]] — where Antoine surfaces (Chat tab)
- [[on-device-inference]] — the technical pattern (TBD; create when implementing)
- [[privacy-invariant]] — the rule that makes Antoine credible (TBD; create when relevant)
- `src/constants/antoine.ts` — system prompt (single source of truth)
- `src/constants/config.ts` — `MODEL` constant: filenames, sizes, URLs, hashes
