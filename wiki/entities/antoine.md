---
title: Antoine — the on-device culinary AI
category: entity
created: 2026-04-29
updated: 2026-04-29
related: [[design-system]], [[screens]], [[on-device-inference]], [[privacy-invariant]]
---

Antoine is the AI persona that lives inside CulinAIre Mobile. He is a Gemma 3-4B multimodal model running entirely on the user's Android phone via `llama.rn`, with the voice of a calm head chef.

## Identity

- **Name:** Antoine (`ASSISTANT_NAME` in `src/constants/config.ts`)
- **Role:** culinary intelligence — recipes, conversions, plating ideas, technique, timing, troubleshooting
- **Voice:** calm head chef. Direct, technical when needed, never twee. (Same voice as the [[design-system]].)
- **Privacy invariant:** conversation content NEVER leaves the device. See [[privacy-invariant]].

The system prompt is the single source of Antoine's personality. It lives in `src/constants/antoine.ts` and must NEVER be inlined elsewhere — the inference service is the only thing that injects it.

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
4. **Inference.** `inferenceService.ts` loads the model on first chat. (Currently a stub returning canned responses — `llama.rn` integration is the next milestone, see [[project-status]].)
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
