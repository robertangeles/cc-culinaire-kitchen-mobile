#!/usr/bin/env node
/**
 * mobile-cleanup.mjs
 *
 * Comprehensive cleanup before any mobile dev session. Replaces the
 * "did I remember to kill adb / clear Metro / wipe .expo / set adb reverse"
 * mental checklist with one deterministic script that runs every time
 * `pnpm start`, `pnpm android`, or `pnpm ios` is invoked.
 *
 * **Why this exists.** On 2026-04-28 we hit four DIFFERENT cache /
 * stale-state bugs in one debugging session that all looked the same
 * ("nothing happens" / "still old value"):
 *   1. Stale adb processes wedged the build (4× during that session)
 *   2. Metro transform cache held inlined EXPO_PUBLIC_* values
 *   3. `.expo/` cached parsed app.config
 *   4. APK assets baked the OLD .env value (separate fix: pnpm android)
 *
 * Each took 5-30 minutes to diagnose. This script eliminates 1-3 deterministically.
 * (#4 always requires a full rebuild, but the cache wipe ensures it actually
 * happens cleanly.)
 *
 * **Modes:**
 *   --light  : reset adb + adb reverse (for `pnpm start`)
 *   --full   : light + wipe Metro caches + .expo + node_modules/.cache
 *   --rebuild: full + wipe android/app/build + node_modules/expo-constants/android/build
 *              (for `pnpm android` so prebuild regenerates app.config asset
 *               with current .env values — fixes the APK-baked-stale-config bug)
 *
 * Default if no flag: --light
 *
 * **Usage:**
 *   pnpm cleanup            # light mode
 *   pnpm cleanup -- --full  # cache nuke
 *   pnpm cleanup -- --rebuild  # cache + native build dirs
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { platform } from 'node:os';
import { join } from 'node:path';

const COLOR = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

const args = process.argv.slice(2);
const MODE = args.includes('--rebuild')
  ? 'rebuild'
  : args.includes('--full')
    ? 'full'
    : 'light';

const isWindows = platform() === 'win32';

function log(msg) {
  console.log(`${COLOR.cyan}[cleanup]${COLOR.reset} ${msg}`);
}

function ok(msg) {
  console.log(`${COLOR.cyan}[cleanup]${COLOR.reset} ${COLOR.green}OK${COLOR.reset} ${msg}`);
}

function step(msg) {
  console.log(`${COLOR.bold}${COLOR.cyan}[cleanup]${COLOR.reset} ${COLOR.bold}${msg}${COLOR.reset}`);
}

function warn(msg) {
  console.warn(`${COLOR.yellow}[cleanup] WARN${COLOR.reset} ${msg}`);
}

function fail(msg) {
  console.error(`${COLOR.red}${COLOR.bold}[cleanup] FATAL${COLOR.reset} ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 1: kill stale adb + start fresh
// ---------------------------------------------------------------------------

function findAdb() {
  const candidates = [
    process.env.ANDROID_HOME && `${process.env.ANDROID_HOME}/platform-tools/adb`,
    process.env.ANDROID_SDK_ROOT && `${process.env.ANDROID_SDK_ROOT}/platform-tools/adb`,
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`,
    process.env.HOME && `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`,
    process.env.HOME && `${process.env.HOME}/Android/Sdk/platform-tools/adb`,
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      execSync(`"${c}" version`, { stdio: 'pipe' });
      return c;
    } catch {
      /* not this one */
    }
  }
  return 'adb';
}

function resetAdb() {
  step('Step 1/4: reset adb');
  try {
    if (isWindows) {
      execSync('taskkill /F /IM adb.exe', { stdio: 'pipe' });
      log('killed adb.exe via taskkill');
    } else {
      execSync('pkill -9 adb', { stdio: 'pipe' });
      log('killed adb via pkill');
    }
  } catch {
    log('no stale adb processes (already clean)');
  }
  // Brief pause so OS releases adb-server lock.
  const until = Date.now() + 1000;
  while (Date.now() < until) {
    /* spin */
  }
}

function verifyDevice(adb) {
  step('Step 2/4: verify device + set adb reverse for Metro');
  const result = spawnSync(adb, ['devices'], { encoding: 'utf8', timeout: 15_000 });
  if (result.status !== 0) {
    fail(`adb devices failed: ${result.stderr || result.stdout || 'unknown'}`);
  }
  const lines = result.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('List of devices') && !l.startsWith('*'));
  const devices = lines
    .map((l) => l.split('\t'))
    .filter(([_, state]) => state === 'device');
  if (devices.length === 0) {
    const others = lines.filter((l) => !l.endsWith('\tdevice'));
    if (others.length > 0) {
      warn('devices found but not in "device" state:');
      for (const o of others) console.warn('  ' + o);
      warn('  → unlock phone, accept any USB debugging prompts, then retry');
    }
    fail(
      'no Android device connected. Plug in your phone via USB, unlock, ensure USB debugging is enabled.',
    );
  }
  ok(`${devices.length} device(s) ready: ${devices.map(([id]) => id).join(', ')}`);

  // adb reverse: makes localhost:8081 on the phone forward to laptop:8081 (Metro).
  // Survives most network changes; resets on USB disconnect / phone reboot
  // (per lessons.md). Re-applying every cleanup makes the workflow bulletproof.
  for (const [deviceId] of devices) {
    const reverseResult = spawnSync(
      adb,
      ['-s', deviceId, 'reverse', 'tcp:8081', 'tcp:8081'],
      { encoding: 'utf8', timeout: 5_000 },
    );
    if (reverseResult.status !== 0) {
      warn(`adb reverse failed for ${deviceId}: ${reverseResult.stderr || reverseResult.stdout}`);
    } else {
      log(`adb reverse tcp:8081 → tcp:8081 set on ${deviceId}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Step 3: cache wipe (full + rebuild only)
// ---------------------------------------------------------------------------

function rmIfExists(path, label) {
  if (!existsSync(path)) {
    log(`  ${COLOR.dim}- skip ${label} (not present)${COLOR.reset}`);
    return;
  }
  try {
    rmSync(path, { recursive: true, force: true });
    log(`  - wiped ${label}`);
  } catch (err) {
    warn(`could not wipe ${label}: ${err.message}`);
  }
}

function wipeCaches() {
  step('Step 3/4: wipe Metro / babel / .expo caches');
  const tmp = process.env.TEMP || process.env.TMPDIR || '/tmp';

  rmIfExists(join(tmp, 'metro-cache'), '%TEMP%\\metro-cache');
  // Metro also writes `metro-*` and `haste-map-*` directories; glob them via
  // a quick listing instead of relying on a globber dep.
  try {
    const entries = execSync(`ls "${tmp}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    for (const name of entries.split('\n').map((s) => s.trim()).filter(Boolean)) {
      if (name.startsWith('metro-') || name.startsWith('haste-map-')) {
        rmIfExists(join(tmp, name), `%TEMP%\\${name}`);
      }
    }
  } catch {
    /* fine — listing failures aren't fatal */
  }
  rmIfExists('node_modules/.cache', 'node_modules/.cache');
  rmIfExists('.expo', '.expo');
  ok('JS caches cleared — next bundle will rebuild from scratch');
}

function wipeNativeBuildDirs() {
  step('Step 4/4: wipe Android native build dirs (forces app.config asset regen)');
  rmIfExists('android/app/build', 'android/app/build');
  rmIfExists(
    'node_modules/expo-constants/android/build',
    'node_modules/expo-constants/android/build',
  );
  ok(
    'Native build dirs cleared — next prebuild will bake CURRENT .env values into APK assets',
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('');
  log(`mode: ${COLOR.bold}${MODE}${COLOR.reset}`);
  console.log('');

  resetAdb();
  const adb = findAdb();
  verifyDevice(adb);

  if (MODE === 'full' || MODE === 'rebuild') {
    wipeCaches();
  }
  if (MODE === 'rebuild') {
    wipeNativeBuildDirs();
  }

  console.log('');
  ok('cleanup complete — proceeding');
  console.log('');
}

main();
