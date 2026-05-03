# Wiki session log

Append-only log of changes to the wiki. Newest entries on top.

---

## 2026-05-03 (late evening) — Infra cleanup landed: PR #25 (latent bugs) + PR #26 (CRLF parser fix + GitHub Actions CI)

Two infra PRs shipped tonight closed the operational backlog that had been quietly accumulating across the v1 → v1.2 product sprint.

### PR #25 (`03bc43e`) — latent bug cleanup

Two bugs flagged across recent sessions but never fixed.

**`apiClient` AbortSignal threading.** `ragService.retrieve()` was racing `apiClient.post` against a 3s `setTimeout` via `Promise.race` — when the timer won, the underlying fetch kept running, parsed the JSON, then discarded the result. Wasted CPU + radio time on every slow query. Fixed by adding `signal: AbortSignal` to `RequestOptions`, threading it through both the main fetch and the post-401 retry, and detecting `AbortError` in the catch block (re-throw as-is, don't wrap in `NetworkError`). `ragService.retrieve()` now uses an `AbortController`; `controller.abort()` on timeout actually cancels the fetch.

**`modelDownloadService` concurrent-start race.** Two `start()` calls in quick succession (e.g., from two `useModelDownload` consumers on different screens) would both race past `getActiveDownloads()` before either's `startDownload()` landed, both see "no active downloads", and both spawn duplicate native workers + Room rows. Fixed with a module-level `inflightBootstrap: Promise<void> | null` chain — each new `start()`'s read-then-spawn awaits the previous bootstrap before running, so the second caller's `getActiveDownloads()` sees the first's row and adopts via the existing in-flight-adoption path. Latest-wins clearing in `.finally`.

+5 unit tests (was 168/26, now 173/27). New `apiClient.test.ts` covers signal threading + AbortError propagation + the NetworkError-wrapping regression check; `ragService.test.ts` got the captured-signal-aborted assertion; `modelDownloadService.test.ts` got a concurrent-start test that resolves the two `getActiveDownloads()` calls in sequence and asserts `startDownload()` fires only once.

### PR #26 (`21f18a5`) — wiki CRLF parser fix + GitHub Actions CI

Two long-stalled infra PRs (#7 + #8 from 2026-04-29) consolidated into one fresh branch off main. Both originals had drifted past clean rebase — main had ~17 PRs merged into it since their merge-base — so the path was cherry-pick what's still surgical, drop what's stale.

**The CRLF parser fix is more than cosmetic.** Direct evidence the bug was live: after PR #25 merged earlier in the evening, the post-merge `wiki:graph build` dropped from 10 edges → 4 edges. With this fix, `pnpm wiki:graph build` reports 19 nodes / 64 edges / 2 broken refs (the 2 are the intentional `[[on-device-inference]]` forward-references from the original wiki bootstrap). Every pull on Windows had been silently breaking the graph by stripping all the `related:` edges; nobody noticed because `pnpm wiki:status` happily reports a wiki with zero relationships.

**The CI workflow ships `.github/workflows/ci.yml` with three gates** (lint / tsc / test) — Node 20 LTS, pnpm 10 pinned to match local dev, concurrency group, 15-minute timeout. Out of scope deliberately: contract tests (need creds), Android build (slow + JDK pain), iOS (Android-only), Detox (no E2E suite yet). Mirrors the local pre-push routine that CLAUDE.md was actually documenting (renamed misleading "CI Pipeline" header at some point future).

**CI caught a real bug on its very first run on this PR.** `react-native-markdown-display` had been added to local `node_modules` at some point during v1.2 work but never made it into `package.json` or `pnpm-lock.yaml`. Locally the `LegalPageScreen.tsx` import resolved fine; CI's first `pnpm install --frozen-lockfile` correctly installed only what's in the lockfile, then `pnpm lint`'s `import/no-unresolved` rule failed at line 24. Fixed in the same PR by adding the dep properly. This is exactly why CI mattered — the bug would have shipped to whoever next ran a clean install.

Also opted into Node 24 for JS-based actions ahead of GitHub's June 2nd, 2026 forced cutover (`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'`) — silences the deprecation warning emitted on every run by `actions/checkout@v4` + `actions/setup-node@v4` + `pnpm/action-setup@v4`, all of which still ship Node 20 internally.

**PR #7 + #8 closed as superseded** with comments documenting which commits were preserved verbatim and which were dropped. The `293461c` and `f1974c0` commits stay in the git history on those branches; only the wiki content edits + `useSegments()` cast + babel dep + CLAUDE.md edits were dropped (all were either stale or already addressed via other routes).

### What's next (per the now-updated `synthesis/in-flight.md`)

v1.3 — additional languages incrementally (FR placeholder waiting on human authoring + eval signoff before the picker exposes it) and locale-aware RAG retrieval (chunks tagged by language).

---

## 2026-05-03 (evening) — v1.2 closed: PR #23 (history UX) + v1.2 picker + PR #24 (legal pages, food-safety ack, language badge)

Three merges today landed in sequence and closed the v1.2 milestone end-to-end.

### PR #23 (`f1777b0`) — v1.1.5 history sheet UX

Three small but visible bugs from the v1.1 PR-B device-test pass cleaned up in one focused PR: snap-point opening at ~25-30% instead of 50% (Android nav-bar safe-area inset wasn't applied), no per-row delete (every row was a Pressable with only `onPick`), no clear-all action, and every conversation listing as "Untitled conversation". Fixed by applying `useSafeAreaInsets` to the sheet snap-points, adding a long-press menu with delete + a kebab-level "Clear all history" with confirm dialog, and auto-generating titles from the first user message at commit time. Indexed; no new wiki page (UX-fix, not pattern).

### `742a39d` — v1.2 picker checkpoint (direct push, not a PR)

Language picker UI with the partial-language banner UX (Option A from the eng review). `getActivePrompt(slug)` was parameterised; `apiClient` got the HTTP-status refactor with a typed `HttpError` for the 404-set logic; `ckm_conversation` got the per-conversation `language` column migration; `expo-localization` was re-added with the dev-client rebuild that v1.1 had deferred. Checkpointed on the branch rather than PR'd because the next layer (legal + food-safety) was about to land on top.

### PR #24 (`271fe97`) — v1.2 finale: legal pages + food-safety ack + language badge

The session that produced this PR is also the source of two new shared-context conventions worth recording.

**Legal pages.** New `(legal)` route group with dynamic `[slug].tsx`. `siteService` fetches `GET /api/site-pages/:slug?surface=mobile` and returns a tri-state resolution (`ok` / `unavailable` / `error`) so `LegalPageScreen` can render cache-first, swap on fresh fetch, and show a friendly placeholder with retry on 404. `LoginScreen`'s `<Trans>` slots route to `/(legal)/{terms|privacy}`. The `legal.*` i18n namespace landed in both `en.json` and `fr.json`, with the link label and screen title aligned to "Privacy Policy" / "Politique de confidentialité" to match the API's title field (the alternative — asking Robert to retitle the DB row to "Kitchen Privacy Notice" — got rejected; align mobile to web, not the other way around).

**RouteGuard fix — important.** First device test of the legal flow showed the link tap opening nothing. Root cause traced via Debugging Protocol: `RouteGuard` short-circuited any non-`(welcome|auth|onboarding)` segment with `router.replace('/(welcome)')` for unauthenticated users. Pushing to `/(legal)/terms` made segments[0] = `(legal)`, hit the unauth-bounce, screen never visibly mounted. Fixed with an early return for `(legal)` so the group is reachable in any auth state — semantically correct since ToS + Privacy MUST be readable pre-signup.

**Food-safety acknowledgement screen.** Required pre-launch per the disclaimer surfacing tracked in the previous in-flight section. New `(food-safety)` route group + `FoodSafetyAckScreen`. Per-session in-memory ack via `foodSafetyStore` (Zustand). `RouteGuard` requires the ack between email-verify and chat entry. Sign-out resets the per-session flag so the next sign-in re-prompts.

**Language badge in `ChatHeader`.** Small copper badge to the right of "Antoine" when the active language ≠ EN. EN users see no extra chrome (the 99% case); non-EN users get an at-a-glance signal of which language Antoine is responding in.

### Cross-project unblock — the 404 wasn't a publish-state issue

Mid-session diagnosis caught a contradiction: web admin showed both `terms` and `privacy` rows as LIVE, but `GET /api/site-pages/{slug}?surface=mobile` returned 404 for both. After delegating to an Explore subagent (and being correctly called out by Robert for skipping the shared-context check first), turned out the entire `/api/site-pages` route was sitting on an unpushed local branch on the web side. Web session pushed it as PR #14, merged, Render auto-deployed at ~16:53. All three endpoints returned 200 within minutes. Surface partition (`(slug, surface)` unique) was a real concern but not the actual cause — Robert's clicks had been on the right rows all along.

### SessionStart hooks for cross-project visibility

Added `.claude/hooks/web-needs-on-session-start.ps1` (mobile repo) and `.claude/hooks/mobile-needs-on-session-start.ps1` (web repo). Each surfaces the OTHER side's `*-needs.md` into the new session's context, but only when the file mtime has advanced past a sidecar timestamp at `$env:TEMP\culinaire-kitchen\*-needs-last-seen.txt`. Closes the cross-project visibility gap that bit us this session — the web Claude session updated `mobile-needs.md` to resolve the 404 mid-turn, and we only noticed because the harness reminded us. The hook means the next session sees it automatically. Pipe-tested both scripts standalone; SessionStart hooks fire outside the current turn so live-fire proof has to wait for the next session start.

### R2 cleanup

Both `antoine-v2-mmproj-bf16.gguf` (945 MB) and `antoine-v2-mmproj-q8_0.gguf` (560 MB) deleted from the bucket. Main `antoine-v2-q4_0.gguf` (5.19 GB) stays. No production code references either of the removed files; safe to drop.

### What's next (per the now-updated `synthesis/in-flight.md`)

Latent bug cleanup (apiClient AbortSignal threading + modelDownloadService duplicate-row race), then PR #7 + PR #8 triage (both still OPEN since 2026-04-29; deprioritised, not blocked), then v1.3 (additional languages incrementally + locale-aware RAG retrieval).

---

## 2026-05-03 — Device-screenshot procedure documented

Burned ~6 minutes of fumbling between PowerShell `>` redirection (mangles PNG bytes via UTF-16 string conversion) and Git Bash `MSYS_NO_PATHCONV` interactions (rewrites `/sdcard/...` to `C:/Program Files/Git/sdcard/...`). Captured the working PowerShell one-liner and the three failure modes in [concepts/device-screenshots.md](concepts/device-screenshots.md) so the next session goes straight to `adb shell screencap` + `adb pull` from PowerShell. Indexed.

---

## 2026-05-03 — v1.x i18n roadmap (CEO + Eng review) and v1.1 PR-A merged

Big architecture day. Nothing visibly changed in the app, but the foundation for everything from v1.1 through v1.3+ got laid down and shipped.

### Pre-coding work — two reviews back-to-back

After yesterday's v1 text-only ship (`3da4492`) closed the vision investigation, today's session opened with the question: what's v1.1? The CEO review explored alternatives (STT via whisper.cpp, recipe scaling tool, conversation export) before holding the locked direction (i18n). Then expanded the scope: device-locale auto-detect, authored-not-auto-translated prompts (web admin owns translations), per-conversation language override, locale-aware RAG retrieval (v1.3+), automated quality eval harness gating each language at v1.2.

The Eng review layered 7 implementation decisions on top:

- **D1** Slug naming uses dash separator (`antoine-system-prompt-fr`), not colon. URL-safe, conforms to `[a-z0-9-]+`.
- **D2** Boot effect with i18next defaulting to EN, layered upgrade via store hydrate. Defensive against future expo-localization API changes.
- **D3** `promptCacheService` refactor for v1.2 — parameterize `getActivePrompt(slug)`, add explicit 404-set tracking distinct from network-error fallback.
- **D4** Mobile picker uses a feature flag (web-side endpoint) to gate per-language visibility — decouples mobile + web release cadences.
- **D5** Hierarchical-namespaced translation keys (`auth.signIn`, not `"Sign in"`). Stable identifiers; English text in `locales/en.json`.
- **D6** `useI18nStore` (Zustand) is single source of truth; SecureStore + i18next are downstream side effects.
- **D7** Automated eval harness from v1.2 (not manual-first). Lives on the web side; mobile is a downstream consumer via D4's feature flag.

13 decisions total (CEO-1..6 + Eng-D1..D7). All logged in the cross-project `decisions.md`.

### PR #21 — v1.1 PR-A i18n infrastructure (`dde991d`)

Foundation layer. JS-only. Zero visible UI change. 9 files, +489 lines.

- **`src/i18n/index.ts`** — i18next initialised synchronously at module load with the EN resource bundle. `applyDeviceLocaleIfStoreEmpty()` boot helper hydrates the store from SecureStore and syncs i18next.
- **`src/store/i18nStore.ts`** — Zustand store as the single source of truth. `setLanguage()` fans out to SecureStore + `i18n.changeLanguage()` as side effects. `hydrate()` reads SecureStore at boot, returns whether a persisted language was found.
- **`src/locales/en.json`** — empty namespace skeleton with the canonical six top-levels (`auth`, `chat`, `settings`, `errors`, `actions`, `chef`).
- **`docs/i18n-conventions.md`** — hierarchical-namespaced key convention, variable interpolation with `{{}}`, plural rules, forbidden patterns (no concatenation, no conditional t() calls, no inline JSX). Spec for PR-B's mechanical extraction.
- **`src/__tests__/unit/i18nStore.test.ts`** — 7 unit tests covering hydrate (4 cases including SecureStore corruption + unsupported value defenses) + setLanguage (3 cases including no-op early return + unsupported guard).
- **`src/constants/config.ts`** — adds `STORAGE_KEYS.language: 'ckm_language'`.
- **`app/_layout.tsx`** — wires `applyDeviceLocaleIfStoreEmpty` into the existing boot effect chain.
- **`package.json` + `pnpm-lock.yaml`** — adds `i18next` + `react-i18next`. Crucially does NOT add `expo-localization`; see below.

Pre-flight green: tsc clean, lint clean, **157/157 tests pass** (was 150 — added 7). Device-verified on Moto G86 Power: app boots normally, no errors in logcat, kebab menu unchanged, chat sends/receives normally, no visible difference from v1.

### Gotcha worth recording: `expo-localization` deferred to v1.2

Originally part of PR-A. Pulled mid-test when Metro started throwing `UnableToResolveError` on a fresh dev-client launch. Root cause: `expo-localization` is a native module that needs the dev client rebuilt (`pnpm android`) to link the native bindings — a `pnpm add` alone isn't enough. The error compounded with a stale Metro module-graph cache that wasn't seeing the freshly-installed JS-only deps either; `pnpm start:fresh` (which passes `--clear` to Metro) fixed the cache half.

Pragmatic call: `expo-localization` adds zero value to v1.1 anyway — with only `'en'` in `SUPPORTED_LANGUAGES`, the device-locale auto-detect path is already a no-op (any non-EN device locale fails the supported-check). Defer the dep + the device-locale auto-detect to v1.2, where we'd be rebuilding the dev client anyway for the picker UI native changes. v1.1's boot effect is hydrate-only (read SecureStore → sync i18next).

This means the Eng review's D2 decision (boot effect with device-locale read) is honored _partially_ in v1.1 — the boot-effect pattern + i18next-EN-default are wired; the device-locale call is deferred. Documented in the PR-A docstring at the top of `src/i18n/index.ts`.

### Cross-project doc updates

`../cc-culinaire-shared-context/mobile-needs.md` got four new entries (all 2026-05-03):

- **Per-language Antoine system prompts** — slug naming convention, 404 semantics, authored-not-translated rule, eval gate
- **Per-language feature-flag endpoint** — `GET /api/mobile/feature-flags` shape, caching expectations
- **i18n quality eval harness** — fixture set, LLM-judge rubric, pass/fail gate, lives on the web side
- **apiClient HTTP status exposure** — informational note about mobile-side refactor for v1.2

`../cc-culinaire-shared-context/decisions.md` got two new entries:

- **v1 ships text-only; vision removed end-to-end** — context for yesterday's PR #20 ship
- **i18n roadmap (CEO + Eng review consolidated)** — captures all 13 decisions in one place for the web-side reader

### Side cleanup

- Deleted two local-only legal-doc handoff briefs (`tasks/privacy-policy-context.md`, `tasks/terms-of-service-context.md`) after they were used to generate the briefs handed to a different Claude. `.gitignore` reverted to its post-v1 state.

---

## 2026-05-01 (late afternoon) — Lite branding + post-auth flash fix (PR #14 squash-merge `f143b49`) and streaming-bubble verb rotation (PR #13 squash-merge `190bc64`)

Two visual / UX polish PRs landed back-to-back this afternoon.

### PR #13 — streaming-bubble verb rotation (`190bc64`)

Pre-token wait on cold-prefill turns is ~30–80s on the Moto G86 Power. The streaming bubble previously showed a static "Antoine is …" subtitle then went silent until tokens landed — easy to read as stuck. New `src/constants/culinaryVerbs.ts` lists 84 culinary verbs in `-ing` form (sentence case, kitchen-grounded, Caveat-script-free since that font is reserved for "Kitchen"). Inline `useRotatingCulinaryVerb` hook in `ChatList` rotates verbs every 2.2s during the pre-token streaming wait, never repeating back-to-back. Hook is inert when not waiting. 5 unit tests lock in list invariants (count ≥ 78, no duplicates, all -ing form, sentence case, length-bounded). Verified on device — verbs visibly cycle during the ~35s warm-boot turn 1.

### PR #14 — Lite branding + post-auth flash fix (`f143b49`)

Differentiates this build from the future Full fork. Two related changes that surfaced together:

1. **Lite branding.** `app.config.ts` `name` → `CulinAIre Kitchen Lite` (flows into `strings.xml` `app_name` on prebuild). New `src/components/ui/LiteBadge.tsx` — small uppercase "LITE" pill, copper hairline outline + copper Inter SemiBold, letter-spaced, scales against the parent mark. Used in both `Wordmark` (typographic mark) and `BrandGlyph` (PNG lockup). On `BrandGlyph`, auto-suppressed for tiny compact icons (chat header 28px, carousel paginators 36px) via the `withLiteBadge ?? (!compact && size >= 80)` heuristic. Accessibility label flips from "CulinAIre Kitchen" to "CulinAIre Kitchen Lite" when the badge is shown so screen-reader users still get variant info.

2. **Post-auth flash fix** (drive-by, surfaced while verifying #1). `app/(auth)/login.tsx` was hard-coded to `router.replace('/(onboarding)')` after auth — even when the model was already on disk. Returning users saw a one-render-cycle flash of the onboarding screen before bouncing to chat. Fixed in two layers: login.tsx reads `useModelStore.getState().isActive` synchronously and routes directly to `/(tabs)/chat` when true; `RouteGuard` in `app/_layout.tsx` subscribes to `isActive` as a backstop that bounces from `(onboarding)` → `(tabs)/chat` if the value flips true after the user landed there (covers the rare race where `hydratePrefs` hasn't completed at `onAuthed` time). Plus a `[login] onAuthed → isActive=… target=…` breadcrumb log in the same shape as the existing `[boot]` / `[modelStore]` / `[kvSession]` lines.

Tests: 2 new BrandGlyph tests (badge omitted on tiny compact icons; badge shown by default on hero-size lockup). Wordmark + BrandGlyph snapshots refreshed. 151 tests / 25 suites total.

### Branch protection on main

Applied via `gh api PUT repos/.../branches/main/protection` — `enforce_admins=true`, `required_linear_history=true`, `allow_force_pushes=false`, `allow_deletions=false`. `required_pull_request_reviews=null` so the "small docs commits to main directly" pattern from CLAUDE.md still works. Status checks deferred until PR #8 (CI workflow) lands.

### What's next

Run `pnpm android` locally to rebuild the dev client APK so the home-screen icon label updates from `cc-culinaire-kitchen-mob` to `CulinAIre Kitchen Lite`. JS hot reload doesn't pick up `app.config.ts` `name` changes — that's a native-strings.xml regeneration. Otherwise, the in-flight Next-Action #1 stays at "wait for the weekly Vulkan monitor to fire green".

---

## 2026-05-01 (afternoon) — Vulkan GPU offload investigated, parked

Quick post-PR-12 follow-up. After bagging the saveSession win, investigated the next-action #1 on the in-flight list: Vulkan GPU offload retry on Q4_0.

1. **Probed the local llama.rn 0.12.0-rc.5 binary** — `find -iname "*vulkan*"` returned zero. The most-feature-rich prebuilt variant (`librnllama_v8_2_dotprod_i8mm_hexagon_opencl.so`, 9.3 MB) contains OpenCL kernel code (`#pragma OPENCL EXTENSION cl_khr_fp16`, `clCreateKernel`) and Hexagon DSP code (`HAP_debug_runtime`) but no Vulkan strings. The OpenCL+Hexagon variant only loads on Qualcomm devices via runtime detection — on the Mediatek Dimensity 7300 in our test phone, the runtime falls back to a CPU-only variant.

2. **Checked upstream releases** — `pnpm view llama.rn` shows latest is `0.12.0-rc.9` (4 RCs newer than our pin). Release notes for rc.6–rc.9 contain only llama.cpp upstream syncs and bug fixes — no mentions of Vulkan, GPU, n_gpu_layers, Mali, or Adreno.

3. **Conclusion: Vulkan path blocked on the npm-published prebuilt.** Source-build path requires fixing the Python 3.14 / CMake 3.22 issue from yesterday's branch. Three forward paths surfaced: (A) source-build with Vulkan (high effort, brittle, Mali driver quality unknown), (B) park + recurring monitor (cheap), (C) pivot to speculative decoding (v3 lever).

4. **Decision: Path B.** Cancelled the previously-scheduled one-shot agent (`trig_01S6Yk7CnGzxVzo2J698aaCv`) and converted it to a weekly recurring check (Mon 09:00 AEST = Sun 23:00 UTC, cron `0 23 * * 0`). The agent's brief is now: be quiet when nothing has changed; only do detailed binary inspection if `latest` is newer than 0.12.0-rc.9.

5. **Cross-project decisions log updated.** Added 2026-05-01 entry to `../cc-culinaire-shared-context/decisions.md` so the web/backend session sees the same decision rationale.

6. **Wiki rotated.** in-flight.md: removed Vulkan from next-actions #1, replaced with "wait for the weekly monitor to fire green"; updated open-questions block to reflect the verified absence rather than the prior speculation.

**Status:** Nothing actionable on inference perf this week. CPU path stays primary. Streaming-bubble micro-animation polish is the next free-hour task; speculative decoding remains gated on real user feedback about decode latency.

---

## 2026-05-01 (mid-day) — KV-state persistence shipped (PR #12 squash-merge `1e90499`)

Full-day session focused on the `saveSession`/`loadSession` spec from yesterday's plan. Merged.

1. **`kvSessionService` shipped.** New `src/services/kvSessionService.ts` saves the system-prompt slice of llama.cpp's KV cache after the first turn of each JS lifetime and restores it via `loadSession()` on next launch. Five independent invalidation triggers — prompt hash, llama.rn version, runtime fingerprint, corrupt-file fallback, `tokens_loaded` mismatch. SHA-256 hashing via newly added `expo-crypto`.

2. **Orphan-prune helper.** Device verification surfaced that file paths keyed by hash prefix would leak ~10–13 MB to disk per system-prompt edit. Added a follow-up that runs after each save, lists `kv-state/`, and deletes any files whose prefix doesn't match the current one. Best-effort, runs only AFTER the new file is on disk.

3. **inferenceService refactor (small).** Lifted `cachedContext` and `ensureContext` from `useAntoine.ts` so the boot effect and chat hook share one cached context. Exported `INFERENCE_RUNTIME` (single source of truth for `n_ctx`/`n_batch`/`cache_type_*`/`n_threads`) and `LLAMA_RN_VERSION` (read at runtime from `llama.rn/package.json` so the sidecar version field is authoritative and never drifts).

4. **Boot effect.** New useEffect in `app/_layout.tsx` after `isPrefsHydrated && isActive`: pre-warms `ensureContext()` + restores saved KV via `loadSystemPromptKV(ctx, await getActivePrompt())`. All best-effort. Also fixed a pre-existing tsc error: `useSegments()` cast to `string[]` for the verify-email path's `segments[1]` access under `noUncheckedIndexedAccess`.

5. **End-to-end device verification on Moto G86 Power.** 5 scenarios, all green. Cross-version sweep tracked the saved-token slice exactly as system prompt grew + shrank: v6 (395 tok / 44.7s cold prefill) → v7 (434) → v8 (475) → v9 (329, after a 17.5s cold-prefill win from trimming). Warm-boot turn 1 cut by 9.3s (loaded slice skipped). Turn 2 multi-turn still hits 1.5–2s prefill via PR #11's RAG cache + this PR's KV state cleanly composing. Orphan prune verified: disk dropped 23.9 MB → 13.6 MB → 11.0 MB across two prune cycles.

6. **Tests.** 16 unit tests for `kvSessionService` (all five invalidation paths + save round-trip + dir-creation-on-missing + disk-full graceful + zero-token tokenize + prune behaviour + session flag). 3 integration tests in `useAntoine.streaming.test.tsx` (turn 1 fires save, turn 2 doesn't, warm-boot pre-set flag skips). 144 tests / 24 suites green pre-push.

7. **Wiki updates.** [privacy-invariant](concepts/privacy-invariant.md) — `files/kv-state/*` added to the on-device audit list. [llama-rn-inference-params](decisions/llama-rn-inference-params.md) — new "KV session persistence" subsection covering when save/load fires, the five invalidation triggers, and the privacy boundary.

8. **Mid-session diagnostics.** Hit Windows Defender file-lock during `pnpm add expo-crypto` (resolved by adding project dir to Defender exclusions). Hit gradle wrapper "JAVA_HOME not set" (resolved by exporting `JAVA_HOME='/c/Program Files/Android/Android Studio/jbr'`). Hit `Cannot find native module 'ExpoCrypto'` on first device launch (resolved by rebuilding dev client APK to bundle the new native module).

**Status:** `main` is at `1e90499`. Next-action #1 is the Vulkan GPU offload retry on Q4_0 — ~30 min to confirm whether the prebuilt JNI ships the backend; if yes, ship behind a feature flag with CPU fallback. Speculative decoding parked for v3 based on real user feedback.

---

## 2026-05-01 (AM) — Inference tuning branch landed on main (PR #11 squash-merge `5be7079`)

Short session focused on closing out yesterday's inference-tuning work.

1. **PR #11 opened, PR #10 closed, PR #11 squash-merged.** All 7 commits from `feature/ck-mob/inference-tuning` (Antoine V2 Q4_0 weights + n_ctx=2048, four-stage inference param sweep, RAG-cache-per-conversation fix, wiki + spec updates) collapsed into one commit on `main`: `5be7079 Tune Antoine V2 inference: Q4_0 weights, RAG cache for multi-turn prefix reuse (#11)`. PR #10 closed as superseded — its single commit (`e8a3633`) is included in #11.

2. **In-flight notes corrected.** Yesterday's note claimed "PR #10 merged"; in reality it was open and `feature/ck-mob/inference-tuning` was stacked on top of it. Caught at session start by checking `git log main..feature/ck-mob/inference-tuning` (7 commits, not 4) and `gh pr list` (PR #10 still OPEN). Fix shipped in this session's merge.

3. **Pre-flight green.** `pnpm lint` clean, `pnpm tsc --noEmit` clean, `pnpm test` 125 / 23 suites passing.

4. **In-flight rotated.** "Open + merge PR" task removed (done). Next-action #1 is now `saveSession`/`loadSession` for system-prompt KV state — half-day work, spec at [docs/specs/kv-prefix-cache-via-parallel-state.md](../docs/specs/kv-prefix-cache-via-parallel-state.md). Backlog item added: PRs #7 (wiki CRLF parser fix) and #8 (CI workflow) still open, unrelated to inference.

**Status:** `main` is at `5be7079`, working tree clean, branches deleted on origin. Conversational multi-turn shipped + verified. Cold-launch turn-1 prefill (~75–80s) is the next target.

---

## 2026-04-30 (PM) — RAG + dynamic system prompt shipped (code-complete, tests green)

After mainline-quantized GGUF cleared the model file blocker and Antoine was confirmed loading + generating tokens on device, today's session wired the two services that turn "generic small model running locally" into "private culinary librarian + chef":

1. **`src/services/promptCacheService.ts`** — fetches `GET /api/mobile/prompts/antoine-system-prompt` on boot, caches `{ body, version, cachedAt }` in SecureStore, version-compares before writing. Falls back to baked-in `ANTOINE_SYSTEM_PROMPT` when cache + network both miss. Decision recorded at [server-managed-prompts](decisions/server-managed-prompts.md).

2. **`src/services/ragService.ts`** — wraps `POST /api/mobile/rag/retrieve` (web commit `8a72295`). 3-second hard timeout via `Promise.race`. Returns `[]` on every failure mode (network error, ApiError, NetworkError, malformed response, timeout). Citation-aware `formatRagContext()` produces the system message Antoine sees, numbered `[1]`, `[2]`, ... so it can cite. Architecture documented at [rag-architecture](concepts/rag-architecture.md).

3. **`useAntoine.send()` rewritten.** Three-stage streaming bubble: `retrieving` → `warming` → `streaming`. Parallel `getActivePrompt()` + `retrieve()` before `ensureContext()`. Sources footer (`---\nSources:\n[1] ...`) appended on commit when chunks were retrieved.

4. **Privacy invariant refined.** [privacy-invariant.md](concepts/privacy-invariant.md) rewritten 2026-04-30 to specify the new boundary: model responses, multi-turn history, image attachments stay; only the current query crosses for RAG retrieval. The web's privacy doctrine (query never persisted, server logs `userId/latency/chunkCount/searchMode/limit/category` only) is documented end-to-end.

5. **Streaming-bubble UX.** `ChatList` renders the virtual bubble whenever `streamingStage !== null`, surfacing "Antoine is consulting your library…" / "Antoine is warming up…" subtitles per the user's earlier feedback about silent gaps.

6. **Keyboard dismiss fix.** `ChatScreen` now uses explicit `Keyboard.addListener` + `withTiming` instead of `useAnimatedKeyboard` (Android 14+ edge-to-edge bug where `height` stuck after dismissal).

7. **Tests.** 13 unit (`promptCacheService`), 11 unit (`ragService`), 7 integration (`useAntoine.streaming` rewrite covering RAG-block injection, Sources footer, RAG-empty graceful degradation, inference error fallback, model-not-active short-circuit). 122 tests total, all green; tsc + lint clean.

8. **Cross-project shared dir.** Path corrected to `../cc-culinaire-shared-context/`. `model-config.md` (mobile-owned) now reflects the gemma4 + 0.12.0-rc.5 + `no_extra_bufts: true` runtime config.

9. **Wiki updates.** New: [rag-architecture](concepts/rag-architecture.md), [server-managed-prompts](decisions/server-managed-prompts.md). Updated: [privacy-invariant](concepts/privacy-invariant.md), [antoine](entities/antoine.md) (Knowledge sources), [in-flight](synthesis/in-flight.md), [index](index.md).

**Status:** Code-complete, 122 tests green. Awaiting commit + on-device verification of the full RAG path (consultation subtitle → tokens → Sources footer with real `[1]` citations from the corpus).

---

## 2026-04-30 — Device verification: integration works, model file doesn't

Spent the session getting the llama.rn integration onto the Moto G86 Power. Hit four real bugs in the Android stack and one hard wall in the model file.

**Bugs fixed (uncommitted; all on `feature/ck-mob/llama-rn-integration`):**

1. **`useModelDownload.ts`** — removed unmount-cancel cleanup. The effect was firing on every screen unmount including the success path (download → setReady → routes to chat → DownloadingScreen unmounts), racing the worker's SHA-256 verification and getting completed downloads marked `user_cancelled` with their files deleted. The download module was designed to survive screen unmounts; the cleanup was a bug.

2. **`modelStore.ts hydratePrefs()`** — added a boot-time `verifyModelFiles()` check that flips `isActive=true` when the .gguf files are on disk. Previously `isActive` was in-memory only and reset to `false` on every app restart, so the chat screen always showed the "download Antoine" CTA even when the 6 GB model was right there.

3. **`modelLocator.ts verifyModelFiles()`** — wraps paths with `file://` URI scheme. `expo-file-system.getInfoAsync()` requires a URI-style path, not a bare filesystem path. Without this, the boot-time check silently returned `{exists: false}` even when the files were present, defeating fix #2.

4. **`inferenceService.ts`** — added `toggleNativeLog(true)` + `addNativeLogListener` so llama.cpp's stderr surfaces in logcat as `[llama.rn:error]` lines. This was the unlock that exposed the actual model load failure chain. Without this, all errors collapsed to the generic `RNLlama: unable to load model`.

Also created `scripts/patch-gguf-arch.py` — Python helper using `gguf-py` to rewrite GGUF metadata in place. Renames a non-standard `general.architecture` value and `gemma4.*` keys to standard `gemma3n.*`. Useful diagnostic; cannot add missing tensors.

**The wall:** The Antoine GGUF on the R2 bucket was quantized by Unsloth with `general.architecture = "gemma4"` (non-standard) and is **structurally missing tensors** that mainline llama.cpp's `gemma3n` loader requires (`altup_proj.weight` and the rest of the altup sublayer). Renaming metadata got us past the architecture and tokenizer checks, but the missing tensors are not recoverable through a metadata patch — the data isn't there. Verified via `gguf-py`: zero altup tensors in the file.

**Resolution requires action outside Claude:** Re-quantize the fine-tuned safetensors using mainline `llama.cpp`'s `convert_hf_to_gguf.py` + `llama-quantize`. Procedure documented at [model-quantization-must-be-mainline](decisions/model-quantization-must-be-mainline.md). The resulting file will have `general.architecture = "gemma3n"` and the full tensor inventory llama.cpp expects. No app code changes needed — just URL + SHA-256 in `src/constants/config.ts`.

**Diagnostic infrastructure that paid off:**

- `toggleNativeLog(true)` — without it we saw "unable to load model" four times across hours and never knew why. With it, the third attempt surfaced the architecture name, the fourth surfaced the tokenizer string, the fifth surfaced the missing-tensor name. Each error had a clear next step.
- `gguf-py`-based metadata + tensor inspection on the host — let us prove the missing-tensor hypothesis without further on-device round-trips.
- `adb logcat` filter on `RNLlama|llama|ggml` tags — narrow signal, no noise.

**Wiki changes:**

- Updated: `synthesis/in-flight.md` — status is now "blocked on model file" not "code-complete awaiting device verification". Lists the four uncommitted hotfixes + the next-session prerequisites.
- New: `decisions/model-quantization-must-be-mainline.md` — full diagnostic chain + re-quantization procedure + future-proofing recommendations (architecture sanity-check in CI).
- Updated: `index.md` — new decision page registered.

**What this session does NOT include:**

- Inference actually working. Antoine cannot answer questions yet. Code path is verified end-to-end up to tensor allocation; below that is the model file.
- A merged PR. The four hotfixes need to land on top of the integration commit before merge.

---

## 2026-04-29 — llama.rn integration (code path) — Antoine speaks for real

**What shipped (locally; awaiting device verification before PR).**

Replaced the 96-line stub at `src/services/inferenceService.ts` with a real `llama.rn` integration. Public API preserved: `initLlama`, `completion`, `releaseAllLlama`, `buildMessageArray`, `__forceError` — but `completion` now accepts an optional `onToken` callback that streams tokens as the model produces them. Stop tokens (`<end_of_turn>`, `<|end_of_turn|>`, `<eos>`, `</s>`, `<|endoftext|>`) are filtered out of the streaming callback so they never leak into rendered text.

New file: `src/services/modelLocator.ts` — resolves the absolute GGUF path from `BackgroundDownloadModule.getDocumentDirectory()` with a SecureStore override key (`STORAGE_KEYS.modelDir`) for a future settings reconfig UI. Includes `verifyModelFiles()` that uses `expo-file-system/legacy` to confirm both files (main + mmproj) are on disk.

Streaming slice added to `useConversationStore`: `streamingConversationId` + `streamingText` state, `startStreaming` / `appendStreamingToken` / `commitStreaming` / `clearStreaming` actions. Transient Zustand state — never written to SQLite per token. The completed reply commits as a single `INSERT` once the model finishes.

`useAntoine.send()` now calls `getMainModelPath()` instead of the hard-coded `'antoine.gguf'`, and wraps the inference call with `startStreaming → completion(ctx, params, onToken) → commitStreaming`. Error path goes through `clearStreaming + addMessage(fallback)`.

`ChatList` subscribes to `streamingText` and `streamingConversationId`, renders a virtual in-progress bubble (id `__streaming__`) at the bottom of the list when streaming targets the active conversation. The committed assistant bubble swaps in seamlessly when streaming ends.

New config plugin: `plugins/withLlamaRn` adds the `-keep class com.rnllama.** { *; }` ProGuard rule to `android/app/proguard-rules.pro` idempotently across prebuilds. Required for release builds (R8 minification would strip llama.rn's native classes otherwise).

Tests rewritten + added:

- `src/__tests__/unit/inferenceService.test.ts` — rewritten against `llama.rn/jest/mock`. 8 assertions: init returns wrapped context, init force-error throws, completion returns mocked text + tokensUsed, streaming callback fires per token, completion forwards messages with system prompt at index 0, completion force-error throws, releaseAllLlama resolves, buildMessageArray prepends Antoine's system prompt.
- `src/__tests__/unit/modelLocator.test.ts` — 6 assertions: native fallback, SecureStore override, mmproj path, verifyModelFiles ok, verifyModelFiles missing, error when neither override nor native module is available.
- `src/__tests__/unit/conversationStore.streaming.test.ts` — 5 assertions on the streaming slice.
- `src/__tests__/integration/useAntoine.streaming.test.tsx` — 3 assertions on the end-to-end flow including error and pre-model-active fallback paths.

Test infrastructure updates in `jest.setup.ts`: mock `expo-sqlite` (so `db/client.ts` can be imported without crashing on `openDatabaseSync`); `require('llama.rn/jest/mock')`; `beforeAll` installs the JSI globals and overrides `llamaGetFormattedChat` so the JS-side "Prompt is required" guard passes when only `messages` is sent.

Privacy audit: `grep -rEn "fetch|axios|http|XMLHttpRequest|WebSocket" src/services/inferenceService.ts` returns zero matches (re-worded the docstring so even the comment doesn't trip the audit).

**Wiki updates.**

- New: `wiki/decisions/llama-rn-inference-params.md` — n_ctx=2048, n_predict=1024, temperature=0.7, top_p=0.9, n_threads=4, stop tokens, with reasoning for each. Notes follow-ups: bump n_ctx after measuring RSS on device; try GPU offload if tokens/sec is low; add repeat_penalty if responses loop.
- New: `wiki/concepts/streaming-architecture.md` — the transient Zustand slice + virtual ChatList bubble pattern, why no per-token SQLite writes, why no token throttling yet, race-condition handling for navigate-mid-stream and parallel sends.
- Updated: `wiki/entities/antoine.md` — lifecycle step 4 now describes the real inference flow, with crosslinks to the two new pages.
- Updated: `wiki/synthesis/in-flight.md` — moved llama.rn (code path) to "Last completed", set "Currently in flight" to device verification, listed concrete next-session steps.
- Updated: `wiki/synthesis/project-status.md` — milestone status now reads "code-complete, awaiting device verification" with the deferred-followups list.
- Updated: `wiki/index.md` — added the two new pages.

**What's NOT done.** Device verification on the Moto G86 Power. `pnpm android` will trigger the `expo prebuild` + native rebuild. First build is long (llama.rn ships ~150 MB of native libs across arm64-v8a + x86_64). After that, send a real culinary question and watch Antoine type the reply.

---

## 2026-04-29 — Added `wiki/synthesis/in-flight.md` for cross-session continuity

**Problem.** Each new Claude session starts fresh. The TodoWrite list (the most precise picture of "where we are") evaporates at session end. Without a deliberate breadcrumb, the next Claude has to infer the next action from `project-status.md` + `tasks/todo.md` + recent git log — and might guess wrong.

**Fix.** Created `wiki/synthesis/in-flight.md` — a deliberately short, fast-changing page with three sections: Last completed / Currently in flight / Next action. Updated at session end, read at session start.

**CLAUDE.md updated** to mandate the read order:

1. Read `wiki/synthesis/in-flight.md` FIRST (the breadcrumb)
2. Read `wiki/index.md` (the catalog)

And the write order at session end:

1. Update `wiki/synthesis/in-flight.md` (move completed → last completed; update next action)
2. Append to `wiki/log.md` (long-form record)

**`wiki/index.md` updated** to feature `in-flight.md` at the top under "▶ Current focus" so it's hard to miss even if a future Claude skips the CLAUDE.md instruction.

**Why a separate page, not a section in `project-status.md`:** different update cadences. project-status is slow-changing narrative ("PRs shipped, milestones"); in-flight is fast-changing pulse ("paused mid-X, branch foo, next step bar"). Separating them avoids edit conflicts and keeps each page right-sized for its job.

---

## 2026-04-29 — Four automations on top of the wiki tooling

**What was added:**

1. **Pre-commit health check** — `.husky/pre-commit` runs `node scripts/wiki-status.mjs` after `lint-staged`. Non-blocking; prints `wiki: 12 pages, 1 broken` so it's visible every commit without aborting flow. Broken refs are often intentional forward-references and shouldn't fail the commit.

2. **Status line script** — `scripts/wiki-status.mjs` (`pnpm wiki:status`). Prints one-line summary. Auto-rebuilds the graph if any wiki .md is newer than the cached graph, so the number is always live. Documented in `CLAUDE.md` for wiring into Claude Code's status line via `.claude/settings.json`. Not auto-installed in user settings (didn't want to mutate global Claude Code config without explicit permission).

3. **Post-merge graph rebuild** — `.husky/post-merge` runs `node scripts/wiki-graph.mjs build` after every `git pull` / `git merge`. Keeps `wiki/.graph.json` fresh when pulling teammate's wiki edits.

4. **`/wiki-audit` slash command** — `.claude/commands/wiki-audit.md`. Type `/wiki-audit` in any Claude session to rebuild graph, print stats/broken/orphans, and get a synthesized report classifying each issue (intentional forward-reference vs. real bug) with a proposed next action. Doesn't auto-fix.

**`pnpm wiki:status`** added to package.json scripts.

**`CLAUDE.md` updated** with the "Automations" subsection under "LLM Wiki" → "Wiki tooling".

**Status quo for "automatic" vs "manual":**

| Action                                | Automated                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Read `wiki/index.md` at session start | Behavioral instruction in CLAUDE.md (not enforced)                                                            |
| Search before reading                 | Manual (`pnpm wiki:search`)                                                                                   |
| Watch `raw/`                          | Long-running (`pnpm wiki:watch` while you want it on)                                                         |
| Ingest dropped raw file               | Manual — watcher prints suggested command, user pastes into Claude                                            |
| Update `log.md` at session end        | Behavioral instruction in CLAUDE.md                                                                           |
| Rebuild graph after wiki edits        | **Automatic** on `git merge`/`pull` (post-merge hook) AND on every status-script call (auto-rebuild if stale) |
| Surface broken refs / orphans         | **Automatic** on every commit (pre-commit hook)                                                               |
| Audit + classify issues               | On-demand via `/wiki-audit`                                                                                   |

The big shift from the previous setup: stale graph + silent broken refs are now nearly impossible. Whatever drift creeps in surfaces in your terminal on the next commit.

---

## 2026-04-29 — Wiki tooling (Levels 2/3/4) + caught a real broken reference

**What was done.** Built the three-level wiki tooling per the user's recipe:

- `scripts/wiki-search.mjs` — git-grep-backed search with frontmatter awareness. Returns title + category + summary + path for matches. Supports `--limit` and `--category` filters.
  - **Note:** the user's recipe suggested `npm install -g qmd`. That package on npm (`qmd@0.0.0`) turned out to be a placeholder with no real functionality. Replaced with our own script using `git grep` (always present, fast, no extra deps).
- `scripts/wiki-watch.mjs` — chokidar-backed long-running watcher on `raw/`. Prints the suggested `claude "ingest ..."` command when a new file appears. Doesn't auto-invoke Claude.
- `scripts/wiki-graph.mjs` — JSON-backed graph store. Parses `related: [[...]]` edges, persists to `wiki/.graph.json` (gitignored), supports: build, stats, links-to, links-from, neighbours, path (BFS), orphans, broken.
  - **Note:** the user's recipe suggested SQLite. Pivoted to JSON because (a) `better-sqlite3` needs Visual Studio Build Tools on Windows for native compile, multi-GB install for our 12-page wiki, (b) JSON is faster + smaller + zero-dep at our scale, (c) the script's API can stay identical when we eventually swap the persistence layer.

**Dependencies added** (devDependencies in `package.json`):

- `chokidar ^5.0.0` — file watcher
- `gray-matter ^4.0.3` — kept around in case we want strict YAML elsewhere; the wiki scripts use a forgiving inline parser instead because gray-matter's YAML-strict mode chokes on `[[wiki-link]]` syntax in `related:` (looks like a YAML flow sequence)

**Pnpm scripts added:**

- `pnpm wiki:search "query" [--category foo] [--limit N]`
- `pnpm wiki:watch`
- `pnpm wiki:graph <subcommand>`

**Real bug caught by the graph:** `wiki/entities/antoine.md` references `[[on-device-inference]]` which doesn't exist yet (TBD page for the upcoming llama.rn work). Surfaced by `pnpm wiki:graph broken`. Intentional forward-reference; will resolve when the page is created during the inference PR. The watcher will keep flagging it until then — that's the point.

**`CLAUDE.md` updated** with a "Wiki tooling" section under "LLM Wiki", documenting all three levels and the order to escalate (start with the index, escalate to search at ~30 pages, watcher whenever raw/ is in active use, graph for any cross-cutting analysis or forward-reference cleanup).

---

## 2026-04-29 — Backfill: 3 concept pages + 3 decision pages, replaced docs originals with redirects

**Concept pages created (3):**

- `wiki/concepts/background-download.md` — WorkManager + Room + OkHttp pattern from PR #4
- `wiki/concepts/expo-config-plugin.md` — the pattern for shipping custom native code via prebuild
- `wiki/concepts/privacy-invariant.md` — the non-negotiable rule + how each enforcement point upholds it

**Decision pages created (3):**

- `wiki/decisions/ksp-vs-kapt.md` — why Room uses KSP (Windows tmpdir issue with kapt's sqlite-jdbc)
- `wiki/decisions/wifi-only-default.md` — why 6 GB download defaults to Wi-Fi-only, surfaces, mid-flight policy
- `wiki/decisions/auto-route-from-settings.md` — why Settings pushes to DownloadingScreen (single canonical UI)

**Originals replaced with redirects:**

- `docs/architecture/screens.md` → redirect to `wiki/entities/screens.md`
- `docs/architecture/web-backend-api.md` → redirect to `raw/web-backend-api.md`
- `docs/design/design-system.md` → redirect to `wiki/entities/design-system.md`

The full prose lives in git history if anyone needs it. The redirect files are short pointers so anyone who navigates to the old paths (or follows a stale link) lands in the right place.

**`tasks/` files unchanged** — `tasks/todo.md` and `tasks/lessons.md` remain as-is. The wiki has synthesis pages pointing to them as sources of truth.

**`wiki/index.md` updated** to list the 6 new pages.

**Wiki shape now:**

```
wiki/
  index.md
  log.md
  entities/    (4 pages: antoine, screens, design-system, web-backend)
  concepts/    (3 pages: background-download, expo-config-plugin, privacy-invariant)
  decisions/   (3 pages: ksp-vs-kapt, wifi-only-default, auto-route-from-settings)
  synthesis/   (2 pages: project-status, lessons)
raw/
  web-backend-api.md
```

12 wiki pages + 1 raw file.

**Next session.** When tackling `llama.rn` integration, create:

- `wiki/concepts/on-device-inference.md` (the pattern: model load, context management, streaming)
- `wiki/decisions/llama-rn-integration.md` (the choices: Expo plugin vs autolink, multimodal scope, context window)
- New entries in `tasks/lessons.md` for any non-obvious gotchas
- Append summary to `wiki/log.md`

---

## 2026-04-29 — Wiki initialised from existing markdown files

**What was done.** Bootstrapped `wiki/` and `raw/` from the 7 markdown files already in the repo. No source files deleted; new wiki pages created alongside originals.

**Pages created (6):**

- `wiki/index.md` — master catalog
- `wiki/log.md` — this file
- `wiki/entities/antoine.md` — the on-device AI persona (synthesised from `CLAUDE.md`, `README.md`, `src/constants/config.ts`, `src/constants/antoine.ts`; gap-filled because no single file documented Antoine end-to-end)
- `wiki/entities/screens.md` — navigable summary of `docs/architecture/screens.md`
- `wiki/entities/design-system.md` — navigable summary of `docs/design/design-system.md`
- `wiki/entities/web-backend.md` — synthesised pointer to `raw/web-backend-api.md` plus the cross-repo discipline rules from `tasks/lessons.md`
- `wiki/synthesis/project-status.md` — narrative snapshot of PRs #1–#5 + what's next, derived from `tasks/todo.md`
- `wiki/synthesis/lessons.md` — categorized index into the 31 entries in `tasks/lessons.md`

**Raw files placed (1):**

- `raw/web-backend-api.md` — copied (not moved) from `docs/architecture/web-backend-api.md`. The file explicitly states "source files (in the web repo) win when they conflict" — a perfect fit for the `raw/` immutable-source rule.

**Originals preserved.** All 7 source files still in their original locations:

- `CLAUDE.md`, `README.md` (root) — these are the project's operating constitution + public-facing description; they STAY in place. CLAUDE.md will be updated to reference the wiki (Step 6, next).
- `docs/architecture/screens.md`, `docs/architecture/web-backend-api.md`, `docs/design/design-system.md` — left for now; per-instructions, no deletion without confirmation.
- `tasks/todo.md`, `tasks/lessons.md` — these are working-state files (TODO list + Problem/Fix/Rule log). They STAY in `tasks/` and the wiki points to them as sources of truth.

**Gaps + questions identified:**

- **No `wiki/concepts/` pages yet.** Likely candidates from existing knowledge: "Background download architecture (WorkManager + Room + range resume)", "Privacy invariant enforcement", "Cross-repo drift detection (the contract test pattern)", "Expo Config Plugin pattern for native code". Worth creating ad-hoc when working in those areas.
- **No `wiki/decisions/` pages yet.** Strong candidates from PRs #4 + #5: "Why KSP over kapt", "Why the toggle on Onboarding AND Settings", "Why JS-side multi-file orchestration instead of native". Could be backfilled from PR descriptions if the user wants a complete decisions log.
- **`tasks/lessons.md` has duplicates.** Two `jest-expo` entries on the same day. Worth consolidating during a future cleanup pass.
- **`prompts/` and `docs/specs/` are empty directories.** Skipped per user instruction. The Antoine system prompt actually lives in `src/constants/antoine.ts`, not in `prompts/` — worth revisiting whether `prompts/` should exist at all.

**Next session.** When working on the next major milestone (`llama.rn` integration), create:

- `wiki/concepts/on-device-inference.md` (the pattern)
- `wiki/decisions/llama-rn-integration.md` (the choices made)
- Append a `wiki/log.md` entry summarising
