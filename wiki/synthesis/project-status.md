---
title: Project status — what's shipped, what's next
category: synthesis
created: 2026-04-29
updated: 2026-04-29
related: [[antoine]], [[screens]], [[web-backend]], [[lessons]]
---

A human-readable snapshot of where CulinAIre Mobile is as of 2026-04-29. Derived from PRs merged on `main` and the open follow-up work in `tasks/todo.md`.

> **Source of truth for current TODOs:** `tasks/todo.md`. This page is the _narrative_ — what got done, why it matters, what's next.

## Shipped (merged to main)

| PR  | Title                                             | What it unlocked                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1  | Real auth via shared web backend                  | Sign in with email/password OR native Google Sign-In against `https://www.culinaire.kitchen`. Contract test suite to detect cross-repo drift.                                                                                                                                                |
| #2  | Chat composer Android keyboard fix                | `useAnimatedKeyboard` lifted to `ChatScreen` root with tab-bar-aware padding subtraction. No more keyboard flash/overlap on edge-to-edge.                                                                                                                                                    |
| #3  | First-launch flow redesign                        | Auto-trigger model download, dedicated `DownloadingScreen` with rotating culinary tips, `ChatGreeting` with rotating multilingual hello + first name.                                                                                                                                        |
| #4  | Real CDN model download                           | Native Android Kotlin background module (Room + WorkManager + OkHttp) packaged as Expo Config Plugin. 6.3 GB GGUF model lands on disk, survives backgrounding, resumes via HTTP 206, SHA-256 verified.                                                                                       |
| #5  | Wi-Fi/cellular toggle + unified DownloadingScreen | Default Wi-Fi-only with opt-in for cellular. Toggle + Alert in both Onboarding (pre-download) and Settings (post-download). Auto-route from Settings to DownloadingScreen so there's one download UX. Read-only network badge on the download screen. Safe-area fix for Android nav overlap. |

## Major architectural moves so far

- **On-device model.** Antoine downloads to private app storage and runs locally — no cloud round-trips during inference. (Inference still stubbed; download fully shipped.)
- **Native module via Config Plugin.** Custom Kotlin code lives at `plugins/withBackgroundDownload/` and is injected into `android/` on every prebuild. Required because `android/` is gitignored.
- **KSP over kapt.** Room's annotation processor uses KSP because kapt's worker JVM hits Windows tmpdir issues with sqlite-jdbc.
- **Privacy invariant intact.** Conversation content stays in `expo-sqlite` (Drizzle); only metadata will sync to backend in the future. No analytics SDK, no crash reporter that touches conversations.

## Next major milestone

**Real on-device inference via `llama.rn` — code-complete, awaiting device verification.** The stub at `src/services/inferenceService.ts` was replaced with real `llama.rn` calls. Token streaming is wired end-to-end through a transient Zustand slice (no per-token SQLite writes). System prompt injection, conversation history, error fallback, and privacy invariant all preserved. tsc + lint + 94 tests green.

What's left before this milestone is shipped:

- Device verification on the Moto G86 Power: cold-load time, steady-state RAM, multi-turn coherence.
- Open the PR.

Deferred follow-ups:

- Multimodal (image input via mmproj) — file lands on disk via the download service, but no UI surface yet.
- "Warming Antoine" UX for the multi-second cold load on first message.
- Token throttling — only if device measurement shows render thrash during streaming.
- Stop-generation button (cancel streaming mid-flight).
- Settings screen path-override UI (the SecureStore key is honored if set out-of-band).

See [[llama-rn-inference-params]] and [[streaming-architecture]] for the technical decisions.

## Other follow-ups (P1/P2/P3 from `tasks/todo.md`)

### P1 — Real auth & subscription

- ~~Wire real Google Sign-In~~ ✅ shipped (PR #1)
- Wire real Google Play Billing via `react-native-iap` (subscription gating)
- ~~Implement real model download against the CDN~~ ✅ shipped (PR #4)
- ~~First-launch flow redesign + entertainment screen during model download~~ ✅ shipped (PR #3)
- Integrate `llama.rn` and ship real `inferenceService` ← code-complete, awaiting device verification

### P2 — Backend sync, second screen, full E2E coverage

- Zero-knowledge encrypted backup (cross-device history)
- Backend `/api/conversations/sync` (metadata only)
- Recipe detail screen (chat action chip target)
- Detox E2E suite

### P3 — Polish

- EN/ES translation strings + `i18n-js` wiring
- Dark "service" mode for low-light kitchen use
- Tablet / kitchen-display layout
- Voice / push-to-talk via `expo-audio` + on-device STT

## Open questions / decisions deferred

- **iOS** — currently Android-only. iOS Swift module for background download is a separate PR. Inference may be easier (llama.rn supports iOS too) but device testing is harder without a Mac.
- **Multimodal** — Antoine's mmproj file is downloaded but no UI surfaces image input yet. Worth shipping in the inference PR or splitting?
- **Model versioning** — currently hardcoded URLs in `MODEL` config. Future: backend `GET /api/model/v1/manifest` so URLs can rotate without an app update.
- **Battery optimization request** — skipped in PR #4. Revisit if real-device testing shows backgrounded downloads getting killed.
- **Notifications during background download** — deferred. Foreground service notification is what's there now.

## See also

- [[antoine]] — what we're building
- [[screens]] — where the work surfaces
- [[web-backend]] — what the auth + future sync depends on
- [[lessons]] — battle scars from the work above
- `tasks/todo.md` — the prioritized roadmap
