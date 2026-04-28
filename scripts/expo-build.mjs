#!/usr/bin/env node
/**
 * expo-build.mjs
 *
 * Wrapper around `expo run:android` / `expo run:ios` / `expo start` that
 * provides two guarantees missing from raw `expo` CLI invocation:
 *
 *   1. **Verbose diagnostic output by default.** Sets `EXPO_DEBUG=true`
 *      so every internal expo CLI step logs to stderr. When a hang
 *      happens, the last log line tells us EXACTLY which step is stuck
 *      (autolinking / prebuild / network / Gradle / etc.).
 *
 *   2. **Hang watchdog with visible warnings.** If 60 seconds pass with
 *      no new output line, prints a clearly visible warning to the
 *      terminal so the user knows the build is stuck (not silently
 *      mysterious).
 *
 * Both guarantees address the failure mode hit on 2026-04-28: `pnpm
 * android` hung silently after env-load. No CPU activity, no disk
 * writes, no terminal output for minutes. User had to manually
 * investigate process state to even notice the hang. With this wrapper,
 * the hang is announced in real time and the last-step is captured for
 * diagnosis.
 *
 * **Usage** (called by package.json scripts, not invoked directly):
 *   node scripts/expo-build.mjs run:android
 *   node scripts/expo-build.mjs run:ios
 *   node scripts/expo-build.mjs start --dev-client
 *   node scripts/expo-build.mjs start --dev-client --clear
 */

import { spawn } from 'node:child_process';
import { platform } from 'node:os';

const HANG_TIMEOUT_MS = 60_000;

const COLOR = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(`${COLOR.red}[expo-build] FATAL${COLOR.reset} no expo subcommand provided`);
  console.error('  usage: node scripts/expo-build.mjs <subcommand> [args...]');
  process.exit(1);
}

const isWindows = platform() === 'win32';
const expoBin = isWindows
  ? 'node_modules\\.bin\\expo.cmd'
  : 'node_modules/.bin/expo';

console.log(
  `${COLOR.cyan}[expo-build]${COLOR.reset} launching ${COLOR.bold}expo ${args.join(' ')}${COLOR.reset} ${COLOR.cyan}(EXPO_DEBUG=true, hang-watchdog 60s)${COLOR.reset}`,
);
console.log('');

// On Windows, the bin is `expo.cmd` (a Windows batch wrapper). Node's
// `spawn(cmd, args, { shell: false })` on Windows fails with EINVAL on
// .cmd / .bat files since Windows requires a shell to execute them.
// `shell: true` lets cmd.exe handle the .cmd correctly. On Linux/macOS
// the bin is just `expo` (no shell needed, but `shell: true` works fine).
const child = spawn(expoBin, args, {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    EXPO_DEBUG: 'true',
    // expo's debug namespace — enable everything from expo:* (autolinking,
    // prebuild, metro config, etc.) so hangs are visible in real time.
    DEBUG: process.env.DEBUG ?? 'expo:*',
    // Force color output even when piped through us.
    FORCE_COLOR: '1',
  },
  shell: isWindows,
});

// Track time of last output line so the watchdog can detect silence.
let lastOutputAt = Date.now();
let lastLine = '';
let hangWarningShown = false;

function recordOutput(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);
  // Track non-empty lines for the hang diagnosis.
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    lastLine = lines[lines.length - 1];
    lastOutputAt = Date.now();
    hangWarningShown = false;
  }
}

child.stdout.on('data', recordOutput);
child.stderr.on('data', recordOutput);

// Watchdog: every 10 sec, check if we've gone silent for >60 sec.
const watchdog = setInterval(() => {
  const silentMs = Date.now() - lastOutputAt;
  if (silentMs >= HANG_TIMEOUT_MS && !hangWarningShown) {
    hangWarningShown = true;
    const silentSec = Math.round(silentMs / 1000);
    console.log('');
    console.log(
      `${COLOR.yellow}${COLOR.bold}[expo-build] WATCHDOG${COLOR.reset} ${COLOR.yellow}no output for ${silentSec}s — build appears hung.${COLOR.reset}`,
    );
    console.log(
      `${COLOR.yellow}  Last line:${COLOR.reset} ${lastLine || '<no output yet>'}`,
    );
    console.log(
      `${COLOR.yellow}  This usually means expo CLI is stuck before Gradle/Metro spawns. Options:${COLOR.reset}`,
    );
    console.log(
      `${COLOR.yellow}    1. Wait — could be a slow network call (telemetry, version check)${COLOR.reset}`,
    );
    console.log(
      `${COLOR.yellow}    2. Ctrl+C this process, then re-run the same command — usually unsticks${COLOR.reset}`,
    );
    console.log(
      `${COLOR.yellow}    3. If it recurs, paste the last 20 lines of output for diagnosis${COLOR.reset}`,
    );
    console.log('');
  }
}, 10_000);

child.on('exit', (code, signal) => {
  clearInterval(watchdog);
  if (signal) {
    console.log(`${COLOR.cyan}[expo-build]${COLOR.reset} exited via signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  clearInterval(watchdog);
  console.error(`${COLOR.red}[expo-build] FATAL${COLOR.reset} failed to spawn expo: ${err.message}`);
  process.exit(1);
});

// Forward signals so Ctrl+C cleanly stops the child.
const passSignal = (sig) => () => {
  if (!child.killed) child.kill(sig);
};
process.on('SIGINT', passSignal('SIGINT'));
process.on('SIGTERM', passSignal('SIGTERM'));
