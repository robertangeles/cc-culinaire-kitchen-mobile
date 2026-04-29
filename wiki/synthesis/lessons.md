---
title: Lessons learned — categorized index
category: synthesis
created: 2026-04-29
updated: 2026-04-29
related: [[project-status]], [[web-backend]], [[screens]]
---

A categorized index into the 31 lessons captured at `tasks/lessons.md`. The full content lives in that file; this page is a navigable map so future sessions can find a specific lesson without scrolling 1078 lines.

> **Source of truth:** `tasks/lessons.md`. When you add a new lesson, append it there AND update the relevant category below.

## Categories

### Cross-repo (shared backend with cc-culinaire-kitchen)

Foundational facts about the relationship between this mobile repo and the web repo. Read these before any auth / backend integration.

- 2026-04-27 — Web app already shipped Stage 1 of mobile backend prep (commit afecf95)
- 2026-04-27 — Web backend's actual endpoint paths and response shapes (the source of truth)
- 2026-04-27 — Mobile backend integration is mostly client-side wiring; ONE new endpoint needed
- 2026-04-27 — Web app monorepo layout (cc-culinaire-kitchen)
- 2026-04-28 — Module-level `process.env` reads in web authService capture undefined (init-order bug)
- 2026-04-28 — Web backend uses DB-backed credentials (hydrated to process.env at startup)
- 2026-04-28 — Inspecting the live web DB from a Node script (for diagnostics)
- 2026-04-27 — Always inspect the backend before designing mobile auth (or any client-server integration)
- 2026-04-28 — Cross-repo drift detection (Phase 1.5)
- 2026-04-28 — `https://culinaire.kitchen` apex strips Bearer auth on GETs (use `www`)
- 2026-04-28 — Settled on Render `www` host as canonical; lessons compounded

### React Native / Expo specifics

- 2026-04-27 — Reanimated worklets need `Easing` from `react-native-reanimated`, not `react-native`
- 2026-04-27 — Drizzle Expo SQLite migrations need `babel-plugin-inline-import` AND `metro.config.js` sourceExts
- 2026-04-27 — Metro caches stale Babel transforms across `babel.config.js` edits
- 2026-04-27 — `expo run:android` is the right script for projects with config plugins; `expo start --android` falls back to Expo Go
- 2026-04-27 — Custom bottom sheet vs `@gorhom/bottom-sheet`
- 2026-04-27 — Drizzle migrations need `.sql` in Metro sourceExts
- 2026-04-27 — RN's `text-transform: uppercase` doesn't change the underlying string
- 2026-04-27 — `expo-sqlite` web target needs `wa-sqlite.wasm` polyfill not bundled by default
- 2026-04-28 — Adding `elevation` on TextInput focus tears down the Android IME session
- 2026-04-28 — Zustand selectors that return new array/object literals cause infinite re-renders
- 2026-04-28 — `app.config.ts` `extra` block is BAKED INTO THE APK at build time, NOT served live by Metro

### Windows + Android dev environment

- 2026-04-27 — Windows env vars don't propagate to running PowerShell sessions
- 2026-04-27 — Two-PowerShell-window workflow for React Native dev
- 2026-04-27 — `adb reverse` resets on USB disconnect / phone reboot
- 2026-04-28 — `&&` and `||` have different precedence in cmd.exe vs bash
- 2026-04-28 — Mobile cleanup + watchdog infrastructure (the durable fix for "nothing happens" hangs)

### Tooling / testing

- 2026-04-27 — `jest-expo` major version must match installed Expo SDK major
- 2026-04-27 — `jest-expo` major version must match installed Expo SDK (duplicate from above — consolidate when revisiting)

### Design discipline

- 2026-04-27 — CLAUDE.md design section was speculative; user iterated on a real design that contradicted it (CLAUDE.md updated, design system became authoritative)

### Recurring lesson — debugging discipline

These aren't all in `lessons.md` as separate entries but emerged across PR #4 + PR #5: **always follow the Debugging Protocol from CLAUDE.md § 9.** Confirmed → Evidence → Root cause → Fix → Verify. No "try this then that" guess-fixes. The user has explicitly enforced this twice.

## How to use this page

1. Looking for a fix for a specific symptom? Search `tasks/lessons.md` directly — entries follow Problem / Fix / Rule format.
2. Onboarding to a new area (auth, RN, Windows dev)? Read the relevant category here first, then drill into entries.
3. Encountering a problem that "feels familiar"? Skim this page — chances are someone already solved it.

## See also

- [[project-status]] — what's shipped + what's next
- [[web-backend]] — deeper context for the cross-repo lessons
- `tasks/lessons.md` — full text of every lesson
- `CLAUDE.md` § "Self-Improvement Loop" — when to add new lessons
