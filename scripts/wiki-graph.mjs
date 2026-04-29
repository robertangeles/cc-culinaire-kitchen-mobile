#!/usr/bin/env node
/**
 * wiki-graph — build + query the wiki page-relationship graph.
 *
 * Builds a JSON graph of (nodes, edges) from every wiki page's
 * `related: [[...]]` frontmatter. Persists to `wiki/.graph.json` so
 * queries don't have to re-scan every page.
 *
 * Why JSON, not SQLite: at our current scale (~12 pages) JSON is faster,
 * smaller, has zero native deps, and is human-readable. When the graph
 * exceeds ~1000 nodes (or queries need indexed multi-hop traversals),
 * swap the persistence layer for `better-sqlite3` (already a transitive
 * dep) — the API surface in this script can stay identical.
 *
 * Usage:
 *   node scripts/wiki-graph.mjs build
 *   node scripts/wiki-graph.mjs links-to antoine
 *   node scripts/wiki-graph.mjs links-from background-download
 *   node scripts/wiki-graph.mjs neighbours antoine            # both directions
 *   node scripts/wiki-graph.mjs path antoine ksp-vs-kapt      # shortest path
 *   node scripts/wiki-graph.mjs orphans                       # pages with no edges
 *   node scripts/wiki-graph.mjs broken                        # references to non-existent pages
 *   node scripts/wiki-graph.mjs stats
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wikiRoot = path.join(projectRoot, 'wiki');
const graphPath = path.join(wikiRoot, '.graph.json');

const cmd = process.argv[2];
const args = process.argv.slice(3);

if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log(usage());
  process.exit(cmd ? 0 : 1);
}

switch (cmd) {
  case 'build':
    build();
    break;
  case 'stats':
    stats();
    break;
  case 'links-to':
    requireArg(args[0], 'page-name');
    linksTo(args[0]);
    break;
  case 'links-from':
    requireArg(args[0], 'page-name');
    linksFrom(args[0]);
    break;
  case 'neighbours':
  case 'neighbors':
    requireArg(args[0], 'page-name');
    neighbours(args[0]);
    break;
  case 'path':
    requireArg(args[0], 'from');
    requireArg(args[1], 'to');
    shortestPath(args[0], args[1]);
    break;
  case 'orphans':
    orphans();
    break;
  case 'broken':
    broken();
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    console.log(usage());
    process.exit(1);
}

// ---- commands ----

function build() {
  const nodes = {};
  const edges = [];
  const broken = [];

  walkMarkdown(wikiRoot, (fullPath) => {
    const relPath = path.relative(wikiRoot, fullPath).replace(/\\/g, '/');
    if (relPath === 'index.md' || relPath === 'log.md') return;
    const pageName = path.basename(relPath, '.md');
    const raw = readFileSync(fullPath, 'utf8');
    const fm = parseFrontmatter(raw);
    nodes[pageName] = {
      name: pageName,
      path: `wiki/${relPath}`,
      title: fm.data.title || pageName,
      category: fm.data.category || 'unknown',
      created: fm.data.created || null,
      updated: fm.data.updated || null,
    };
    const related = parseRelated(fm.data.related);
    for (const targetName of related) {
      edges.push({ from: pageName, to: targetName });
    }
  });

  // Find broken references (target page doesn't exist as a node).
  for (const e of edges) {
    if (!nodes[e.to]) broken.push(e);
  }

  const graph = {
    builtAt: new Date().toISOString(),
    nodes,
    edges,
    broken,
  };
  writeFileSync(graphPath, JSON.stringify(graph, null, 2) + '\n');
  console.log(`[wiki-graph] built — ${Object.keys(nodes).length} nodes, ${edges.length} edges, ${broken.length} broken refs`);
  console.log(`[wiki-graph] persisted to ${path.relative(projectRoot, graphPath)}`);
}

function stats() {
  const g = loadGraph();
  const byCategory = {};
  for (const n of Object.values(g.nodes)) {
    byCategory[n.category] = (byCategory[n.category] || 0) + 1;
  }
  console.log(`Built:        ${g.builtAt}`);
  console.log(`Nodes:        ${Object.keys(g.nodes).length}`);
  console.log(`Edges:        ${g.edges.length}`);
  console.log(`Broken refs:  ${g.broken.length}`);
  console.log(`By category:`);
  for (const [cat, n] of Object.entries(byCategory).sort()) {
    console.log(`  ${cat.padEnd(10)} ${n}`);
  }
}

function linksTo(name) {
  const g = loadGraph();
  const incoming = g.edges.filter((e) => e.to === name);
  if (incoming.length === 0) {
    console.log(`No pages link to "${name}".`);
    return;
  }
  console.log(`${incoming.length} page${incoming.length === 1 ? '' : 's'} link to "${name}":`);
  for (const e of incoming) printNode(g.nodes[e.from], e.from);
}

function linksFrom(name) {
  const g = loadGraph();
  const node = g.nodes[name];
  if (!node) {
    console.error(`No such page: "${name}"`);
    process.exit(1);
  }
  const outgoing = g.edges.filter((e) => e.from === name);
  if (outgoing.length === 0) {
    console.log(`"${name}" links to no other pages.`);
    return;
  }
  console.log(`"${name}" links to ${outgoing.length} page${outgoing.length === 1 ? '' : 's'}:`);
  for (const e of outgoing) {
    const target = g.nodes[e.to];
    if (target) printNode(target, e.to);
    else console.log(`  ${e.to} (broken — page does not exist)`);
  }
}

function neighbours(name) {
  const g = loadGraph();
  const node = g.nodes[name];
  if (!node) {
    console.error(`No such page: "${name}"`);
    process.exit(1);
  }
  const out = new Set(g.edges.filter((e) => e.from === name).map((e) => e.to));
  const incoming = new Set(g.edges.filter((e) => e.to === name).map((e) => e.from));
  const all = new Set([...out, ...incoming]);
  console.log(`Neighbours of "${name}" (${all.size}):`);
  for (const n of [...all].sort()) {
    const target = g.nodes[n];
    const dirs = [];
    if (out.has(n)) dirs.push('→');
    if (incoming.has(n)) dirs.push('←');
    const tag = `[${dirs.join('')}]`;
    if (target) console.log(`  ${tag.padEnd(5)} ${target.title}  (${n})`);
    else console.log(`  ${tag.padEnd(5)} ${n}  (broken)`);
  }
}

function shortestPath(from, to) {
  const g = loadGraph();
  if (!g.nodes[from]) { console.error(`No such page: "${from}"`); process.exit(1); }
  if (!g.nodes[to]) { console.error(`No such page: "${to}"`); process.exit(1); }
  // BFS (treat edges as undirected — `related` is symmetric in spirit even if not always declared both ways).
  const adj = new Map();
  for (const e of g.edges) {
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    if (!adj.has(e.to)) adj.set(e.to, new Set());
    adj.get(e.from).add(e.to);
    adj.get(e.to).add(e.from);
  }
  const queue = [[from]];
  const visited = new Set([from]);
  while (queue.length > 0) {
    const path = queue.shift();
    const head = path[path.length - 1];
    if (head === to) {
      console.log(`Path (${path.length - 1} hop${path.length - 1 === 1 ? '' : 's'}):`);
      for (const step of path) {
        const n = g.nodes[step];
        console.log(`  ${n ? n.title : step}  (${step})`);
      }
      return;
    }
    for (const next of adj.get(head) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  console.log(`No path between "${from}" and "${to}".`);
}

function orphans() {
  const g = loadGraph();
  const linked = new Set();
  for (const e of g.edges) {
    linked.add(e.from);
    linked.add(e.to);
  }
  const all = Object.keys(g.nodes);
  const orphanNames = all.filter((n) => !linked.has(n));
  if (orphanNames.length === 0) {
    console.log('No orphan pages.');
    return;
  }
  console.log(`${orphanNames.length} orphan page${orphanNames.length === 1 ? '' : 's'}:`);
  for (const n of orphanNames) printNode(g.nodes[n], n);
}

function broken() {
  const g = loadGraph();
  if (g.broken.length === 0) {
    console.log('No broken references.');
    return;
  }
  console.log(`${g.broken.length} broken reference${g.broken.length === 1 ? '' : 's'}:`);
  for (const e of g.broken) console.log(`  ${e.from} → ${e.to} (target does not exist)`);
}

// ---- helpers ----

function loadGraph() {
  if (!existsSync(graphPath)) {
    console.error(`No graph yet. Run: node scripts/wiki-graph.mjs build`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(graphPath, 'utf8'));
}

function walkMarkdown(dir, callback) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walkMarkdown(full, callback);
    else if (entry.endsWith('.md')) callback(full);
  }
}

/**
 * Forgiving frontmatter reader — see scripts/wiki-search.mjs for why.
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

function parseRelated(value) {
  if (!value) return [];
  // Accept `[[a]], [[b]]` or comma-separated `a, b`.
  const wikilinks = [...value.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
  if (wikilinks.length > 0) return wikilinks;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function printNode(node, fallbackName) {
  if (!node) {
    console.log(`  ${fallbackName} (missing)`);
    return;
  }
  console.log(`  ${node.title}  [${node.category}]  → ${node.path}`);
}

function requireArg(arg, label) {
  if (!arg) {
    console.error(`Missing argument: ${label}`);
    console.log(usage());
    process.exit(1);
  }
}

function usage() {
  return `Usage:
  node scripts/wiki-graph.mjs build                      # rebuild from wiki/
  node scripts/wiki-graph.mjs stats                      # node/edge counts
  node scripts/wiki-graph.mjs links-to <page>            # incoming references
  node scripts/wiki-graph.mjs links-from <page>          # outgoing references
  node scripts/wiki-graph.mjs neighbours <page>          # both directions
  node scripts/wiki-graph.mjs path <from> <to>           # shortest path (BFS)
  node scripts/wiki-graph.mjs orphans                    # pages with no edges
  node scripts/wiki-graph.mjs broken                     # references to missing pages

Page names are filenames without .md (e.g. "antoine", "ksp-vs-kapt").`;
}
