/**
 * Expo Config Plugin: withBackgroundDownload
 *
 * Injects the native Android background download module during
 * `expo prebuild`. Required because `android/` is gitignored and
 * regenerated on every prebuild — direct edits would not survive
 * `prebuild --clean`, fresh clones, or CI rebuilds.
 *
 * What this plugin does on every prebuild:
 *
 *   1. Copies 8 Kotlin source files into:
 *        android/app/src/main/java/com/anonymous/ccculinairekitchenmob/download/
 *
 *   2. Adds 5 manifest permissions (INTERNET, ACCESS_NETWORK_STATE,
 *      ACCESS_WIFI_STATE, FOREGROUND_SERVICE, FOREGROUND_SERVICE_DATA_SYNC).
 *
 *   3. Adds 4 gradle dependencies (Room runtime + ktx, WorkManager,
 *      LiveData, OkHttp) plus the kapt plugin + Room compiler.
 *
 *   4. Registers `BackgroundDownloadPackage()` in MainApplication.kt's
 *      getPackages() list.
 *
 * Source-of-truth Kotlin lives in `plugins/withBackgroundDownload/android/src/`.
 * Edit there — the prebuild copies them in. Direct edits to the generated
 * `android/.../download/` tree get overwritten.
 */

const {
  withAndroidManifest,
  withAppBuildGradle,
  withGradleProperties,
  withMainApplication,
  withProjectBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'withBackgroundDownload';

const PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
];

// Versions chosen to match the Expo template's Kotlin pin (2.1.20).
// KSP version MUST match Kotlin version exactly (the suffix "-2.0.1" is
// the KSP API revision against Kotlin 2.1.20). Bump both together.
const ROOM_VERSION = '2.8.2';
const WORK_VERSION = '2.10.0';
const LIVEDATA_VERSION = '2.8.7';
const OKHTTP_VERSION = '4.12.0';
const KSP_VERSION = '2.1.20-2.0.1';

const GRADLE_MARKER_BEGIN = '// withBackgroundDownload deps — BEGIN';
const GRADLE_MARKER_END = '// withBackgroundDownload deps — END';
const KSP_PLUGIN_MARKER = '// withBackgroundDownload ksp — BEGIN';
const KSP_CLASSPATH_MARKER = '// withBackgroundDownload ksp classpath — BEGIN';

const MAINAPP_MARKER =
  '/* withBackgroundDownload */ add(com.anonymous.ccculinairekitchenmob.download.BackgroundDownloadPackage())';

/**
 * Copy `plugins/withBackgroundDownload/android/src/*.kt` into the
 * generated Android project. Always overwrites — the plugin source is
 * the source of truth, generated copies are disposable.
 */
const withKotlinSources = (config) =>
  withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const platformRoot = modConfig.modRequest.platformProjectRoot;

      const pkg =
        (modConfig.android && modConfig.android.package) || 'com.anonymous.ccculinairekitchenmob';
      const javaPkgPath = pkg.replace(/\./g, '/');

      const srcDir = path.join(projectRoot, 'plugins', PLUGIN_NAME, 'android', 'src');
      const destDir = path.join(
        platformRoot,
        'app',
        'src',
        'main',
        'java',
        javaPkgPath,
        'download',
      );

      if (!fs.existsSync(srcDir)) {
        throw new Error(`[${PLUGIN_NAME}] missing source dir: ${srcDir}`);
      }
      fs.mkdirSync(destDir, { recursive: true });

      const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.kt'));
      if (files.length === 0) {
        throw new Error(`[${PLUGIN_NAME}] no .kt files found in ${srcDir}`);
      }
      for (const f of files) {
        fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
      }
      console.log(`[${PLUGIN_NAME}] copied ${files.length} Kotlin files → ${destDir}`);
      return modConfig;
    },
  ]);

/**
 * Add the 5 permissions to AndroidManifest.xml plus a `<service>`
 * override that declares `android:foregroundServiceType="dataSync"`
 * on WorkManager's bundled SystemForegroundService.
 *
 * Why the override: WorkManager's library manifest declares the
 * service WITHOUT a foregroundServiceType. When our DownloadWorker
 * calls `setForeground(... FOREGROUND_SERVICE_TYPE_DATA_SYNC)`,
 * Android 14+ throws IllegalArgumentException because the runtime
 * type isn't a subset of the manifest-declared type (which is 0).
 * `tools:replace="android:foregroundServiceType"` tells the manifest
 * merger to overwrite the library's value with ours.
 *
 * Idempotent: checks existing entries before appending.
 */
const withPermissions = (config) =>
  withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of PERMISSIONS) {
      const exists = manifest['uses-permission'].some(
        (p) => p && p.$ && p.$['android:name'] === name,
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    // Make sure the manifest declares the `tools` namespace so
    // tools:replace is recognized by the manifest merger.
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const application = manifest.application && manifest.application[0];
    if (!application) {
      throw new Error(`[${PLUGIN_NAME}] missing <application> element in manifest`);
    }
    application.service = application.service || [];
    const SERVICE_NAME = 'androidx.work.impl.foreground.SystemForegroundService';
    const existingService = application.service.find(
      (s) => s && s.$ && s.$['android:name'] === SERVICE_NAME,
    );
    const desired = {
      $: {
        'android:name': SERVICE_NAME,
        'android:foregroundServiceType': 'dataSync',
        'tools:replace': 'android:foregroundServiceType',
      },
    };
    if (existingService) {
      existingService.$ = { ...existingService.$, ...desired.$ };
    } else {
      application.service.push(desired);
    }
    return modConfig;
  });

/**
 * Add the KSP Gradle plugin to the root build.gradle classpath.
 * KSP (Kotlin Symbol Processing) replaces kapt for Room's annotation
 * processor. We picked KSP over kapt because kapt's worker JVM hits
 * Windows-tmpdir issues when sqlite-jdbc tries to extract a native DLL
 * during Room's compile-time SQL verification.
 */
const withKspClasspath = (config) =>
  withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (contents.includes(KSP_CLASSPATH_MARKER)) return modConfig;
    const anchor = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')";
    if (!contents.includes(anchor)) {
      throw new Error(
        `[${PLUGIN_NAME}] cannot find kotlin-gradle-plugin classpath to anchor KSP against`,
      );
    }
    contents = contents.replace(
      anchor,
      `${anchor}\n    ${KSP_CLASSPATH_MARKER}\n    classpath("com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin:${KSP_VERSION}")\n    // withBackgroundDownload ksp classpath — END`,
    );
    modConfig.modResults.contents = contents;
    return modConfig;
  });

/**
 * Patch `android/app/build.gradle`:
 *   - Apply the KSP plugin (annotation processor for Room — replaces kapt).
 *   - Add Room / WorkManager / LiveData / OkHttp dependencies inside
 *     the `dependencies { ... }` block.
 *
 * Marker comments wrap our injection so re-running prebuild is idempotent.
 */
const withGradleDeps = (config) =>
  withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    // 0) Clean up stale state from prior plugin versions. Two cases:
    //    - kapt apply marker block left over from kapt-era → drop it.
    //    - deps block missing ksp(room-compiler) → wipe it so the
    //      fresh injection below rewrites it with the right processor.
    //    Without this, a project that previously prebuilt with the
    //    kapt-era plugin ends up with a Room runtime + no annotation
    //    processor wired in (DAOs silently fail to compile).
    contents = contents.replace(
      /\n?\/\/ withBackgroundDownload kapt — BEGIN[\s\S]*?\/\/ withBackgroundDownload kapt — END\n?/g,
      '\n',
    );
    const depsBlockMatch = contents.match(
      /\n?\s*\/\/ withBackgroundDownload deps — BEGIN[\s\S]*?\/\/ withBackgroundDownload deps — END\n?/,
    );
    if (depsBlockMatch && !/\bksp\(/.test(depsBlockMatch[0])) {
      contents = contents.replace(depsBlockMatch[0], '\n');
    }

    // 1) Apply KSP plugin once.
    if (!contents.includes(KSP_PLUGIN_MARKER)) {
      const kotlinPlugin = 'apply plugin: "org.jetbrains.kotlin.android"';
      if (!contents.includes(kotlinPlugin)) {
        throw new Error(
          `[${PLUGIN_NAME}] cannot find Kotlin plugin line to anchor KSP apply against`,
        );
      }
      contents = contents.replace(
        kotlinPlugin,
        `${kotlinPlugin}\n${KSP_PLUGIN_MARKER}\napply plugin: "com.google.devtools.ksp"\n// withBackgroundDownload ksp — END`,
      );
    }

    // 2) Add deps inside the dependencies { ... } block.
    if (!contents.includes(GRADLE_MARKER_BEGIN)) {
      const depsBlock = [
        '',
        `    ${GRADLE_MARKER_BEGIN}`,
        `    implementation("androidx.room:room-runtime:${ROOM_VERSION}")`,
        `    implementation("androidx.room:room-ktx:${ROOM_VERSION}")`,
        `    ksp("androidx.room:room-compiler:${ROOM_VERSION}")`,
        `    implementation("androidx.work:work-runtime-ktx:${WORK_VERSION}")`,
        `    implementation("androidx.lifecycle:lifecycle-livedata-ktx:${LIVEDATA_VERSION}")`,
        `    implementation("com.squareup.okhttp3:okhttp:${OKHTTP_VERSION}")`,
        `    ${GRADLE_MARKER_END}`,
      ].join('\n');

      // Insert just before the final `}` of the top-level
      // `dependencies { ... }` block. We anchor on the literal opener
      // and find its matching brace by simple depth counting — this
      // file uses Groovy DSL with no string-embedded braces in deps.
      const depsOpenIdx = contents.indexOf('\ndependencies {');
      if (depsOpenIdx === -1) {
        throw new Error(`[${PLUGIN_NAME}] cannot find top-level dependencies { block`);
      }
      let depth = 0;
      let i = depsOpenIdx + '\ndependencies '.length;
      let closeIdx = -1;
      for (; i < contents.length; i++) {
        const ch = contents[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            closeIdx = i;
            break;
          }
        }
      }
      if (closeIdx === -1) {
        throw new Error(`[${PLUGIN_NAME}] could not find closing } for dependencies block`);
      }
      contents = contents.slice(0, closeIdx) + depsBlock + '\n' + contents.slice(closeIdx);
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });

/**
 * Register `BackgroundDownloadPackage()` in MainApplication.kt's
 * `getPackages()` list. Uses a fully-qualified add() call so we don't
 * need to inject an extra `import` line (cheaper to keep idempotent).
 */
const withMainApplicationRegistration = (config) =>
  withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (contents.includes(MAINAPP_MARKER)) {
      return modConfig;
    }
    // Anchor on the comment Expo template ships with so we don't fight
    // other plugins that mutate this region. Falls back to a regex
    // anchored on the closing `}` of the apply { } if the comment was
    // edited away.
    const anchor =
      '// Packages that cannot be autolinked yet can be added manually here, for example:';
    if (contents.includes(anchor)) {
      contents = contents.replace(anchor, `${anchor}\n              ${MAINAPP_MARKER}`);
    } else {
      const match = contents.match(/PackageList\(this\)\.packages\.apply\s*\{[\s\S]*?\}/);
      if (!match) {
        throw new Error(`[${PLUGIN_NAME}] could not locate PackageList(this).packages.apply block`);
      }
      const block = match[0];
      const replacement = block.replace(/\}\s*$/, `              ${MAINAPP_MARKER}\n            }`);
      contents = contents.replace(block, replacement);
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });

/**
 * Patch `org.gradle.jvmargs` so kapt's Room annotation processor can
 * extract its bundled sqlite-jdbc native library to a writable tmpdir.
 *
 * Without this, Gradle daemons spawned from a non-cmd shell on Windows
 * inherit `java.io.tmpdir = C:\Windows\` (because TMP/TEMP didn't
 * propagate), and Room's DatabaseVerifier crashes with
 * `AccessDeniedException: C:\Windows\sqlite-...dll.lck`.
 *
 * Cross-platform: we point at the user-home tmp on each OS. Honoured by
 * every JVM the daemon spawns, so we don't depend on shell env.
 */
const withRoomKaptTmpdir = (config) =>
  withGradleProperties(config, (modConfig) => {
    const items = modConfig.modResults;
    const idx = items.findIndex((it) => it.type === 'property' && it.key === 'org.gradle.jvmargs');
    // Pick a tmpdir that exists on the host. process.platform === 'win32'
    // for Node-running-on-Windows; everywhere else /tmp is fine.
    const tmpdir =
      process.platform === 'win32'
        ? (process.env.TEMP || process.env.TMP || 'C:\\\\Users\\\\Public\\\\Temp').replace(
            /\\/g,
            '\\\\',
          )
        : '/tmp';
    const tmpFlag = `-Djava.io.tmpdir=${tmpdir}`;
    if (idx >= 0) {
      const current = items[idx].value || '';
      if (!current.includes('-Djava.io.tmpdir=')) {
        items[idx].value = `${current} ${tmpFlag}`.trim();
      }
    } else {
      items.push({
        type: 'property',
        key: 'org.gradle.jvmargs',
        value: `-Xmx2048m -XX:MaxMetaspaceSize=512m ${tmpFlag}`,
      });
    }
    return modConfig;
  });

const withBackgroundDownload = (config) => {
  config = withKotlinSources(config);
  config = withPermissions(config);
  config = withKspClasspath(config);
  config = withGradleDeps(config);
  config = withRoomKaptTmpdir(config);
  config = withMainApplicationRegistration(config);
  return config;
};

module.exports = withBackgroundDownload;
