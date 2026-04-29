#!/usr/bin/env node
/**
 * wiki-watch — long-running file watcher for `raw/`.
 *
 * When a new file lands in `raw/`, prints the suggested ingest command so
 * the user can hand it to Claude:
 *
 *   New raw source detected: raw/llama-rn-readme.md
 *   Run: claude "ingest raw/llama-rn-readme.md into the wiki"
 *
 * Doesn't auto-invoke Claude — that's the user's call (and would be
 * dangerous to chain without review). Just surfaces the trigger so
 * ingestion isn't forgotten.
 *
 * Usage:
 *   pnpm wiki:watch            # ctrl-C to stop
 *
 * Notes:
 *  - Initial scan is suppressed; only NEW files (after watcher start)
 *    fire notifications. Otherwise every restart spams 13+ events.
 *  - We watch `raw/` only, not `wiki/`. Wiki pages are written by Claude
 *    directly during a session; raw drops are the trigger that needs
 *    automation.
 */

import chokidar from 'chokidar';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watchDir = path.join(projectRoot, 'raw');

const watcher = chokidar.watch(watchDir, {
  ignoreInitial: true,
  persistent: true,
  depth: 5,
});

console.log(`[wiki-watch] watching ${path.relative(projectRoot, watchDir)} for new files (Ctrl-C to stop)`);

watcher.on('add', (filepath) => {
  const rel = path.relative(projectRoot, filepath).replace(/\\/g, '/');
  console.log('');
  console.log(`[wiki-watch] new raw source detected: ${rel}`);
  console.log(`             suggested next step:`);
  console.log(`               claude "ingest ${rel} into the wiki"`);
});

watcher.on('change', (filepath) => {
  const rel = path.relative(projectRoot, filepath).replace(/\\/g, '/');
  console.log(`[wiki-watch] raw source changed: ${rel}`);
  console.log(`             reminder: raw/ files are immutable. If this was`);
  console.log(`             intentional (re-syncing from upstream), refresh any`);
  console.log(`             wiki pages that summarise it.`);
});

watcher.on('error', (err) => {
  console.error('[wiki-watch] error:', err);
});

process.on('SIGINT', () => {
  console.log('\n[wiki-watch] stopping');
  watcher.close().then(() => process.exit(0));
});
