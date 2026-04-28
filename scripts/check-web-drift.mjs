#!/usr/bin/env node
/**
 * check-web-drift.mjs
 *
 * Cross-repo drift detector. Mobile depends on the web backend's auth
 * surface but has no compile-time link to it. This script compares the
 * web repo's current `main` SHA against the SHA we last verified against
 * (pinned in `tasks/web-repo-pin.txt`) and flags any changes that touch
 * the auth surface.
 *
 * Exit codes:
 *   0  No drift, OR drift exists but doesn't touch auth-surface paths
 *   1  Drift on auth-surface paths — review needed before mobile deploy
 *   2  Tooling failure (gh CLI missing, no network, etc.) — soft-fail in
 *      `predev` via `|| true`; hard-fail in `prebuild`
 *
 * Usage:
 *   node scripts/check-web-drift.mjs            # standard run
 *   node scripts/check-web-drift.mjs --bump     # bump pin to HEAD after review
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const PIN_FILE = join(REPO_ROOT, 'tasks', 'web-repo-pin.txt');

const WEB_REPO = 'robertangeles/cc-culinaire-kitchen';

// Files whose changes can break mobile. Anything outside these paths is
// invisible to mobile (web UI, web tests, etc.).
const AUTH_SURFACE_PATTERNS = [
  /^packages\/server\/src\/routes\/auth/i,
  /^packages\/server\/src\/controllers\/auth/i,
  /^packages\/server\/src\/services\/auth/i,
  /^packages\/server\/src\/services\/credentialService/i,
  /^packages\/server\/src\/services\/userService/i,
  /^packages\/server\/src\/services\/refreshTokenService/i,
  /^packages\/server\/src\/middleware\/auth/i,
  /^packages\/shared\/src\/types\/auth/i,
  /^packages\/shared\/src\/types\/user/i,
  /^packages\/server\/src\/db\/schema\/user/i,
  /^packages\/server\/src\/db\/schema\/oauthAccount/i,
  /^packages\/server\/src\/db\/schema\/refreshToken/i,
];

const COLOR = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function gh(args) {
  try {
    return execSync(`gh ${args}`, { encoding: 'utf8' }).trim();
  } catch (err) {
    const stderr = err.stderr?.toString() ?? err.message;
    throw new Error(`gh CLI failed: gh ${args}\n${stderr}`);
  }
}

function readPin() {
  try {
    return readFileSync(PIN_FILE, 'utf8').trim();
  } catch {
    return null;
  }
}

function writePin(sha) {
  writeFileSync(PIN_FILE, sha + '\n');
}

function main() {
  const wantBump = process.argv.includes('--bump');

  let currentSha;
  try {
    // Avoid --jq: its single-quote argument doesn't survive cmd.exe (Windows
    // pnpm spawns scripts through cmd which strips them). Parse JSON in Node.
    const raw = gh(`api repos/${WEB_REPO}/commits/main`);
    currentSha = JSON.parse(raw).sha;
  } catch (err) {
    console.error(`${COLOR.yellow}WARN: could not fetch web repo HEAD: ${err.message}${COLOR.reset}`);
    console.error(`${COLOR.yellow}  (gh CLI not installed? offline? not authenticated?)${COLOR.reset}`);
    process.exit(2);
  }

  const pinnedSha = readPin();
  if (!pinnedSha) {
    console.error(`${COLOR.red}ERROR: ${PIN_FILE} is missing or empty.${COLOR.reset}`);
    console.error(`Initialize it with the current web HEAD: ${currentSha}`);
    process.exit(2);
  }

  if (wantBump) {
    if (currentSha === pinnedSha) {
      console.log(`${COLOR.green}Pin already at HEAD (${pinnedSha.slice(0, 7)}). Nothing to bump.${COLOR.reset}`);
      process.exit(0);
    }
    writePin(currentSha);
    console.log(`${COLOR.green}Bumped pin: ${pinnedSha.slice(0, 7)} -> ${currentSha.slice(0, 7)}${COLOR.reset}`);
    console.log(`Don't forget to commit tasks/web-repo-pin.txt`);
    process.exit(0);
  }

  if (currentSha === pinnedSha) {
    console.log(
      `${COLOR.green}OK ${COLOR.reset}web repo unchanged since last verified (${pinnedSha.slice(0, 7)}).`,
    );
    process.exit(0);
  }

  // Compare pinned -> current and filter to auth-surface files.
  // Same Windows quoting issue as above — parse JSON in Node, not via --jq.
  let changedFiles;
  try {
    const raw = gh(`api repos/${WEB_REPO}/compare/${pinnedSha}...${currentSha}`);
    const parsed = JSON.parse(raw);
    changedFiles = (parsed.files ?? []).map((f) => f.filename).filter(Boolean);
  } catch (err) {
    console.error(`${COLOR.yellow}WARN: could not diff ${pinnedSha.slice(0, 7)}...${currentSha.slice(0, 7)}: ${err.message}${COLOR.reset}`);
    process.exit(2);
  }

  const authSurfaceChanges = changedFiles.filter((f) =>
    AUTH_SURFACE_PATTERNS.some((re) => re.test(f)),
  );

  console.log(`${COLOR.cyan}Web repo drift check${COLOR.reset}`);
  console.log(`  Pinned:  ${pinnedSha}`);
  console.log(`  Current: ${currentSha}`);
  console.log(`  Total files changed: ${changedFiles.length}`);
  console.log(`  Auth-surface changes: ${authSurfaceChanges.length}`);

  if (authSurfaceChanges.length === 0) {
    console.log(
      `${COLOR.green}OK ${COLOR.reset}web repo has changes but none touch the auth surface.`,
    );
    console.log(`  To advance the pin to HEAD: ${COLOR.bold}pnpm check:web -- --bump${COLOR.reset}`);
    process.exit(0);
  }

  console.log('');
  console.log(`${COLOR.red}${COLOR.bold}REVIEW NEEDED${COLOR.reset} — auth-surface files changed in web:`);
  for (const f of authSurfaceChanges) {
    console.log(`  - ${f}`);
  }
  console.log('');
  console.log(`Diff URL:`);
  console.log(`  https://github.com/${WEB_REPO}/compare/${pinnedSha}...${currentSha}`);
  console.log('');
  console.log(`Next steps:`);
  console.log(`  1. Read the diff above.`);
  console.log(`  2. If mobile is unaffected, bump the pin: pnpm check:web -- --bump`);
  console.log(`  3. If mobile IS affected, update src/types/auth.ts,`);
  console.log(`     src/services/__errors__.ts, and docs/architecture/web-backend-api.md`);
  console.log(`     to match, then run pnpm test:contract to confirm. Then bump the pin.`);
  process.exit(1);
}

main();
