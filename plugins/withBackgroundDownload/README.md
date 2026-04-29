# withBackgroundDownload — Expo Config Plugin

Adds an Android-native background download manager (Kotlin + Room + WorkManager + OkHttp) to the project during `expo prebuild`. Survives `prebuild --clean` and fresh clones — fixes the gitignored `android/` problem that would otherwise eat custom Kotlin files on regen.

## Why this is a plugin and not committed `android/` files

The project follows Expo's "managed with prebuild" workflow: `android/` is in `.gitignore` and regenerated from `app.config.ts` + plugins. Editing `android/` directly works on your machine but disappears on:

- Fresh clone + `pnpm install`
- `npx expo prebuild --clean`
- CI rebuilds

This plugin solves that by injecting Kotlin sources, manifest permissions, gradle deps, and `MainApplication.kt` registration during every prebuild run.

## What it injects

1. **Kotlin source files** (8 files) → `android/app/src/main/java/com/anonymous/ccculinairekitchenmob/download/`
2. **AndroidManifest.xml permissions** (5):
   - `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`
   - `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`
3. **build.gradle dependencies** (4):
   - `androidx.room:room-runtime:2.8.2` + `room-ktx` + `room-compiler` (KSP)
   - `androidx.work:work-runtime-ktx:2.10.0`
   - `androidx.lifecycle:lifecycle-livedata-ktx:2.8.7`
   - `com.squareup.okhttp3:okhttp:4.12.0`
4. **KSP plugin registration** in `android/build.gradle` (classpath) and `android/app/build.gradle` (apply). KSP replaces kapt — kapt's worker JVM choked on Windows tmpdir resolution when sqlite-jdbc tried to extract a native DLL during Room's compile-time SQL verification.
5. **MainApplication.kt** — adds `BackgroundDownloadPackage()` to the package list

## Architecture (adapted from off-grid-mobile-ai)

Inspired by the MIT-licensed [alichherawalla/off-grid-mobile-ai](https://github.com/alichherawalla/off-grid-mobile-ai) project's Android download module. Patterns adapted, code rewritten for our specific needs (single allowlisted host, simpler API, our package layout).

```
JS:   modelDownloadService.start({onProgress, onDone, onError}) -> DownloadHandle
       |
       v
JS bridge: NativeModules.BackgroundDownloadModule
       |
       v
Kotlin:
  BackgroundDownloadModule.kt  - RN bridge, exposed methods
  BackgroundDownloadPackage.kt - package registration
  DownloadWorker.kt            - CoroutineWorker (WorkManager) does the byte streaming
  DownloadDatabase.kt + Dao    - Room persistence (survives app kill)
  DownloadEntity.kt            - one row per file in flight
  DownloadEventBridge.kt       - emits Progress/Complete/Error events to JS
  DownloadStatus.kt            - exception -> reason code mapping
```

## How to use this plugin

It auto-runs during `expo prebuild` once registered in `app.config.ts`:

```typescript
plugins: [
  // ...
  './plugins/withBackgroundDownload',
],
```

Then `pnpm android` (or any prebuild) will inject everything. No manual steps.

## Modifying the Kotlin code

The source-of-truth Kotlin files live in `plugins/withBackgroundDownload/android/src/`. Edit there. The plugin copies them on next prebuild. **Never edit `android/app/src/main/java/.../download/` directly** — those are generated copies and get overwritten.

## License

Plugin code: same license as parent project. Original architectural inspiration from off-grid-mobile-ai (MIT) — attribution preserved in the Kotlin file headers where relevant.
