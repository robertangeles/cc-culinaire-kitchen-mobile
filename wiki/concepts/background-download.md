---
title: Background download architecture
category: concept
created: 2026-04-29
updated: 2026-04-29
related: [[antoine]], [[expo-config-plugin]], [[ksp-vs-kapt]], [[wifi-only-default]]
---

The pattern shipped in PR #4 for downloading the 6.3 GB Antoine model in the background — survives app backgrounding, process kill, and intermittent connectivity. Built from off-grid-mobile-ai's pattern (MIT), adapted for our needs.

## The problem

Downloading a 6 GB file on a phone without losing your mind:

- User backgrounds the app mid-download → must keep going
- OS kills the app for memory pressure → must resume on next launch
- Connection drops → must resume from byte where it stopped
- File arrives corrupted → must verify and retry
- User force-stops the app → must NOT lose progress

A `setInterval` ticker (the v1 stub) fakes none of this. A `fetch` call inside JS dies when JS dies. Solution: native Android background service.

## The shape

```
JS layer (preserved contract):
  modelDownloadService.start({ onProgress, onDone, onError, wifiOnly })
    -> DownloadHandle{ cancel }
              |
              v
JS bridge: NativeModules.BackgroundDownloadModule
              |
              v
Kotlin layer:
  BackgroundDownloadModule.kt   <-- RN bridge
  BackgroundDownloadPackage.kt  <-- registers in MainApplication
  DownloadWorker.kt             <-- CoroutineWorker doing byte streaming
  DownloadDatabase.kt + DAO     <-- Room (survives process kill)
  DownloadEntity.kt             <-- one row per file in flight
  DownloadEventBridge.kt        <-- emits Progress/Complete/Error to JS
  DownloadStatus.kt             <-- exception → reason code mapping
```

All Kotlin source lives in the source tree at `plugins/withBackgroundDownload/android/src/`. An [[expo-config-plugin]] copies it into the gitignored `android/` on every prebuild.

## Why each piece exists

### WorkManager (`androidx.work:work-runtime-ktx`)

- Runs the worker in a foreground service so Android won't kill it for memory pressure.
- `setRequiredNetworkType(NetworkType.UNMETERED | CONNECTED)` lets the OS gate execution on network policy (see [[wifi-only-default]]).
- `enqueueUniqueWork(name, KEEP, request)` de-dupes — JS calling `startDownload` twice is safe; the second call returns the existing `downloadId`.
- Exponential backoff on transient failures (network blips, 5xx).

### Room (`androidx.room:room-*`)

- Persists one row per file in flight (`DownloadEntity`) in `ckm_downloads.db`.
- The row records `bytesDownloaded` so a process-killed app can resume from that exact byte on next start.
- LiveData observers exist for components that want lifecycle-aware observation.
- See [[ksp-vs-kapt]] for why we use KSP, not kapt, for Room's annotation processor.

### OkHttp (`com.squareup.okhttp3:okhttp`)

- HTTP client with proper timeout config (30s connect, 60s read/write).
- The Worker sends a `Range: bytes=N-` header when the file already exists locally; expects HTTP 206 in response. If the server returns 200 instead (no range support), the worker deletes the partial file and restarts — this is the safe fallback.
- Cloudflare R2 (the CDN we use) supports range requests; we verified with `curl -I` before shipping.

### LiveData (`androidx.lifecycle:lifecycle-livedata-ktx`)

- Adds Android-lifecycle-aware observers to the DAO. We don't use LiveData heavily on the JS side — events flow through `DownloadEventBridge` instead — but it's a Room peer dependency we declare explicitly to avoid version skew.

## Lifecycle of a single download

1. JS calls `startDownload({ url, fileName, modelId, subdirectory, totalBytes, sha256, wifiOnly })`.
2. Native generates a `downloadId` (UUID), inserts a Room row in QUEUED state, enqueues a unique WorkManager job tagged with that ID.
3. Worker spins up:
   - SSRF guard: refuses any URL whose host isn't in `ALLOWED_HOSTS` (currently only the R2 bucket).
   - Disk-space pre-flight: needs `totalBytes - existing + 64 MB` headroom or fails with `DISK_FULL`.
   - Promotes itself to a foreground service with a notification ("Downloading X — 23%").
   - Sends the HTTP request with optional `Range:` header.
   - Streams the body in 64 KB chunks; emits `DownloadProgress` events every 256 KB OR every 500 ms (whichever first).
   - On EOF: optional SHA-256 verify; mismatch deletes the file and surfaces `FILE_CORRUPTED`.
   - Updates Room state to `COMPLETED`, emits `DownloadComplete`.
4. Network exception → maps to a reason code (`NETWORK_LOST`, `NETWORK_TIMEOUT`, `DOWNLOAD_INTERRUPTED`) → `Result.retry()` so WorkManager re-runs after the network constraint is met.
5. 4xx HTTP → `Result.failure()` (won't retry; user error or stale URL). 5xx → `Result.retry()` (server transient).

## Lifecycle across app launches

JS-side `modelDownloadService.start()` always calls `getActiveDownloads()` first. If Room rows exist (a previous session was mid-download), the service:

- Reads `bytesDownloaded` for each row to seed weighted progress
- Adopts the in-flight `downloadId` instead of starting a new one
- Subscribes to events for those existing workers

Without this, a fresh JS layer would start a duplicate worker that the WorkManager de-dupe would refuse, leaving the progress bar stuck at 0.

## Privacy invariants this pattern preserves

- Only model file bytes flow through the worker — no conversation content.
- Host allowlist enforced at TWO layers (JS pre-flight + Kotlin SSRF guard) so a misconfigured backend can't trick us into downloading from an arbitrary host.
- All persistence is on-device (Room DB + private files dir). Nothing about the download leaves the device.

## Foreground service `<service>` override

The plugin injects a `<service>` element into the manifest with `android:foregroundServiceType="dataSync"` + `tools:replace`. WorkManager's library manifest doesn't declare this attribute, and Android 14+ throws `IllegalArgumentException` if `setForeground(... FOREGROUND_SERVICE_TYPE_DATA_SYNC)` is called against a service whose manifest type is 0. This crashed the first build of PR #4 — see git history for the fix commit.

## See also

- [[antoine]] — what's being downloaded
- [[expo-config-plugin]] — how the Kotlin lands in the build
- [[ksp-vs-kapt]] — annotation processor choice
- [[wifi-only-default]] — the network-policy default + UX
- [[project-status]] — current state of the download work
- `plugins/withBackgroundDownload/README.md` — plugin-level reference
- `plugins/withBackgroundDownload/android/src/` — Kotlin source of truth
