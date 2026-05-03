# LLM Wiki — CulinAIre Mobile

The living knowledge base for this project.

> **At the start of a new session, read `synthesis/in-flight.md` FIRST** (short, fast-changing — tells you what to pick up). Then this index for the full catalog.
>
> See `CLAUDE.md` § "LLM Wiki" for the rules: when to read, when to write, page format.

## ▶ Current focus

→ **[In flight](synthesis/in-flight.md)** — what's being worked on right now, last completed, next action. Always read first.

## Entities — specific named things

| Page                                       | Summary                                                                                                                            | Created    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [Antoine](entities/antoine.md)             | The on-device culinary AI persona — Gemma 3-4B running locally on the user's phone via `llama.rn`.                                 | 2026-04-29 |
| [Screen graph](entities/screens.md)        | Per-screen wiring map: routes, components, hooks, services, navigation contracts.                                                  | 2026-04-29 |
| [Design system](entities/design-system.md) | Paper, ink, copper visual + voice + motion system used by every screen.                                                            | 2026-04-29 |
| [Web backend](entities/web-backend.md)     | Shared Express + Drizzle + Postgres backend at `https://www.culinaire.kitchen` for auth, subscription, and (future) metadata sync. | 2026-04-29 |

## Concepts — patterns and ideas

| Page                                                                | Summary                                                                                                                                                                 | Created    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [Background download architecture](concepts/background-download.md) | WorkManager + Room + OkHttp pattern: foreground service, range resume, SHA-256 verify, cross-launch adoption. The full plumbing shipped in PR #4.                       | 2026-04-29 |
| [Expo Config Plugin pattern](concepts/expo-config-plugin.md)        | How to ship custom Android native code (Kotlin sources, manifest entries, gradle deps, MainApplication registration) that survives `prebuild --clean` and fresh clones. | 2026-04-29 |
| [Privacy invariant](concepts/privacy-invariant.md)                  | The single non-negotiable rule (responses + history stay on device; only the current query crosses for RAG) and how each enforcement point upholds it.                  | 2026-04-29 |
| [RAG architecture](concepts/rag-architecture.md)                    | Query-time retrieval against the web's culinary corpus, citation-aware prompt formatting, 3s timeout with silent fallback, three-stage streaming UX.                    | 2026-04-30 |
| [Streaming architecture](concepts/streaming-architecture.md)        | How `llama.rn` tokens flow through a transient Zustand slice and a virtual ChatList bubble — no per-token SQLite writes, no schema change.                              | 2026-04-29 |
| [Device screenshots](concepts/device-screenshots.md)                | The exact PowerShell incantation for capturing a PNG from the Moto G86 Power, plus the three approaches that silently corrupt the file or fail the path lookup.         | 2026-05-03 |

## Decisions — architectural decisions with rationale

| Page                                                                                        | Summary                                                                                                                                        | Created    |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [KSP over kapt](decisions/ksp-vs-kapt.md)                                                   | Why Room's annotation processor uses KSP — kapt's worker JVM hits Windows tmpdir issues with sqlite-jdbc. PR #4.                               | 2026-04-29 |
| [Wi-Fi-only default](decisions/wifi-only-default.md)                                        | Why the 6 GB download defaults to Wi-Fi only, why the toggle lives on Onboarding AND Settings, why no mid-download dialog. PR #5.              | 2026-04-29 |
| [Auto-route from Settings to DownloadingScreen](decisions/auto-route-from-settings.md)      | Why downloads triggered from Settings push to the dedicated DownloadingScreen route — single canonical UI, no duplicated tips/progress. PR #5. | 2026-04-29 |
| [llama.rn inference parameters](decisions/llama-rn-inference-params.md)                     | The exact n_ctx, n_predict, temperature, top_p, stop tokens, and threads — with the reasoning for each.                                        | 2026-04-29 |
| [Antoine GGUF must be mainline-quantized](decisions/model-quantization-must-be-mainline.md) | Why Unsloth's `gemma4`-architecture GGUF can't load in llama.cpp + the re-quantization procedure to produce a working file.                    | 2026-04-30 |
| [Server-managed system prompt](decisions/server-managed-prompts.md)                         | Why the Antoine prompt is fetched + cached + version-compared rather than bundled. Iterate without a Play Store release.                       | 2026-04-30 |

## Synthesis — cross-cutting analysis

| Page                                          | Summary                                                                                                           | Created    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| [In flight](synthesis/in-flight.md) ⚡        | Short, fast-changing: what's in progress now, last completed, next action. Read first in any new session.         | 2026-04-29 |
| [Project status](synthesis/project-status.md) | Slow-changing narrative snapshot: what's shipped (PRs #1–#5), what's next (`llama.rn` inference), open questions. | 2026-04-29 |
| [Lessons learned](synthesis/lessons.md)       | Categorized index into the 31 lessons captured at `tasks/lessons.md`.                                             | 2026-04-29 |

## Raw — immutable source documents

Files in `raw/` are NOT to be modified. Sync them from upstream sources when those upstream sources change.

| File                                                  | Source of truth                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`raw/web-backend-api.md`](../raw/web-backend-api.md) | The web repo's actual code (`packages/server/src/{routes,controllers,services,db}/*`). When this conflicts with the web code, the web code wins — re-sync from web. |

## Conventions

- Wiki page links use the `[[page-name]]` convention in `related:` frontmatter (humans + LLMs both understand this; tooling may or may not resolve them).
- File-system links use markdown `[text](path)` so they're clickable in editors + GitHub.
- Always update this index when creating a new wiki page.
- Always append to `log.md` when modifying the wiki.

## Tooling

Three local scripts. Full docs in `CLAUDE.md` § "Wiki tooling".

```bash
pnpm wiki:search "query"        # find pages by content/frontmatter
pnpm wiki:watch                 # long-running watcher on raw/
pnpm wiki:graph build           # rebuild relationship graph
pnpm wiki:graph broken          # forward-references to pages that don't exist yet
pnpm wiki:graph orphans         # pages that nothing links to
pnpm wiki:graph path A B        # shortest path between two pages
```
