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

**v1.3 launch in flight — Closed Testing release submitted to Google Play (2026-05-05).** Production AAB build `28e99d30` (versionCode 1, versionName 1.3.0) uploaded to the Closed Testing track under `com.culinairekitchen.mobile.lite` on `@robangeles`'s personal Play Console account. Submission cleared the Foreground Service declaration (YouTube Unlisted demo video URL) + Data Safety + Content Rating + Target Audience + Ads declaration + App Category + Privacy URL + Account-deletion URL. Now in Google's automated quick-check phase (~13 min) followed by human review (1–7 days). Personal-account 14-day Closed-Testing rule applies — Production unlock requires ≥12 opted-in testers running for ≥14 days; currently 6 testers on the email list.

**v1.3 PR-A merged earlier as PR #27 (`db21c61`).** In-app feedback / bug submission feature shipped + device-verified end-to-end on the Moto G86 Power (anon submission from Login → 201 from prod → email landed in `ran@robertangeles.com` via the async Resend forwarder). Web side fulfilled the same day (commit `2a307de`): `POST /api/mobile/feedback` deployed, `ckm_feedback` table created.

**v1.2 closed.** PR #24 (`271fe97`) merged + device-verified: language picker, legal pages, food-safety ack, copper non-EN badge.

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

## Last completed (today, 2026-05-05)

- **Play Store Closed Testing submission shipped end-to-end.** Production AAB `28e99d30` (versionCode 1, versionName 1.3.0) uploaded to the Closed Testing track on the new package `com.culinairekitchen.mobile.lite`. Sent for review at ~21:00 AEST. All Play Console gates cleared in one session — App shell, Store listing copy (short + full description, en-AU default), Closed Testing track (177 countries + 6 testers + `mailto:ran@robertangeles.com` feedback), Content Rating questionnaire, Target Audience (18+), Ads declaration (No), App Category (Productivity), Privacy URL (`https://www.culinaire.kitchen/privacy`), Account-deletion URL (`https://www.culinaire.kitchen/delete-account`), Data Safety questionnaire, Foreground Service declaration with YouTube Unlisted demo video for `FOREGROUND_SERVICE_DATA_SYNC` → "Network processing → Other". Now in Google's 13-min auto-check + 1–7 day human review.
- **Launch infrastructure landed on `main`.** Two commits pushed (`6d38849` wiki on-device-inference stub + `1cd263e` launch-prep). `app.config.ts` android.package set to production namespace `com.culinairekitchen.mobile.lite` (immutable post-upload). `eas.json` created with development/preview/production profiles + Play Console `submit` config targeting Internal track. Expo project linked: `@robangeles/cc-culinaire-kitchen-mob` projectId `6ea7758d-8e4b-4e7f-bb91-583c75deb0e9`. EAS env var `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` populated for both `preview` and `production` environments (verified via `eas env:list`). EAS keystore SHA-1 `FA:B6:F2:7F:BF:5F:69:E0:F1:C8:39:C6:5D:79:1D:FF:7D:73:1A:81` registered against the Android OAuth client `136084112637-a3hr26kr2rgd0k54nbin4qjtj2o2ir3v...` in Google Cloud Console (replacing the old `com.anonymous.*` package + dev keystore SHA-1). OAuth consent screen published from Testing → Production after stripping all `http://localhost:*` URLs from the Web client + replacing `http://culinaire.kitchen/...` with `https://www.culinaire.kitchen/...` redirect URI.
- **Three preview APK + production AAB build cycles.** First preview (`62ce8027`) burned with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` empty (env-var create silently failed; verification step skipped). Second preview (`72ff1524`) built with the env var landed but Google Sign-In still failed because new SHA-1 wasn't registered. Third preview (`6bf11071`) green end-to-end — env var present + SHA-1 + package name aligned, Google Sign-In confirmed working on device. Production AAB (`28e99d30`) used same green configuration.
- **Server-managed prompt persona-drift fix shipped via web admin.** Antoine was answering off-topic Python/coding requests under mixed-content prompts. Web admin published a strengthened prompt with refusal-pattern few-shot examples; mobile app picked up the new version on next cold launch (`promptCacheService` does version-keyed cache invalidation). Verified working on device. Behaviour now over-conservative — refuses entire mixed requests rather than answering food + redirecting non-food. Kept conservative for MVP launch (D1 below).
- **First-turn UX copy added** (commit `1cd263e`) — `foodSafety.bullet5` ("First reply takes a moment.") on the I-Understand screen explains why first inference is slow (model reads full system, KV cache cold). Updated `chat.warming` subtitle to lead with the same one-liner so reason surfaces in-the-moment too. Both en + fr.
- **Account-deletion page contract delivered to web team via shared-context `mobile-needs.md`.** Web session shipped the SPA route `/delete-account` with surface-override to mobile authoring; verified live at `https://www.culinaire.kitchen/delete-account` (with browser-style `Accept: text/html` header — Express SPA fallback gates on Accept). Earlier follow-up note retracted as a testing-methodology bug, not a real issue.
- **`docs/play-store-launch-runbook.md` written end-to-end.** 600+ lines, captures every Phase 0 pre-flight item (package name, EAS init quirks, env-var verification, keystore + SHA-1, OAuth registration, OAuth consent screen, Privacy/Terms/Delete-account URLs with the SPA Accept-header gotcha) through Phase 5 Production submission. Common-landmines table covers every error message we hit today with root cause + fix. Reusable command reference + URL bookmarks. Goal: next launch consults this top-down on day 1; runbook is now the proactive checklist instead of a reactive post-mortem.

## Currently in flight

**Closed Testing release pending Google review.** AAB `28e99d30` submitted ~21:00 AEST 2026-05-05. Auto-checks (~13 min) running first, then human review (1–7 days typical for Closed Testing). No further mobile-side action required to advance the review itself. Watch Play Console → Publishing Overview for any flagged issues from auto-checks.

**Backlog while review runs (none blocking each other):**

1. **Recruit 6+ more Google-account testers** for Closed Testing email list (currently 6, need 12+ before applying for Production access). Strict Google-account constraint — Play Console rejects Outlook/Yahoo/non-Workspace custom-domain emails with red ⚠️.
2. **14-day Closed Testing clock** (personal-account rule for Production unlock). Clock starts when first tester actually opts in via Play Store, not when the email lands on the list. Production access application earliest ~2026-05-19 if testers opt in promptly.
3. **Email verification banner** — `cc-culinaire-shared-context/needs-backend.md` open ask from 2026-05-03. Persistent banner / modal when `user.emailVerified === false`, "Resend verification email" button calling `POST /auth/resend-verification` (200 / 429 rate-limited). Independent scope, ~2-3h. The only cross-project ask still open from earlier.
4. **v1.3 PR-B — FR language rollout.** Placeholder slug `antoine-system-prompt-fr` already wired on the web side; needs human-authored prompt + culinary-reviewer signoff + eval-harness pass before the picker exposes FR via the feature flag. Mobile-side work: locale bundle completeness audit + tests + PR.
5. **v1.3 PR-C — Locale-aware RAG.** Chunks tagged by language; retrieval honours the active conversation language. Web-side schema work needed first — coordinate with web before mobile starts.

Two test-plan items still deferred from PR #27 (inventory only, not blocking): cross-account leak guard live verification (needs a 2nd test account); 429 cooldown UX (would require 11 submissions in <1hr).

## Next action — locked sequence

1. **Watch Publishing Overview for auto-check flags** (~13 min after submission, then nothing to do until Google's human review verdict 1–7 days later). If flagged: read the message, fix the named gate (likely a missing declaration), re-submit.
2. **Recruit testers to ≥12 Google accounts** while Google reviews. Filter for Gmail / Google Workspace upfront — non-Google emails are rejected at form-save with red ⚠️.
3. **Once review approves the Closed Testing release**, send the opt-in URL to recruited testers; the 14-day Production-eligibility clock starts when the first tester actually opts in.
4. **Apply for Production access** at the 14-day mark with ≥12 opted-in testers + clean Vitals.
5. **Email verification banner** — only mobile cross-project ask still pending from earlier. Independent scope, ~2-3h.
6. **v1.3 PR-B — FR language rollout** — coordinate with web on prompt authoring + eval-harness signoff before flipping the feature flag.
7. **v1.3 PR-C — Locale-aware RAG retrieval** — web-side schema work first; mobile follows.
8. **v1.4+ — TBD.**
   - **Persona refusal tuning** — current few-shot block (post 2026-05-05 web-admin update) makes Antoine refuse the entire turn when user mixes food + non-food (e.g. "stir-fry recipe but first write a Python script" → refused both). Conservative shipping behaviour for MVP launch; the prompt's stated rule is "answer the food portion, redirect the rest" so this is a tuning regression to revisit once real-user data shows whether strict reads as broken or as brand-tight. No rebuild needed — server-managed prompt iteration.
   - **EAS auto-upload of R8/ProGuard mapping files.** Today's production AAB shipped without a mapping file (informational warning, not blocking). Crash stack traces in Play Vitals will show obfuscated names until this is wired. Needs the Play Console service account JSON for `eas submit` first; then `eas.json` config to upload mappings on every production build. Do BEFORE Production submission so Day-1 crashes are debuggable.
   - **In-app "Re-download model" / "Reset model storage" Settings option.** Today's Foreground Service demo video required wiping app data via `adb shell pm clear` to trigger a fresh model download for recording. An in-app affordance would have made the recording painless. Bonus: gives users a recovery path if the on-device GGUF gets corrupted.
   - **Separate DEV OAuth client for local web Google Sign-In dev.** Production OAuth consent screen now requires HTTPS-only redirect URIs, so we can't have `http://localhost:*` entries on the prod client. Future web devs working on Google Sign-In locally need a parallel dev OAuth client (same Google Cloud project, separate Web Client ID, localhost URLs allowed in Testing-mode consent screen). ~30 min one-time + small backend env-var change.
   - **Feedback channel deferrals from PR #27:** paywall entry point (after `react-native-iap` lands), admin list view, two-way reply inbox, GitHub Issues forwarder for `category=bug`, R2 migration for screenshots when volume justifies, server-authoritative `GET /api/mobile/feedback/count`, additional 426 enforcement on other endpoints case-by-case.
   - **Vision rerun** gated on Vulkan upstream (weekly monitor `trig_01S6Yk7CnGzxVzo2J698aaCv` still running).

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
