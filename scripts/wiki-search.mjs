#!/usr/bin/env node
/**
 * wiki-search — find pages by content + frontmatter without reading them all.
 *
 * Replaces the proposed `qmd` package (which turned out to be a placeholder
 * on npm). Uses `git grep` (always present in a git repo, fast) plus
 * gray-matter for frontmatter parsing.
 *
 * Usage:
 *   node scripts/wiki-search.mjs "query"
 *   node scripts/wiki-search.mjs "background download" --limit 5
 *   node scripts/wiki-search.mjs "ksp" --category decision
 *
 * Output: top matches with title, category, summary, and the file path.
 *
 * When the wiki grows past ~100 pages and `git grep` feels slow, swap the
 * search backend for ripgrep (no other change to this script's interface).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Forgiving frontmatter reader. The wiki uses `related: [[a]], [[b]]`
 * which trips YAML parsers (looks like a flow sequence). We only need
 * a handful of scalar fields, so a tiny regex line-parser is more
 * robust than gray-matter's strict YAML parse.
 */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { data: {}, content: raw };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, content: m[2] };
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(args.length === 0 ? 1 : 0);
}

let limit = 10;
let categoryFilter = null;
const queryParts = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--limit') {
    limit = parseInt(args[++i], 10) || limit;
  } else if (a === '--category') {
    categoryFilter = args[++i];
  } else {
    queryParts.push(a);
  }
}

const query = queryParts.join(' ').trim();
if (!query) {
  printUsage();
  process.exit(1);
}

// Search wiki/ + raw/. -i case-insensitive. -l files only. -F literal (no regex surprises).
let matchedFiles = [];
try {
  const stdout = execFileSync(
    'git',
    ['grep', '-l', '-i', '-F', '--untracked', query, '--', 'wiki/', 'raw/'],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  matchedFiles = stdout.split('\n').filter(Boolean);
} catch (err) {
  // git grep exits 1 when no matches.
  if (err.status === 1) {
    console.log(`No matches for "${query}".`);
    process.exit(0);
  }
  throw err;
}

const results = matchedFiles
  .map((relPath) => {
    const fullPath = path.join(projectRoot, relPath);
    const raw = readFileSync(fullPath, 'utf8');
    const parsed = parseFrontmatter(raw);
    const summary = (parsed.content.split('\n').find((l) => l.trim().length > 0) || '').trim();
    return {
      path: relPath.replace(/\\/g, '/'),
      title: parsed.data.title || path.basename(relPath, '.md'),
      category: parsed.data.category || 'raw',
      summary: summary.slice(0, 160),
      created: parsed.data.created || null,
    };
  })
  .filter((r) => !categoryFilter || r.category === categoryFilter)
  .slice(0, limit);

if (results.length === 0) {
  const filterNote = categoryFilter ? ` (category: ${categoryFilter})` : '';
  console.log(`No matches for "${query}"${filterNote}.`);
  process.exit(0);
}

console.log(`${results.length} match${results.length === 1 ? '' : 'es'} for "${query}":\n`);
for (const r of results) {
  console.log(`  ${r.title}  [${r.category}]`);
  console.log(`  → ${r.path}`);
  if (r.summary) console.log(`    ${r.summary}`);
  console.log('');
}

function printUsage() {
  console.log(`Usage:
  node scripts/wiki-search.mjs "query"                  # search wiki + raw
  node scripts/wiki-search.mjs "query" --limit 5        # cap results
  node scripts/wiki-search.mjs "query" --category decision

Returns matching pages with title, category, summary, and path. Designed
for an LLM to call before deciding which full pages to read.`);
}
