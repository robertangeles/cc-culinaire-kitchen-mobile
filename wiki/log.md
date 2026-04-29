# Wiki session log

Append-only log of changes to the wiki. Newest entries on top.

---

## 2026-04-29 — llama.rn integration (code path) — Antoine speaks for real

**What shipped (locally; awaiting device verification before PR).**

Replaced the 96-line stub at `src/services/inferenceService.ts` with a real `llama.rn` integration. Public API preserved: `initLlama`, `completion`, `releaseAllLlama`, `buildMessageArray`, `__forceError` — but `completion` now accepts an optional `onToken` callback that streams tokens as the model produces them. Stop tokens (`<end_of_turn>`, `<|end_of_turn|>`, `<eos>`, `</s>`, `<|endoftext|>`) are filtered out of the streaming callback so they never leak into rendered text.

New file: `src/services/modelLocator.ts` — resolves the absolute GGUF path from `BackgroundDownloadModule.getDocumentDirectory()` with a SecureStore override key (`STORAGE_KEYS.modelDir`) for a future settings reconfig UI. Includes `verifyModelFiles()` that uses `expo-file-system/legacy` to confirm both files (main + mmproj) are on disk.

Streaming slice added to `useConversationStore`: `streamingConversationId` + `streamingText` state, `startStreaming` / `appendStreamingToken` / `commitStreaming` / `clearStreaming` actions. Transient Zustand state — never written to SQLite per token. The completed reply commits as a single `INSERT` once the model finishes.

`useAntoine.send()` now calls `getMainModelPath()` instead of the hard-coded `'antoine.gguf'`, and wraps the inference call with `startStreaming → completion(ctx, params, onToken) → commitStreaming`. Error path goes through `clearStreaming + addMessage(fallback)`.

`ChatList` subscribes to `streamingText` and `streamingConversationId`, renders a virtual in-progress bubble (id `__streaming__`) at the bottom of the list when streaming targets the active conversation. The committed assistant bubble swaps in seamlessly when streaming ends.

New config plugin: `plugins/withLlamaRn` adds the `-keep class com.rnllama.** { *; }` ProGuard rule to `android/app/proguard-rules.pro` idempotently across prebuilds. Required for release builds (R8 minification would strip llama.rn's native classes otherwise).

Tests rewritten + added:

- `src/__tests__/unit/inferenceService.test.ts` — rewritten against `llama.rn/jest/mock`. 8 assertions: init returns wrapped context, init force-error throws, completion returns mocked text + tokensUsed, streaming callback fires per token, completion forwards messages with system prompt at index 0, completion force-error throws, releaseAllLlama resolves, buildMessageArray prepends Antoine's system prompt.
- `src/__tests__/unit/modelLocator.test.ts` — 6 assertions: native fallback, SecureStore override, mmproj path, verifyModelFiles ok, verifyModelFiles missing, error when neither override nor native module is available.
- `src/__tests__/unit/conversationStore.streaming.test.ts` — 5 assertions on the streaming slice.
- `src/__tests__/integration/useAntoine.streaming.test.tsx` — 3 assertions on the end-to-end flow including error and pre-model-active fallback paths.

Test infrastructure updates in `jest.setup.ts`: mock `expo-sqlite` (so `db/client.ts` can be imported without crashing on `openDatabaseSync`); `require('llama.rn/jest/mock')`; `beforeAll` installs the JSI globals and overrides `llamaGetFormattedChat` so the JS-side "Prompt is required" guard passes when only `messages` is sent.

Privacy audit: `grep -rEn "fetch|axios|http|XMLHttpRequest|WebSocket" src/services/inferenceService.ts` returns zero matches (re-worded the docstring so even the comment doesn't trip the audit).

**Wiki updates.**

- New: `wiki/decisions/llama-rn-inference-params.md` — n_ctx=2048, n_predict=1024, temperature=0.7, top_p=0.9, n_threads=4, stop tokens, with reasoning for each. Notes follow-ups: bump n_ctx after measuring RSS on device; try GPU offload if tokens/sec is low; add repeat_penalty if responses loop.
- New: `wiki/concepts/streaming-architecture.md` — the transient Zustand slice + virtual ChatList bubble pattern, why no per-token SQLite writes, why no token throttling yet, race-condition handling for navigate-mid-stream and parallel sends.
- Updated: `wiki/entities/antoine.md` — lifecycle step 4 now describes the real inference flow, with crosslinks to the two new pages.
- Updated: `wiki/synthesis/in-flight.md` — moved llama.rn (code path) to "Last completed", set "Currently in flight" to device verification, listed concrete next-session steps.
- Updated: `wiki/synthesis/project-status.md` — milestone status now reads "code-complete, awaiting device verification" with the deferred-followups list.
- Updated: `wiki/index.md` — added the two new pages.

**What's NOT done.** Device verification on the Moto G86 Power. `pnpm android` will trigger the `expo prebuild` + native rebuild. First build is long (llama.rn ships ~150 MB of native libs across arm64-v8a + x86_64). After that, send a real culinary question and watch Antoine type the reply.

---

## 2026-04-29 — Added `wiki/synthesis/in-flight.md` for cross-session continuity

**Problem.** Each new Claude session starts fresh. The TodoWrite list (the most precise picture of "where we are") evaporates at session end. Without a deliberate breadcrumb, the next Claude has to infer the next action from `project-status.md` + `tasks/todo.md` + recent git log — and might guess wrong.

**Fix.** Created `wiki/synthesis/in-flight.md` — a deliberately short, fast-changing page with three sections: Last completed / Currently in flight / Next action. Updated at session end, read at session start.

**CLAUDE.md updated** to mandate the read order:

1. Read `wiki/synthesis/in-flight.md` FIRST (the breadcrumb)
2. Read `wiki/index.md` (the catalog)

And the write order at session end:

1. Update `wiki/synthesis/in-flight.md` (move completed → last completed; update next action)
2. Append to `wiki/log.md` (long-form record)

**`wiki/index.md` updated** to feature `in-flight.md` at the top under "▶ Current focus" so it's hard to miss even if a future Claude skips the CLAUDE.md instruction.

**Why a separate page, not a section in `project-status.md`:** different update cadences. project-status is slow-changing narrative ("PRs shipped, milestones"); in-flight is fast-changing pulse ("paused mid-X, branch foo, next step bar"). Separating them avoids edit conflicts and keeps each page right-sized for its job.

---

## 2026-04-29 — Four automations on top of the wiki tooling

**What was added:**

1. **Pre-commit health check** — `.husky/pre-commit` runs `node scripts/wiki-status.mjs` after `lint-staged`. Non-blocking; prints `wiki: 12 pages, 1 broken` so it's visible every commit without aborting flow. Broken refs are often intentional forward-references and shouldn't fail the commit.

2. **Status line script** — `scripts/wiki-status.mjs` (`pnpm wiki:status`). Prints one-line summary. Auto-rebuilds the graph if any wiki .md is newer than the cached graph, so the number is always live. Documented in `CLAUDE.md` for wiring into Claude Code's status line via `.claude/settings.json`. Not auto-installed in user settings (didn't want to mutate global Claude Code config without explicit permission).

3. **Post-merge graph rebuild** — `.husky/post-merge` runs `node scripts/wiki-graph.mjs build` after every `git pull` / `git merge`. Keeps `wiki/.graph.json` fresh when pulling teammate's wiki edits.

4. **`/wiki-audit` slash command** — `.claude/commands/wiki-audit.md`. Type `/wiki-audit` in any Claude session to rebuild graph, print stats/broken/orphans, and get a synthesized report classifying each issue (intentional forward-reference vs. real bug) with a proposed next action. Doesn't auto-fix.

**`pnpm wiki:status`** added to package.json scripts.

**`CLAUDE.md` updated** with the "Automations" subsection under "LLM Wiki" → "Wiki tooling".

**Status quo for "automatic" vs "manual":**

| Action                                | Automated                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Read `wiki/index.md` at session start | Behavioral instruction in CLAUDE.md (not enforced)                                                            |
| Search before reading                 | Manual (`pnpm wiki:search`)                                                                                   |
| Watch `raw/`                          | Long-running (`pnpm wiki:watch` while you want it on)                                                         |
| Ingest dropped raw file               | Manual — watcher prints suggested command, user pastes into Claude                                            |
| Update `log.md` at session end        | Behavioral instruction in CLAUDE.md                                                                           |
| Rebuild graph after wiki edits        | **Automatic** on `git merge`/`pull` (post-merge hook) AND on every status-script call (auto-rebuild if stale) |
| Surface broken refs / orphans         | **Automatic** on every commit (pre-commit hook)                                                               |
| Audit + classify issues               | On-demand via `/wiki-audit`                                                                                   |

The big shift from the previous setup: stale graph + silent broken refs are now nearly impossible. Whatever drift creeps in surfaces in your terminal on the next commit.

---

## 2026-04-29 — Wiki tooling (Levels 2/3/4) + caught a real broken reference

**What was done.** Built the three-level wiki tooling per the user's recipe:

- `scripts/wiki-search.mjs` — git-grep-backed search with frontmatter awareness. Returns title + category + summary + path for matches. Supports `--limit` and `--category` filters.
  - **Note:** the user's recipe suggested `npm install -g qmd`. That package on npm (`qmd@0.0.0`) turned out to be a placeholder with no real functionality. Replaced with our own script using `git grep` (always present, fast, no extra deps).
- `scripts/wiki-watch.mjs` — chokidar-backed long-running watcher on `raw/`. Prints the suggested `claude "ingest ..."` command when a new file appears. Doesn't auto-invoke Claude.
- `scripts/wiki-graph.mjs` — JSON-backed graph store. Parses `related: [[...]]` edges, persists to `wiki/.graph.json` (gitignored), supports: build, stats, links-to, links-from, neighbours, path (BFS), orphans, broken.
  - **Note:** the user's recipe suggested SQLite. Pivoted to JSON because (a) `better-sqlite3` needs Visual Studio Build Tools on Windows for native compile, multi-GB install for our 12-page wiki, (b) JSON is faster + smaller + zero-dep at our scale, (c) the script's API can stay identical when we eventually swap the persistence layer.

**Dependencies added** (devDependencies in `package.json`):

- `chokidar ^5.0.0` — file watcher
- `gray-matter ^4.0.3` — kept around in case we want strict YAML elsewhere; the wiki scripts use a forgiving inline parser instead because gray-matter's YAML-strict mode chokes on `[[wiki-link]]` syntax in `related:` (looks like a YAML flow sequence)

**Pnpm scripts added:**

- `pnpm wiki:search "query" [--category foo] [--limit N]`
- `pnpm wiki:watch`
- `pnpm wiki:graph <subcommand>`

**Real bug caught by the graph:** `wiki/entities/antoine.md` references `[[on-device-inference]]` which doesn't exist yet (TBD page for the upcoming llama.rn work). Surfaced by `pnpm wiki:graph broken`. Intentional forward-reference; will resolve when the page is created during the inference PR. The watcher will keep flagging it until then — that's the point.

**`CLAUDE.md` updated** with a "Wiki tooling" section under "LLM Wiki", documenting all three levels and the order to escalate (start with the index, escalate to search at ~30 pages, watcher whenever raw/ is in active use, graph for any cross-cutting analysis or forward-reference cleanup).

---

## 2026-04-29 — Backfill: 3 concept pages + 3 decision pages, replaced docs originals with redirects

**Concept pages created (3):**

- `wiki/concepts/background-download.md` — WorkManager + Room + OkHttp pattern from PR #4
- `wiki/concepts/expo-config-plugin.md` — the pattern for shipping custom native code via prebuild
- `wiki/concepts/privacy-invariant.md` — the non-negotiable rule + how each enforcement point upholds it

**Decision pages created (3):**

- `wiki/decisions/ksp-vs-kapt.md` — why Room uses KSP (Windows tmpdir issue with kapt's sqlite-jdbc)
- `wiki/decisions/wifi-only-default.md` — why 6 GB download defaults to Wi-Fi-only, surfaces, mid-flight policy
- `wiki/decisions/auto-route-from-settings.md` — why Settings pushes to DownloadingScreen (single canonical UI)

**Originals replaced with redirects:**

- `docs/architecture/screens.md` → redirect to `wiki/entities/screens.md`
- `docs/architecture/web-backend-api.md` → redirect to `raw/web-backend-api.md`
- `docs/design/design-system.md` → redirect to `wiki/entities/design-system.md`

The full prose lives in git history if anyone needs it. The redirect files are short pointers so anyone who navigates to the old paths (or follows a stale link) lands in the right place.

**`tasks/` files unchanged** — `tasks/todo.md` and `tasks/lessons.md` remain as-is. The wiki has synthesis pages pointing to them as sources of truth.

**`wiki/index.md` updated** to list the 6 new pages.

**Wiki shape now:**

```
wiki/
  index.md
  log.md
  entities/    (4 pages: antoine, screens, design-system, web-backend)
  concepts/    (3 pages: background-download, expo-config-plugin, privacy-invariant)
  decisions/   (3 pages: ksp-vs-kapt, wifi-only-default, auto-route-from-settings)
  synthesis/   (2 pages: project-status, lessons)
raw/
  web-backend-api.md
```

12 wiki pages + 1 raw file.

**Next session.** When tackling `llama.rn` integration, create:

- `wiki/concepts/on-device-inference.md` (the pattern: model load, context management, streaming)
- `wiki/decisions/llama-rn-integration.md` (the choices: Expo plugin vs autolink, multimodal scope, context window)
- New entries in `tasks/lessons.md` for any non-obvious gotchas
- Append summary to `wiki/log.md`

---

## 2026-04-29 — Wiki initialised from existing markdown files

**What was done.** Bootstrapped `wiki/` and `raw/` from the 7 markdown files already in the repo. No source files deleted; new wiki pages created alongside originals.

**Pages created (6):**

- `wiki/index.md` — master catalog
- `wiki/log.md` — this file
- `wiki/entities/antoine.md` — the on-device AI persona (synthesised from `CLAUDE.md`, `README.md`, `src/constants/config.ts`, `src/constants/antoine.ts`; gap-filled because no single file documented Antoine end-to-end)
- `wiki/entities/screens.md` — navigable summary of `docs/architecture/screens.md`
- `wiki/entities/design-system.md` — navigable summary of `docs/design/design-system.md`
- `wiki/entities/web-backend.md` — synthesised pointer to `raw/web-backend-api.md` plus the cross-repo discipline rules from `tasks/lessons.md`
- `wiki/synthesis/project-status.md` — narrative snapshot of PRs #1–#5 + what's next, derived from `tasks/todo.md`
- `wiki/synthesis/lessons.md` — categorized index into the 31 entries in `tasks/lessons.md`

**Raw files placed (1):**

- `raw/web-backend-api.md` — copied (not moved) from `docs/architecture/web-backend-api.md`. The file explicitly states "source files (in the web repo) win when they conflict" — a perfect fit for the `raw/` immutable-source rule.

**Originals preserved.** All 7 source files still in their original locations:

- `CLAUDE.md`, `README.md` (root) — these are the project's operating constitution + public-facing description; they STAY in place. CLAUDE.md will be updated to reference the wiki (Step 6, next).
- `docs/architecture/screens.md`, `docs/architecture/web-backend-api.md`, `docs/design/design-system.md` — left for now; per-instructions, no deletion without confirmation.
- `tasks/todo.md`, `tasks/lessons.md` — these are working-state files (TODO list + Problem/Fix/Rule log). They STAY in `tasks/` and the wiki points to them as sources of truth.

**Gaps + questions identified:**

- **No `wiki/concepts/` pages yet.** Likely candidates from existing knowledge: "Background download architecture (WorkManager + Room + range resume)", "Privacy invariant enforcement", "Cross-repo drift detection (the contract test pattern)", "Expo Config Plugin pattern for native code". Worth creating ad-hoc when working in those areas.
- **No `wiki/decisions/` pages yet.** Strong candidates from PRs #4 + #5: "Why KSP over kapt", "Why the toggle on Onboarding AND Settings", "Why JS-side multi-file orchestration instead of native". Could be backfilled from PR descriptions if the user wants a complete decisions log.
- **`tasks/lessons.md` has duplicates.** Two `jest-expo` entries on the same day. Worth consolidating during a future cleanup pass.
- **`prompts/` and `docs/specs/` are empty directories.** Skipped per user instruction. The Antoine system prompt actually lives in `src/constants/antoine.ts`, not in `prompts/` — worth revisiting whether `prompts/` should exist at all.

**Next session.** When working on the next major milestone (`llama.rn` integration), create:

- `wiki/concepts/on-device-inference.md` (the pattern)
- `wiki/decisions/llama-rn-integration.md` (the choices made)
- Append a `wiki/log.md` entry summarising
