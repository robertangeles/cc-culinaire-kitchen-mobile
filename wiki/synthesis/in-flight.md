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

**v1.1 closed.** Both PR-A (`dde991d`, infrastructure) and PR-B (`a28f37c`, ~110 string extractions) shipped today. i18next + react-i18next are wired and every user-facing English literal in the component layer now flows through `t('namespace.key')` against `src/locales/en.json`. UI looks identical to v1; the foundation is in place for v1.2's language picker + first non-EN locale.

**Locked architectural decisions** (all baked into v1.1 or the v1.2 plan):

- Per-language prompt slug naming: `antoine-system-prompt-{lang}` (dash separator, URL-safe)
- i18next initialized at module load with EN default; boot effect hydrates store from SecureStore
- Hierarchical-namespaced translation keys (`auth.signInButton`, not `"Sign in"`); spec at `docs/i18n-conventions.md`
- `useI18nStore` (Zustand) is single source of truth; SecureStore + i18next are downstream side effects
- Per-conversation language override coming at v1.2 via a `language` column on `ckm_conversation`
- Picker uses a feature-flag endpoint (web-side) to gate which non-EN languages are surfaced — decouples mobile + web release cadences
- Translated prompts authored on the web admin; never auto-translated; gated by an automated eval harness (LLM-judge + bilingual reviewer signoff)
- Brand marks ("Antoine", "CulinAIre", "LITE") stay as literals — names, not translatable copy

## Last completed (today, 2026-05-03)

- **PR #22 merged (`a28f37c`).** v1.1 PR-B — mechanical extraction of ~110 hardcoded English strings across 11 components into `src/locales/en.json`. Two new namespaces (`welcome`, `onboarding`) added beyond PR-A's canonical six. 4 inline-styled strings use `<Trans>` for component slots. Convention doc updated. Pre-flight + device-verified — UI byte-identical to PR-A.
- **PR #21 merged (`dde991d`).** v1.1 PR-A — i18n infrastructure (deps, store, init, boot effect, en.json skeleton, conventions doc, 7 unit tests).
- **`expo-localization` deferred.** Pulled mid-PR-A when Metro `UnableToResolve` revealed it needs a dev-client rebuild. Returns at v1.2 alongside the picker UI work.
- **Cross-project contract written.** `mobile-needs.md` 2026-05-03 entries: per-language prompt slug naming, feature-flag endpoint contract, eval harness expectations, apiClient HTTP-status refactor.
- **/plan-ceo-review + /plan-eng-review** ran on the v1.x i18n roadmap. 13 decisions resolved. Full log in `decisions.md`.

## Currently in flight

Nothing blocked. Branch state clean. **R2 cleanup pending** — both `antoine-v2-mmproj-bf16.gguf` (945 MB) and `antoine-v2-mmproj-q8_0.gguf` (560 MB) should be deleted from the bucket; no production code references either. Main `antoine-v2-q4_0.gguf` (5.19 GB) stays.

Weekly Vulkan monitor still running (claude.ai routine `trig_01S6Yk7CnGzxVzo2J698aaCv`). When upstream llama.rn ships Vulkan in the prebuilt JNI, vision becomes revisitable.

## Next action — locked sequence

1. **v1.1.5 — History sheet UX fixes (small, focused PR before v1.2 starts).** Three bugs/gaps observed during PR-B device testing of the History sheet:
   - **Sheet snap-point position is wrong.** Configured `['50%', '90%']` but opens at ~25-30% on the Moto G86 Power. Bottom safe-area inset (Android nav bar) not applied — second conversation row is partially obscured. User has to drag up before they see more than 1-2 rows.
   - **No per-conversation delete.** Each row is a `Pressable` that fires `onPick` only — no long-press menu, no swipe-to-delete, no per-row trash icon. Untitled conversations accumulate forever.
   - **No clear-all action.** Kebab menu's "Clear conversation" only clears the active conversation. No way to clear all history at once. Should land in either the sheet header or the kebab as a "Clear all history" entry with a confirm dialog.
   - Bonus while we're here: every conversation lists as "Untitled conversation". Auto-generate a title from the first user message at commit time. Differentiates the rows.
2. **v1.2 — Language picker + first non-EN locale (FR).** Bigger PR, bigger coordination. Mobile: wire kebab Language picker (Option A — partial-language banner UX), add `locales/fr.json`, parameterize `getActivePrompt(slug)` with 404-set fallback, `apiClient` HTTP-status refactor, `ckm_conversation.language` schema migration, re-add `expo-localization` (with dev-client rebuild). Web: localized-prompts admin section, author + culinary-reviewer-sign `antoine-system-prompt-fr`, build the automated eval harness, add `GET /api/mobile/feature-flags` endpoint. Coordinated ship.
3. **v1.3+ — Additional languages, incrementally.** Each new language: one mobile PR (locale bundle + tests) + one web entry (authored prompt + eval pass + curated RAG corpus + feature-flag flip). Locale-aware RAG retrieval lands at v1.3 (chunks tagged by language).
4. **Backlog:** PR #7 (wiki CRLF parser fix), PR #8 (CI workflow). Triage when convenient.

## Pre-launch product requirement — food-safety acknowledgement screen

**Required before public Google Play launch.** A dedicated acknowledgement screen during first launch, where the user explicitly confirms they have read and understood the food-safety, allergen, medical, and AI-output disclaimers from the Terms of Service. Tap-through ("I understand") gates entry to chat. Re-prompt only on ToS version bump.

Why: derived from the Terms of Service drafting brief (food-safety + allergen + medical disclaimers are the most legally consequential section). A separate explicit-consent screen materially strengthens enforceability of those clauses under both Australian Consumer Law and EU/UK consumer protection regimes — it converts the disclaimers from "buried in legal text" to "user actively acknowledged." This is for the user's protection (clear scope of what Antoine is and isn't) AND for the publisher's liability posture.

Where it fits: somewhere between sign-up + email-verify and the model-download step in the onboarding flow. Probably belongs in v1.2 scope alongside the language picker (since localized disclaimer text needs the i18n infrastructure that lands then), with a placeholder in v1.1 if launch timing demands it. The acknowledgement state should persist via a new `ckm_food_safety_ack_version` SecureStore key so the screen doesn't re-prompt every launch — only when the disclaimer version bumps.

## Open questions / blockers

- llama.rn 0.12.0-rc.5 pin — Vulkan backend confirmed NOT in any published prebuilt JNI through rc.9. Parked until upstream ships.
- The cached `LlamaContext` is module-level in `inferenceService.ts`. Future settings path-override UI must call `releaseCachedContext()` AND `deleteSavedKV()`.
- Latent: duplicate-row race in `modelDownloadService.start()` (concurrent calls).
- `apiClient.post` doesn't thread an `AbortSignal`, so the 3s RAG timeout drops the response but doesn't cancel the fetch. (`apiClient.get` will need typed `HttpError` exposure for v1.2's 404-set logic.)
- KV-state files are bounded to ONE per launch (orphan prune), but per-conversation KV state is out of scope this milestone.
- Existing-user devices that already downloaded the BF16 mmproj have a ~945 MB orphan file on disk after upgrading to v1. Acceptable; cleared on uninstall.

## Vision — not coming back without hardware progress

Vision is gated on **either** (1) Vulkan GPU offload landing in llama.rn's prebuilt JNI (weekly monitor watches this), OR (2) a verified higher-precision-than-BF16 projector → Q4_0 backbone path (no obvious candidate today). If Vulkan lands, the rerun should test BF16 mmproj on GPU first before any other tuning. Full investigation log in `wiki/log.md` from 2026-05-01 through 2026-05-03.

## See also

- [[project-status]] — slow-changing narrative of shipped milestones
- [[llama-rn-inference-params]] — current parameter table + KV session persistence design
- [[rag-architecture]] — the data flow that shipped in PR #9
- [[server-managed-prompts]] — the cache-with-fallback pattern (now also the hash source for KV invalidation; v1.2 extends it for per-language slugs)
- [[privacy-invariant]] — kv-state files added to the audit list
- [[model-quantization-must-be-mainline]] — why Q4_0 + mainline llama.cpp
- `docs/i18n-conventions.md` — hierarchical-namespaced key naming, plurals, forbidden patterns, brand-mark exclusion rule
- `wiki/log.md` — append-only history
- `../cc-culinaire-shared-context/mobile-needs.md` — cross-project needs (per-language prompts, feature-flag endpoint, eval harness)
- `../cc-culinaire-shared-context/decisions.md` — cross-project decisions log (v1 text-only ship, i18n roadmap)
