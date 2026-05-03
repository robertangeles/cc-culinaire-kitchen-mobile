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

**v1 shipped text-only; v1.1 PR-A (i18n infrastructure) shipped today.** The vision investigation closed last session with a hard finding (categorical food accuracy on Q4_0 + CPU is unreliable; vision needs hardware progress to come back). Today we pivoted to i18n: ran /plan-ceo-review + /plan-eng-review on the v1.x roadmap (13 decisions resolved, all logged in `decisions.md`), then shipped PR #21 — the JS-only foundation layer for translations. Zero visible UI change.

**Locked architectural decisions** (all baked into PR #21 or the v1.x plan):

- Per-language prompt slug naming: `antoine-system-prompt-{lang}` (dash separator, URL-safe)
- i18next initialized at module load with EN default; boot effect hydrates store from SecureStore and layers in i18next sync
- Hierarchical-namespaced translation keys (`auth.signIn`, not `"Sign in"`); spec at `docs/i18n-conventions.md`
- `useI18nStore` (Zustand) is single source of truth; SecureStore + i18next are downstream side effects
- Per-conversation language override coming at v1.2 via a `language` column on `ckm_conversation`
- Picker uses a feature-flag endpoint (web-side) to gate which non-EN languages are surfaced — decouples mobile + web release cadences
- Translated prompts authored on the web admin; never auto-translated; gated by an automated eval harness (LLM-judge + bilingual reviewer signoff)

## Last completed (today, 2026-05-03)

- **PR #21 merged (`dde991d`).** v1.1 PR-A — i18n infrastructure. Adds `i18next` + `react-i18next`, `useI18nStore` Zustand store with hydrate + setLanguage actions, empty namespaced `locales/en.json`, `docs/i18n-conventions.md`, boot effect wiring in `app/_layout.tsx`, `STORAGE_KEYS.language` config entry, 7 unit tests. Pre-flight green (157/157 tests). Device-verified — UI looks identical to v1.
- **`expo-localization` deferred.** Originally part of PR-A; pulled when Metro `UnableToResolve` revealed it needs a dev-client rebuild. Returns at v1.2 alongside the picker UI work that needs the rebuild anyway. v1.1 boot effect is hydrate-only (read SecureStore → sync i18next); device-locale auto-detect comes back in v1.2.
- **Cross-project contract written.** New `mobile-needs.md` entries (2026-05-03) capture the per-language prompt slug naming, the feature-flag endpoint contract, the eval harness expectations, and the apiClient HTTP-status refactor.
- **/plan-ceo-review + /plan-eng-review run** on the v1.x i18n roadmap. 13 decisions resolved (CEO-1 through CEO-6 + ENG-D1 through ENG-D7). Full log in `decisions.md` from the shared-context repo.

## Currently in flight

Nothing blocked. Branch state clean. **R2 cleanup pending** — both `antoine-v2-mmproj-bf16.gguf` (945 MB) and `antoine-v2-mmproj-q8_0.gguf` (560 MB) should be deleted from the bucket; no production code references either. Main `antoine-v2-q4_0.gguf` (5.19 GB) stays.

Weekly Vulkan monitor still running (claude.ai routine `trig_01S6Yk7CnGzxVzo2J698aaCv`). When upstream llama.rn ships Vulkan in the prebuilt JNI, vision becomes revisitable.

## Next action — locked sequence for v1.x

1. **v1.1 PR-B — mechanical `t()` extraction.** Pull ~60-80 hardcoded English strings from components/screens/auth pages/error messages into `src/locales/en.json` namespaces; replace literals with `t('namespace.key')` calls. Spec is `docs/i18n-conventions.md`. Largely automatable; single PR. Pre-flight + device test confirms zero visible difference (every screen still shows the same English text, just routed through i18next now). Closes v1.1.
2. **v1.2 — Language picker + first non-EN locale (FR).** Bigger PR, bigger coordination. Mobile: wire kebab Language picker (Option A — partial-language banner UX), add `locales/fr.json`, parameterize `getActivePrompt(slug)` with 404-set fallback, `apiClient` HTTP-status refactor, `ckm_conversation.language` schema migration, re-add `expo-localization` (with dev-client rebuild). Web: localized-prompts admin section, author + culinary-reviewer-sign `antoine-system-prompt-fr`, build the automated eval harness, add `GET /api/mobile/feature-flags` endpoint. Coordinated ship.
3. **v1.3+ — Additional languages, incrementally.** Each new language: one mobile PR (locale bundle + tests) + one web entry (authored prompt + eval pass + curated RAG corpus + feature-flag flip). Locale-aware RAG retrieval lands at v1.3 (chunks tagged by language).
4. **Backlog:** PR #7 (wiki CRLF parser fix), PR #8 (CI workflow). Triage when convenient.

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
- `docs/i18n-conventions.md` — hierarchical-namespaced key naming, plurals, forbidden patterns (PR-B's spec)
- `wiki/log.md` — append-only history
- `../cc-culinaire-shared-context/mobile-needs.md` — cross-project needs (per-language prompts, feature-flag endpoint, eval harness)
- `../cc-culinaire-shared-context/decisions.md` — cross-project decisions log (v1 text-only ship, i18n roadmap)
