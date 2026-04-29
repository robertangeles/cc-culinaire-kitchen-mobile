---
title: KSP over kapt for Room annotation processing
category: decision
created: 2026-04-29
updated: 2026-04-29
related: [[background-download]], [[expo-config-plugin]]
---

We use KSP (Kotlin Symbol Processing) — not kapt — to process Room's annotations on the Android side. Decided during PR #4 after kapt failed catastrophically on a Windows host.

## Decision

The config plugin at `plugins/withBackgroundDownload/index.js` injects:

- The KSP Gradle plugin classpath (`com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin:2.1.20-2.0.1`) into the root `android/build.gradle`
- `apply plugin: "com.google.devtools.ksp"` into `android/app/build.gradle`
- `ksp("androidx.room:room-compiler:2.8.2")` (NOT `kapt(...)`) in the `dependencies { ... }` block

KSP version MUST match the Kotlin version exactly. The suffix `-2.0.1` is the KSP API revision against Kotlin 2.1.20. Bump both together when upgrading.

## Why not kapt (the symptom)

PR #4's first build attempt failed with:

```
Execution failed for task ':app:kaptDebugKotlin'.
> java.nio.file.AccessDeniedException:
    C:\Windows\sqlite-3.41.2.2-...-sqlitejdbc.dll.lck
```

Stack trace pointed at `org.sqlite.SQLiteJDBCLoader.extractAndLoadLibraryFile`. Room's compile-time SQL verifier uses sqlite-jdbc to validate `@Query` strings. sqlite-jdbc extracts a native DLL to `java.io.tmpdir` on first use. On Windows, when Gradle is launched from a bash shell that doesn't propagate `TEMP`/`TMP` env vars properly, the kapt worker JVM's `java.io.tmpdir` resolves to `C:\Windows\` — which non-admin users can't write to. The DLL extraction fails, kapt crashes.

## Why not "fix the tmpdir" (rejected workaround)

Several attempts were made before switching to KSP:

1. **Set `org.gradle.jvmargs=-Djava.io.tmpdir=...` in `gradle.properties`** — affects the Gradle daemon, but kapt workers spawn a separate JVM that inherits OS env, not daemon JVM args.
2. **Export `TEMP`/`TMP`/`TMPDIR` in the bash invocation** — they get translated through shell layers and don't reach the kapt worker JVM intact.
3. **`JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=...`** — picked up by the Gradle launcher JVM (confirmed via "Picked up JAVA_TOOL_OPTIONS" log) but NOT by the kapt worker. The worker process spawned by the Kotlin Gradle plugin doesn't inherit it.

These workarounds either failed outright or were brittle (depend on shell, OS, JVM env layering). Even the ones that _might_ work would burden every developer on Windows with environment plumbing.

## Why KSP works

KSP doesn't use `sqlite-jdbc` for Room's annotation processing — it operates on Kotlin's symbol table directly without invoking the same `DatabaseVerifier` code path that triggers DLL extraction. The Windows tmpdir problem disappears.

Bonus: KSP is faster than kapt (no Java stub generation step), and it's the AndroidX-recommended Room processor going forward. kapt is in maintenance mode.

## Tradeoffs

- **Pro:** No Windows tmpdir issues. Faster builds. Future-proof (kapt is being deprecated).
- **Pro:** Zero source-code changes — Room annotations are identical between kapt and KSP.
- **Con:** KSP version pinning is strict. A Kotlin version bump requires a coordinated KSP version bump or builds break. The plugin documents this with a comment.
- **Con:** Plugin had to add cleanup logic for previously-injected kapt blocks (handled by regex stripping in the gradle mod) since the plugin evolved through both.

## Lessons embedded in this decision

- **Don't fight an obscure JVM env-propagation chain on Windows when a different code path solves the same problem.** The "right" theoretical fix (force tmpdir into the worker JVM) was an order of magnitude harder than the alternative.
- **Verify the actual code path that's failing before picking a workaround.** Reading the sqlite-jdbc loader source revealed kapt was the proximal cause but the design choice (sqlite-jdbc for SQL verification) was the root cause — and KSP simply doesn't make that choice.

## See also

- [[background-download]] — the feature that needed Room
- [[expo-config-plugin]] — where the KSP wiring is injected
- PR #4 commit history — for the full debugging arc
- `plugins/withBackgroundDownload/index.js` `withKspClasspath` + `withGradleDeps`
