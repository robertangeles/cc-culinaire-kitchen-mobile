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

**v1.2 closed.** PR #24 (`271fe97`) merged + device-verified on the Moto G86 Power: language picker, legal pages (Terms + Privacy via the web's `/api/site-pages/:slug?surface=mobile` endpoint), food-safety acknowledgement gate between email-verify and chat entry, copper non-EN language badge in ChatHeader. Mobile-side i18n stack is now end-to-end. R2 cleanup done — both unused mmproj files deleted from the bucket.

**Locked architectural decisions** (all baked in):

- Per-language prompt slug naming: `antoine-system-prompt-{lang}` (dash separator, URL-safe)
- i18next initialized at module load with EN default; boot effect hydrates store from SecureStore
- Hierarchical-namespaced translation keys (`auth.signInButton`, not `"Sign in"`); spec at `docs/i18n-conventions.md`
- `useI18nStore` (Zustand) is single source of truth; SecureStore + i18next are downstream side effects
- Per-conversation language override via `language` column on `ckm_conversation`
- Picker uses a feature-flag endpoint (web-side) to gate which non-EN languages are surfaced
- Translated prompts authored on the web admin; never auto-translated; gated by an automated eval harness
- Brand marks ("Antoine", "CulinAIre", "LITE") stay as literals — names, not translatable copy
- `(legal)` route group reachable in any auth state — Terms + Privacy must be readable pre-signup for ToS acceptance
- Food-safety ack is per-session, in-memory only; resets on cold launch + sign-out

## Last completed (today, 2026-05-03)

- **PR #26 merged (`21f18a5`).** Infra cleanup — wiki CRLF parser fix (PR #7's `293461c` cherry-picked) + minimal GitHub Actions CI (PR #8's `f1974c0` cherry-picked, fresh from main, dropping the stale CLAUDE.md edits + obsolete commits). First CI run caught a real bug: `react-native-markdown-display` was missing from `package.json` (PR #24 had only added it to local `node_modules`); fixed in the same PR. Also opted into Node 24 for JS-based actions ahead of GitHub's June 2026 forced cutover. Closes #7 + #8. CI is now live and runs on every future PR.
- **PR #25 merged (`03bc43e`).** Latent-bug cleanup — `AbortSignal` threaded through `apiClient` (RAG 3s timeout now actually cancels the fetch, not just drops the response); module-level `inflightBootstrap` chain in `modelDownloadService` serializes concurrent `start()` calls so they adopt instead of duplicate Room rows. +5 unit tests.
- **PR #24 merged (`271fe97`) + device-verified.** v1.2 finale — legal pages + food-safety ack + language badge. Built on top of the v1.2 picker checkpoint (`742a39d`). Includes RouteGuard `(legal)` early-return so unauth users can read ToS, `react-native-markdown-display` themed in the editorial palette, `<Trans>` slots routing from LoginScreen to `/(legal)/{terms|privacy}`, FR locale label aligned to "Politique de confidentialité" matching the API title, copper non-EN badge in ChatHeader.
- **`742a39d` v1.2 picker checkpoint.** Language picker UI with partial-language banner (Option A); `getActivePrompt(slug)` parameterised; `apiClient` HTTP-status refactor with typed `HttpError`; `ckm_conversation.language` migration; `expo-localization` re-added.
- **PR #23 merged (`f1777b0`).** v1.1.5 history sheet UX — fixed snap-point position, added per-row delete, clear-all action, auto-titles from first user message.
- **R2 cleanup done.** Both `antoine-v2-mmproj-bf16.gguf` (945 MB) and `antoine-v2-mmproj-q8_0.gguf` (560 MB) deleted from the bucket.
- **Cross-project unblock.** Web session's PR #14 pushed the `/api/site-pages` route that was sitting on an unpushed local branch — that was the actual cause of the 404 mobile saw, not a publish-state issue. Endpoints now live in prod for `terms` + `privacy` mobile surfaces.
- **SessionStart hooks wired.** Mobile + web repos both got `.claude/hooks/*-on-session-start.ps1` scripts that surface the other side's `*-needs.md` only when modified since the last session (mtime + sidecar). Closes the cross-project visibility gap.

## Currently in flight

Nothing blocked. Branch state clean. CI is live on main and gates every PR; lint / tsc / test all passing on the latest commit.

## Next action — locked sequence

1. **v1.3 — Additional languages, incrementally.** First candidate is FR (placeholder `antoine-system-prompt-fr` already live on the web side; needs human authoring + culinary-reviewer signoff + eval-harness pass before the picker exposes FR via the feature flag). Each subsequent language: one mobile PR (locale bundle + tests) + one web entry (authored prompt + eval pass + curated RAG corpus + feature-flag flip).
2. **v1.3 — Locale-aware RAG retrieval.** Chunks tagged by language; retrieval honours the active conversation language. Web-side schema work needed first.
3. **v1.4+ — TBD.** Vision rerun gated on Vulkan upstream (weekly monitor `trig_01S6Yk7CnGzxVzo2J698aaCv` still running). Other product directions (recipe scaling tool, conversation export, STT) explored + parked at the 2026-05-03 CEO review.

## Open questions / blockers

- llama.rn 0.12.0-rc.5 pin — Vulkan backend confirmed NOT in any published prebuilt JNI through rc.9. Parked until upstream ships.
- The cached `LlamaContext` is module-level in `inferenceService.ts`. Future settings path-override UI must call `releaseCachedContext()` AND `deleteSavedKV()`.
- KV-state files are bounded to ONE per launch (orphan prune), but per-conversation KV state is out of scope this milestone.
- Existing-user devices that already downloaded the BF16 mmproj have a ~945 MB orphan file on disk after upgrading to v1. Acceptable; cleared on uninstall.

## Vision — not coming back without hardware progress

Vision is gated on **either** (1) Vulkan GPU offload landing in llama.rn's prebuilt JNI (weekly monitor watches this), OR (2) a verified higher-precision-than-BF16 projector → Q4_0 backbone path (no obvious candidate today). If Vulkan lands, the rerun should test BF16 mmproj on GPU first before any other tuning. Full investigation log in `wiki/log.md` from 2026-05-01 through 2026-05-03.

## See also

- [[project-status]] — slow-changing narrative of shipped milestones
- [[llama-rn-inference-params]] — current parameter table + KV session persistence design
- [[rag-architecture]] — the data flow that shipped in PR #9
- [[server-managed-prompts]] — the cache-with-fallback pattern (extended at v1.2 for per-language slugs)
- [[privacy-invariant]] — kv-state files added to the audit list
- [[model-quantization-must-be-mainline]] — why Q4_0 + mainline llama.cpp
- `docs/i18n-conventions.md` — hierarchical-namespaced key naming, plurals, forbidden patterns, brand-mark exclusion rule
- `wiki/log.md` — append-only history
- `../cc-culinaire-shared-context/mobile-needs.md` — cross-project needs (per-language prompts, feature-flag endpoint, eval harness, `/api/site-pages` resolution)
- `../cc-culinaire-shared-context/decisions.md` — cross-project decisions log (v1 text-only ship, i18n roadmap)
