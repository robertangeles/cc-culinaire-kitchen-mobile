---
title: In flight — what's being worked on right now
category: synthesis
created: 2026-04-29
updated: 2026-05-03
related: [[project-status]], [[model-quantization-must-be-mainline]], [[rag-architecture]], [[server-managed-prompts]], [[privacy-invariant]], [[llama-rn-inference-params]]
---

The single source of truth for "where we are right now". Updated at the end of every session and read at the start of every new one. Always short (under 30 lines).

> **Read this FIRST in any new session, before `index.md` or anything else.** It tells you what to pick up.

## Status

**v1 shipped as text-only.** PR #20 squash-merged as `3da4492`. Vision/multimodal/image-attachment functionality removed end-to-end after a multi-day investigation closed with a hard finding: categorical food accuracy on the Mediatek + Q4_0 + CPU stack is unreliable across photo compositions, and none of the cheap fixes (sampler match, temperature drop, prompt addendum tweaks, image resize, Q8_0 mmproj swap) closed the gap. Ship surface is now smaller, faster, and honest.

**Side wins from removing vision:**

- ~770 lines of code deleted, 140 packages removed (expo-image-picker, expo-image-manipulator, expo-document-picker)
- Cold-start prefill is visibly faster — the ~945 MB BF16 mmproj is no longer loaded into RAM, freeing memory for compute buffers and KV cache
- Sampler reverted to text-tuned defaults (temp 0.7, top_p 0.9; no top_k, no repeat penalty)
- Total download for fresh installs is now ~5.19 GB (down from ~6.13 GB)

## Last completed (today, 2026-05-03)

- **PR #20 merged (`3da4492`).** Ship v1 as text-only — remove vision/multimodal end-to-end. Drops `MODEL.files.mmproj`, `tryInitMultimodal`, `media_paths` plumbing, `imageUri` field, `SYSTEM_PROMPT_IMAGE_ADDENDUM`, `IMAGE_ONLY_DEFAULT_TEXT`, the multi-turn image conflation fix, the `getFormattedChat` diagnostic, the `+` attachment button, the (mocked) mic icon and `PressToTalk` overlay, and the entire `AttachmentSheet`. DB `image_uri` column kept (Option A — unused but not migrated). Plus a polish: streaming-bubble paddingBottom bumped to `spacing.s8` so newest tokens land with breathing room above the composer.
- **PR #19 closed without merging.** Q8_0 mmproj swap regressed accuracy (Q8_0 is _lower_ precision than BF16, not higher — a fundamental error in the precision-gap hypothesis as originally framed). Q8_0 file stays on R2 indefinitely as artifact; current production code references neither projector.
- **Today's failed experiments (all reverted clean):** brevity addendum, aligned addendum, 336px image resize. Each regressed categorical food accuracy. The original PR #17/#18 addendum text and 1024px resize were load-bearing for the partial accuracy we had.

## Currently in flight

Nothing blocked. Branch state clean. **R2 cleanup pending the user's manual action** — both `antoine-v2-mmproj-bf16.gguf` (945 MB) and `antoine-v2-mmproj-q8_0.gguf` (560 MB) should be deleted from the bucket since no production code references either. Main `antoine-v2-q4_0.gguf` (5.19 GB) stays.

**Weekly Vulkan monitor still running** — claude.ai routine `trig_01S6Yk7CnGzxVzo2J698aaCv`, fires every Mon 09:00 AEST. When upstream llama.rn ships Vulkan in the prebuilt JNI, GPU offload becomes available; that opens the door to revisit vision since the projector→backbone precision interface behaves differently on GPU.

## Next action — locked sequence for v1.x

1. **v1.1 — UI i18n infrastructure.** Add `i18next` + `react-i18next`, extract the ~60–80 hardcoded English strings to a `locales/en.json` resource bundle, swap literals for `t('key')` calls. Add a `language` field to a Zustand store + SecureStore. Ships with EN-only resource bundle so nothing visibly changes yet — pure plumbing.
2. **v1.2 — Language picker + first non-English locale.** Wire the kebab menu's "Language" entry (currently a stub at `onPress: () => undefined`) to a language picker sheet. Add the first non-English `locales/{lang}.json`. On the model side, append a `Respond in {language}.` directive to the system prompt when language ≠ EN. FR is the natural culinary default. Per-language `antoine-system-prompt:{lang}` slugs in the web admin come later.
3. **v1.3+ — Add languages incrementally.** IT, ES, JA, ZH, etc. each get their own PR with translated `locales/{lang}.json` and a translated `antoine-system-prompt:{lang}` authored in the web admin (replacing the v1.2 prompt-directive shortcut once the localized prompt exists).
4. **Backlog:** PR #7 (wiki CRLF parser fix) and PR #8 (CI workflow) still open. Triage when convenient.

## Open questions / blockers

- llama.rn 0.12.0-rc.5 pin — Vulkan backend confirmed NOT in any published prebuilt JNI through rc.9. Parked until upstream ships.
- The cached `LlamaContext` is module-level in `inferenceService.ts`. Future settings path-override UI must call `releaseCachedContext()` AND `deleteSavedKV()`.
- Latent: duplicate-row race in `modelDownloadService.start()` (concurrent calls).
- `apiClient.post` doesn't thread an `AbortSignal`, so the 3s RAG timeout drops the response but doesn't cancel the fetch.
- KV-state files are bounded to ONE per launch now (orphan prune), but per-conversation KV state is out of scope this milestone.
- Existing-user devices that already downloaded the BF16 mmproj have a ~945 MB orphan file on disk after upgrading to v1. Acceptable per Option A; cleared on uninstall. No active code references it.

## Vision — not coming back without hardware progress

Documented for future-me. Vision is gated on **either**:

1. Vulkan GPU offload landing in llama.rn's prebuilt JNI (weekly monitor watches this), OR
2. A verified higher-precision-than-BF16 projector → Q4_0 backbone path (no obvious candidate today)

If Vulkan lands, the rerun should test BF16 mmproj on GPU first before any other tuning — GPU compute behaves differently at the projector→backbone interface than CPU does. The full investigation log is in `wiki/log.md` from 2026-05-01 through 2026-05-03.

## See also

- [[project-status]] — slow-changing narrative of shipped milestones
- [[llama-rn-inference-params]] — current parameter table + KV session persistence design
- [[rag-architecture]] — the data flow that shipped in PR #9
- [[server-managed-prompts]] — the cache-with-fallback pattern (now also the hash source for KV invalidation)
- [[privacy-invariant]] — kv-state files added to the audit list
- [[model-quantization-must-be-mainline]] — why Q4_0 + mainline llama.cpp
- `wiki/log.md` — append-only history
