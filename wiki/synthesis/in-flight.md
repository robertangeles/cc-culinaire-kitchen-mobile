---
title: In flight — what's being worked on right now
category: synthesis
created: 2026-04-29
updated: 2026-05-04
related: [[project-status]], [[model-quantization-must-be-mainline]], [[rag-architecture]], [[server-managed-prompts]], [[privacy-invariant]], [[llama-rn-inference-params]]
---

The single source of truth for "where we are right now". Updated at the end of every session and read at the start of every new one. Always short (under 30 lines).

> **Read this FIRST in any new session, before `index.md` or anything else.** It tells you what to pick up.

## Status

**v1.3 PR-A open as PR #27** — branch `feature/ck-mob/feedback-mvp` pushed, device-verified end-to-end on the Moto G86 Power (anon submission from Login → 201 from prod → email landed in `ran@robertangeles.com` via the async Resend forwarder). Awaiting review/merge. Web side fulfilled the same day (commit `2a307de`): `POST /api/mobile/feedback` deployed, `ckm_feedback` table created, `authenticateOptional` + `mobileVersionGuard` + `feedbackRateLimit` + 5-min Resend cron live, 39 new server tests (216 total passing). Contract published to shared-context `api-contracts.md` § Mobile + `db-schema.md` § ckm_feedback.

**v1.2 closed.** PR #24 (`271fe97`) merged + device-verified: language picker, legal pages, food-safety ack, copper non-EN badge. R2 cleanup done.

**Locked architectural decisions** (all baked in):

- Per-language prompt slug naming: `antoine-system-prompt-{lang}` (dash separator, URL-safe)
- i18next initialized at module load with EN default; boot effect hydrates store from SecureStore
- Hierarchical-namespaced translation keys (`auth.signInButton`, not `"Sign in"`); spec at `docs/i18n-conventions.md`
- `useI18nStore` (Zustand) is single source of truth; SecureStore + i18next are downstream side effects
- Per-conversation language override via `language` column on `ckm_conversation`
- Picker uses a feature-flag endpoint (web-side) to gate which non-EN languages are surfaced
- Translated prompts authored on the web admin; never auto-translated; gated by an automated eval harness
- Brand marks ("Antoine", "CulinAIre", "LITE") stay as literals — names, not translatable copy
- `(legal)` and `(feedback)` route groups reachable in any auth state — Terms + Privacy must be readable pre-signup; feedback anon path captures pre-auth signup/billing bugs
- Food-safety ack is per-session, in-memory only; resets on cold launch + sign-out
- Feedback channel: optional Bearer (anon path stores `user_id=NULL`); `X-Mobile-App-Version` header on every request, 426 enforcement gated to `/api/mobile/feedback` only for v1.3; closed-shape `device_info` (zod-strict, opt-in via diagnostic toggle); per-user 10/hr + per-IP-hash 3/hr rate limit with Retry-After; async Resend forwarder (plaintext-only MIME)
- Cross-account leak guard: `authStore.signOut` explicitly wipes `feedback.count.<user_id>` + `feedback.count.anon` from AsyncStorage (SecureStore wipe doesn't touch it)

## Last completed (today, 2026-05-04)

- **PR #27 merged (`db21c61`) — v1.3 PR-A in-app feedback / bug submission.** Followed by local-branch cleanup of 14 stale branches (full audit + recovery doc, captured in PR #28). Branch `feature/ck-mob/feedback-mvp` (3 commits: `ffe1772` deferred-todo planning, `41a5f37` full implementation, `0a0ac10` version bump 1.0.0 → 1.3.0 + web-pin sync). 12 new files, 13 modified, ~800 LOC. Service layer: `deviceInfo` (memoized closed-shape) / `feedbackPayload` (single-source `buildPayload()` feeds preview + POST body) / `feedbackService` (Bearer-optional, 10s `AbortController`) / `feedbackCount` (AsyncStorage namespaced per user_id|anon). New modal at `app/(feedback)/*` with 3-chip category, diagnostic toggle + literal-JSON preview, photo via `expo-image-picker` `base64:true` ≤500 KB. `apiClient` injects `X-Mobile-App-Version` on every request, throws `UpgradeRequiredError(426)`, surfaces `Retry-After` on `ApiError(429)`. RouteGuard `(feedback)` early-return for anon path. Settings row + copper "{n} sent" badge; Login "Send feedback" link. en + fr i18n. 28 new tests; full suite 208/208 passing. Wire format verified against shared-context `api-contracts.md` § Mobile / POST /api/mobile/feedback.
- **Device verification on Moto G86 Power.** Anon submission from Login → form → photo attach → 201 from prod → "Thanks — Antoine has it" → email landed in `ran@robertangeles.com`. Initial 426 mismatch (mobile sent 1.0.0 vs server `MIN_MOBILE_APP_VERSION=1.3.0`) — fixed by bumping `app.config.ts` version + rebuild; the 426 error path itself was thereby proven as a side-effect of the misconfiguration.
- **Web fulfilled the cross-project request same day.** Commit `2a307de`: `POST /api/mobile/feedback` deployed, `ckm_feedback` table created (12 cols, 4 indexes + PK, 2 CHECK constraints), `authenticateOptional` middleware (no silent token downgrade), `mobileVersionGuard({ enforceMin: true })`, per-route `feedbackRateLimit` (10/hr user, 3/hr IP-hash), 5-min async Resend retry job (plaintext-only MIME, exponential backoff, 5-attempt cap). 39 new server unit tests (216 total). `RESEND_API_KEY` allowed unset (rows still persist; only delivery skipped). `RESEND_FEEDBACK_INBOX` defaults to `ran@robertangeles.com`, fail-fast at boot if unset.
- **Toolchain bring-up on this Mac (one-time).** Android Studio + JDK 21 (JBR) + NDK 27 + Build-Tools 35/36 + CMake 3.22.1 installed; `adb` wired. Fixed two latent bugs: `android/gradlew` lost +x bit from pnpm install (chmod +x); `android/gradle.properties` had Windows `C:\Users\trebo\…\Temp` baked into `org.gradle.jvmargs` (removed the `-Djava.io.tmpdir` override entirely). `android/` is gitignored so build.gradle versionName edit is local-only — `app.config.ts` version is the source of truth and prebuild regenerates from it.
- **PR #26 merged (`21f18a5`).** Infra cleanup — wiki CRLF parser fix + minimal GitHub Actions CI live on main. Closes #7 + #8.
- **PR #25 merged (`03bc43e`).** `AbortSignal` threaded through `apiClient`; `inflightBootstrap` serializes concurrent `start()` calls.
- **PR #24 merged (`271fe97`) + device-verified.** v1.2 finale — legal pages + food-safety ack + language badge.

## Currently in flight

**PR #27 merged** as `db21c61` (in-app feedback / bug submission). Local-branch cleanup of 14 stale branches completed with full audit + documented recovery plan; that doc is in **PR #28** (`chore/ck-mob/log-branch-cleanup`) awaiting review.

**Three tasks queued, ready to start in priority order:**

1. **Email verification banner** — `cc-culinaire-shared-context/needs-backend.md` open ask from 2026-05-03. Persistent banner / modal when `user.emailVerified === false`, "Resend verification email" button calling `POST /auth/resend-verification` (200 success / 429 rate-limited, max 3/hr). Independent scope, ~2-3h. **Recommend doing this next** — small, unblocks the web team's existing UX gap, the only cross-project ask still open.
2. **v1.3 PR-B — FR language rollout.** Placeholder slug `antoine-system-prompt-fr` already wired on the web side; needs human-authored prompt + culinary-reviewer signoff + eval-harness pass before the picker exposes FR via the feature flag. Mobile-side work: locale bundle completeness audit + tests + PR.
3. **v1.3 PR-C — Locale-aware RAG.** Chunks tagged by language; retrieval honours the active conversation language. Web-side schema work needed first — coordinate with web before mobile starts.

Two test-plan items still deferred from PR #27 (inventory only, not blocking): cross-account leak guard live verification (needs a 2nd test account); 429 cooldown UX (would require 11 submissions in <1hr).

## Next action — locked sequence

1. **Merge PR #28** (cleanup-doc) once review passes — small, single-file docs change.
2. **Email verification banner** (the #1 task in flight, repeated here for sequence clarity). When fulfilling, move `needs-backend.md` entry from Pending → Complete with the implementation note + commit/PR reference.
3. **v1.3 PR-B — FR language rollout.** Coordinate with web on prompt authoring + eval-harness signoff before flipping the feature flag.
4. **v1.3 PR-C — Locale-aware RAG retrieval.** Web-side schema work first; mobile follows.
5. **v1.4+ — TBD.** Feedback channel deferrals: paywall entry point (after `react-native-iap` lands), admin list view, two-way reply inbox, GitHub Issues forwarder for `category=bug`, R2 migration for screenshots when volume justifies, server-authoritative `GET /api/mobile/feedback/count`, additional 426 enforcement on other endpoints case-by-case. Vision rerun gated on Vulkan upstream (weekly monitor `trig_01S6Yk7CnGzxVzo2J698aaCv` still running).

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
