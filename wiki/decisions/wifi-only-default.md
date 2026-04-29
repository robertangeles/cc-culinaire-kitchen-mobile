---
title: Wi-Fi-only default for the 6 GB model download
category: decision
created: 2026-04-29
updated: 2026-04-29
related: [[antoine]], [[background-download]], [[screens]]
---

The Antoine model download (6.3 GB total) defaults to Wi-Fi only. Cellular is opt-in behind a confirmation dialog. Decided in PR #5 after the user flagged data-cost risk.

## Decision

- `useModelStore.wifiOnly` defaults to `true` on first launch.
- Persisted in `expo-secure-store` as `"1"` / `"0"` under `STORAGE_KEYS.downloadWifiOnly`.
- Hydrated at app start in `app/_layout.tsx` alongside auth hydration.
- Native `BackgroundDownloadModule.startDownload` accepts `wifiOnly: boolean` and maps to `WorkManager`'s `NetworkType.UNMETERED` (true) vs `NetworkType.CONNECTED` (false).
- With `wifiOnly=true` on cellular, the WorkManager row stays QUEUED until Wi-Fi appears. Android shows it as "waiting for connection."

## UX surfaces

The toggle appears in TWO places — wherever a user can actively start a download:

1. **OnboardingScreen** — pre-download, first-launch flow. The choice point.
2. **SettingsScreen** — post-download, for re-downloads or changing the default later.

Both surface the same confirmation `Alert` when the user attempts to flip the toggle from Wi-Fi-only OFF to cellular-allowed:

> **Allow cellular downloads?**
> Antoine is about 6 GB. Downloading on cellular may use significant data and could be slow.
> [Cancel] [Allow cellular]

Switching back to Wi-Fi-only from cellular: no confirmation. The safer choice doesn't need a gate.

`DownloadingScreen` shows a **read-only "Wi-Fi only" / "Cellular allowed" badge** next to the percentage. No actionable toggle there, because the download is already queued — changing mid-flight requires Cancel → toggle → restart.

## Why Wi-Fi-only by default

- **Most users have limited cellular plans.** Surprising someone with 6 GB of cellular charges is a permanent trust break.
- **6 GB is genuinely a lot.** In many markets that's a meaningful chunk of a monthly plan.
- **The Wi-Fi-only path is well-tested.** WorkManager pauses cleanly until an unmetered network appears. No bespoke logic needed.
- **The default is the consent.** A toggle they have to flip + an Alert they have to confirm is far stronger consent than a vague "may use mobile data" line in TOS copy.

## Why two surfaces (Onboarding AND Settings), not one

Settings is only reachable AFTER a successful download (it's a tab in the post-download app shell). First-launch users can't get to Settings until Antoine is already on the device. So if the toggle were Settings-only, first-launch cellular users would have NO path to opt in — they'd be stuck waiting for Wi-Fi forever or never finishing the flow.

Hence: the toggle MUST exist somewhere in the pre-download flow. We chose OnboardingScreen because that's where the user is making the "download Antoine?" decision — the network policy is part of the same decision.

## Why no mid-download dialog

We considered detecting current network type (via `@react-native-community/netinfo`) and prompting "you're on cellular, continue?" mid-download. Rejected because:

- Adds a dependency for one decision.
- The toggle + Alert IS the consent. Showing a second confirmation when cellular kicks in is paternalistic.
- Mid-download network changes (Wi-Fi → cellular handoff in a moving car, e.g.) would trigger the prompt mid-byte-stream and feel like a bug.
- WorkManager already handles the "wifi only and you're on cellular" case gracefully (it pauses).

## Why the JS bridge owns `wifiOnly` (not the service reading the store directly)

`modelDownloadService.start()` accepts `wifiOnly` as a parameter rather than reading `useModelStore` directly. This keeps the dependency direction clean: `service ← hook ← store`. The service has no opinion on where the value comes from; tests can pass arbitrary values without mocking the store. The hook (`useModelDownload`) reads the store and passes it through.

## Tradeoffs

- **Pro:** Safe default protects users from data-cost surprise on first launch.
- **Pro:** Single decision point (Onboarding) covers first-launch; Settings covers re-downloads.
- **Pro:** Read-only badge on DownloadingScreen confirms what's active without inviting mid-flight changes.
- **Con:** Cellular users see ONE extra tap (the toggle) on Onboarding. Acceptable for a 6 GB decision.
- **Con:** Mid-download policy change requires Cancel → toggle → Restart. Edge case; documented.

## See also

- [[antoine]] — the 6 GB asset being downloaded
- [[background-download]] — the WorkManager constraint that enforces this
- [[screens]] — where the toggle lives
- [[auto-route-from-settings]] — companion decision shipped in same PR
- PR #5 (`feature/ck-mob/wifi-only-toggle`) — full implementation
