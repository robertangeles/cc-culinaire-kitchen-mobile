#!/usr/bin/env node
/**
 * wiki-status — one-line summary of the wiki's current state.
 *
 * Output (one line, designed for status bars / shell prompts):
 *   wiki: 12 pages, 1 broken
 *
 * Or with --verbose:
 *   wiki — 12 pages (4 entity, 3 concept, 3 decision, 2 synthesis)
 *   broken refs: 1
 *   orphans: 0
 *
 * Wire into Claude Code's status line by adding to settings:
 *   "statusLine": { "type": "command", "command": "node scripts/wiki-status.mjs" }
 *
 * Also fine as a shell-prompt addition or a manual `pnpm wiki:status`.
 *
 * Side effect: rebuilds the graph if `wiki/.graph.json` is missing or
 * older than any wiki .md file. Cheap (sub-second on hundreds of pages).
 */

import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graphPath = path.join(projectRoot, 'wiki', '.graph.json');
const wikiRoot = path.join(projectRoot, 'wiki');

const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

if (!existsSync(wikiRoot)) {
  console.log('wiki: not initialised');
  process.exit(0);
}

if (graphIsStale()) {
  // Suppress build output so the status line stays one-line.
  try {
    execFileSync('node', [path.join(projectRoot, 'scripts', 'wiki-graph.mjs'), 'build'], {
      cwd: projectRoot,
      stdio: 'ignore',
    });
  } catch {
    console.log('wiki: graph build failed');
    process.exit(0);
  }
}

let g;
try {
  g = JSON.parse(readFileSync(graphPath, 'utf8'));
} catch {
  console.log('wiki: graph unreadable');
  process.exit(0);
}

const pageCount = Object.keys(g.nodes).length;
const brokenCount = g.broken.length;
const linked = new Set();
for (const e of g.edges) {
  linked.add(e.from);
  linked.add(e.to);
}
const orphanCount = Object.keys(g.nodes).filter((n) => !linked.has(n)).length;

if (!verbose) {
  const parts = [`${pageCount} pages`];
  if (brokenCount > 0) parts.push(`${brokenCount} broken`);
  if (orphanCount > 0) parts.push(`${orphanCount} orphan${orphanCount === 1 ? '' : 's'}`);
  console.log(`wiki: ${parts.join(', ')}`);
  process.exit(0);
}

const byCategory = {};
for (const n of Object.values(g.nodes)) {
  byCategory[n.category] = (byCategory[n.category] || 0) + 1;
}
const catSummary = Object.entries(byCategory).sort()
  .map(([cat, n]) => `${n} ${cat}`).join(', ');
console.log(`wiki — ${pageCount} pages (${catSummary})`);
console.log(`broken refs: ${brokenCount}`);
console.log(`orphans:     ${orphanCount}`);

function graphIsStale() {
  if (!existsSync(graphPath)) return true;
  const graphMtime = statSync(graphPath).mtimeMs;
  let newest = 0;
  walkMarkdown(wikiRoot, (f) => {
    const m = statSync(f).mtimeMs;
    if (m > newest) newest = m;
  });
  return newest > graphMtime;
}

function walkMarkdown(dir, cb) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walkMarkdown(full, cb);
    else if (entry.endsWith('.md')) cb(full);
  }
}
