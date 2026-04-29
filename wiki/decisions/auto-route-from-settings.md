---
title: Auto-route to DownloadingScreen whenever a download is active
category: decision
created: 2026-04-29
updated: 2026-04-29
related: [[screens]], [[wifi-only-default]]
---

When a download starts from `SettingsScreen`, the app automatically pushes the user to the dedicated `DownloadingScreen` route. Decided in PR #5 to collapse two divergent download UIs into one.

## Decision

`SettingsScreen` runs:

```typescript
useEffect(() => {
  if (state === 'downloading') {
    router.push('/(downloading)' as never);
  }
}, [state, router]);
```

Whenever the model store transitions into `'downloading'`, the user lands on the same DownloadingScreen they would have hit in the first-launch flow — with rotating culinary tips, the big BrandGlyph, weighted progress, and the read-only "Wi-Fi only" / "Cellular allowed" badge.

## Why

Before PR #5, downloads triggered from Settings showed a thin progress bar inline in the Settings card with no entertainment, no tips, and no obvious "Cancel" affordance. First-launch downloads got the polished DownloadingScreen. Same operation, two UIs.

The user noticed and explicitly asked: _"the entertainment needs to be in this panel too."_

Two ways to fix it:

**A) Duplicate the UI** — add tips, big glyph, etc. to the Settings inline progress card.

- Pro: User stays in Settings context.
- Con: Two progress UIs to maintain. Drift over time.

**B) Auto-route to DownloadingScreen** — wherever the download starts, the user lands on one canonical screen.

- Pro: One UI to maintain.
- Pro: First-launch and re-download flows feel identical.
- Pro: The network-policy badge (read-only) is in the right place — visible during the actual byte-flow.
- Con: Slight surprise for the user as the route pushes mid-tap. Mitigated by the `(downloading)` route being modal-style (no header, full-screen) — feels like the Download button "expanded" into a screen, not a navigation event.

We picked B.

## Implementation details

- **Routing primitive:** `router.push`, not `router.replace`. The Settings tab stays mounted underneath in the route stack.
- **Why push, not replace:** if `replace` were used, the Settings tab would unmount, triggering `useModelDownload`'s cleanup `useEffect` → `handleRef.current?.cancel()` → kill both download workers. That would be catastrophic mid-download.
- **Idempotency on remount:** when DownloadingScreen mounts, it auto-fires `useModelDownload().start()` via its `onMount` prop. The hook is idempotent — its `handleRef` is fresh per-instance, but the underlying `modelDownloadService.start()` calls `getActiveDownloads()` first and adopts in-flight downloads instead of starting duplicates. So the second `.start()` from DownloadingScreen is a no-op against existing workers.
- **Completion routing:** when both files complete, the DownloadingScreen's `onComplete` does `router.replace('/(tabs)/chat')`. That blows away the modal stack including SettingsScreen. By then, `handleRef.current` is already `null` (set in `onDone`), so the cleanup `useEffect` doesn't try to cancel anything.

## Tradeoffs

- **Pro:** Single source of truth for the download UI. Tips, network badge, progress bar, glyph — one component.
- **Pro:** Network-policy badge in the right place (visible during download, not buried in a Settings card).
- **Pro:** First-launch flow and re-download flow feel identical. Fewer surfaces to test.
- **Con:** Edge case — if a third surface ever needs to start a download (unlikely), it'd need its own auto-route too. Not worth abstracting for one user.
- **Con:** The push happens via `useEffect`, so there's a one-frame gap between "tap Download" and "screen pushes." Imperceptible in practice.

## What this enables

- The "Wi-Fi only" / "Cellular allowed" badge has exactly one home. It always reflects the policy that's actually in effect for the in-flight download.
- The rotating culinary tips (`COOKING_TIPS`) are the entertainment for ALL downloads, not just first-launch. Fewer dropoffs during 5-30 minute waits.
- Settings stays clean: the Antoine card shows status text and a "Download" or "Cancel" button, but never tries to be the progress UI.

## See also

- [[screens]] — the route graph
- [[wifi-only-default]] — companion decision; this is what enabled the read-only badge to live on DownloadingScreen instead of being duplicated
- [[antoine]] — the asset whose download triggers this
- PR #5 — full implementation
- `src/components/settings/SettingsScreen.tsx` — the `useEffect` that fires the route
- `app/(downloading)/index.tsx` — the destination
