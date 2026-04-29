---
title: Expo Config Plugin pattern (for native code)
category: concept
created: 2026-04-29
updated: 2026-04-29
related: [[background-download]], [[antoine]]
---

The pattern for shipping custom native Android code in an Expo "managed with prebuild" project where the `android/` directory is gitignored. Used by `plugins/withBackgroundDownload/` and likely needed for any future native module work (e.g. `llama.rn` if it doesn't autolink cleanly).

## The problem

Expo's prebuild workflow regenerates `android/` from `app.config.ts` + plugins on:

- Fresh clones (no `android/` exists)
- `npx expo prebuild --clean`
- CI rebuilds
- Whenever someone runs `pnpm android` after a clean

Editing `android/` files directly works on your machine but evaporates on any of the above. So custom Kotlin sources, manifest entries, gradle deps, and `MainApplication.kt` package registrations must be **injected at prebuild time** by a config plugin.

## The shape of a plugin

A plugin is a JS function that receives the Expo config and returns it modified. `@expo/config-plugins` provides composable mods for each surface:

```javascript
const {
  withAndroidManifest, // edit AndroidManifest.xml
  withAppBuildGradle, // edit android/app/build.gradle
  withProjectBuildGradle, // edit android/build.gradle
  withGradleProperties, // edit android/gradle.properties
  withMainApplication, // edit MainApplication.kt
  withDangerousMod, // arbitrary fs operations (e.g., copy files)
} = require('@expo/config-plugins');
```

Each mod takes `(config, modifier)` where the modifier receives the parsed contents (XML object for manifest, raw string for gradle, etc.) and returns the mutated form.

Register the plugin in `app.config.ts`:

```typescript
plugins: [
  './plugins/withBackgroundDownload',
],
```

`expo prebuild` runs every plugin in order on every prebuild.

## Idempotency is mandatory

Plugins run on every prebuild. They MUST be safe to run multiple times. Typical strategies:

- **Marker comments** wrapping injected blocks (`// withBackgroundDownload deps — BEGIN` … `END`). Check before injecting; skip if marker already present.
- **`tools:replace`** attribute in manifest XML when overriding a library-declared element (e.g. WorkManager's `SystemForegroundService`). The manifest merger then knows to overwrite, not duplicate.
- **`copyFileSync` always overwrites** — so for source files (Kotlin), unconditional copy is fine.

If a plugin is NOT idempotent, the second prebuild produces duplicate dependencies, broken manifests, or merge conflicts. Test by running prebuild twice.

## How `withBackgroundDownload` does it

| Mod                      | What it does                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withDangerousMod`       | Copies all `.kt` files from `plugins/withBackgroundDownload/android/src/` into `android/app/src/main/java/<package>/download/`.                                                                     |
| `withAndroidManifest`    | Adds 5 permissions + injects a `<service>` override with `tools:replace="android:foregroundServiceType"` for WorkManager's `SystemForegroundService`.                                               |
| `withProjectBuildGradle` | Adds the KSP plugin classpath in the root `build.gradle` (anchored against `kotlin-gradle-plugin`).                                                                                                 |
| `withAppBuildGradle`     | Cleans up legacy kapt blocks (defensive — handles upgrade from kapt-era plugin), then injects KSP `apply plugin` line + Room/WorkManager/LiveData/OkHttp dep block, marker-wrapped for idempotency. |
| `withGradleProperties`   | Patches `org.gradle.jvmargs` to add `-Djava.io.tmpdir=...` (Windows fix — kapt/KSP workers inherit OS env, not daemon JVM args).                                                                    |
| `withMainApplication`    | Adds `add(BackgroundDownloadPackage())` to the package list. Anchors on the comment Expo's template ships with so it won't fight other plugins mutating that region.                                |

## Source-of-truth split

```
plugins/withBackgroundDownload/
  android/
    src/
      *.kt              ← source-of-truth Kotlin (edit here)
  index.js              ← the plugin itself
  README.md             ← human-readable plugin docs
```

Direct edits to `android/app/src/main/java/.../download/*.kt` get overwritten on next prebuild. Anyone working on the native code edits in the `plugins/` source tree.

## When to write a config plugin (vs autolink)

- **Library autolinks cleanly** (most modern RN modules): just `pnpm add <module>` and run `pnpm exec expo prebuild`. No plugin needed.
- **Library needs manifest perms/intent-filters**: usually ships its own plugin (the dependency does the work).
- **You're writing custom Kotlin/Swift native code**: write a config plugin.
- **You're patching a third-party library's manifest**: write a plugin (e.g. our `tools:replace` for WorkManager's service).
- **You need a dep that isn't autolinked** (Room, OkHttp, etc.): config plugin to add to gradle deps.

## Common pitfalls

- **Forgetting idempotency.** Second prebuild duplicates deps. Use markers.
- **Not registering the plugin in `app.config.ts`.** Files exist on disk, plugin never runs.
- **Editing `android/` directly during dev.** Survives until next prebuild, then disappears. Always edit in the plugin source tree.
- **Anchoring against text that other plugins also modify.** Use stable, library-shipped comments (e.g. Expo's "Packages that cannot be autolinked yet…").

## See also

- [[background-download]] — the concrete native module shipped via this pattern
- [[ksp-vs-kapt]] — a decision the plugin embodies
- `plugins/withBackgroundDownload/index.js` — the canonical example
- `plugins/withBackgroundDownload/README.md` — plugin-level docs
- Expo docs: https://docs.expo.dev/config-plugins/introduction/
