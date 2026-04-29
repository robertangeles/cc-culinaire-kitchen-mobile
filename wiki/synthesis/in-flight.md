---
title: In flight — what's being worked on right now
category: synthesis
created: 2026-04-29
updated: 2026-04-29
related: [[project-status]]
---

The single source of truth for "where we are right now". Updated at the end of every session and read at the start of every new one. Always short (under 30 lines).

> **Read this FIRST in any new session, before `index.md` or anything else.** It tells you what to pick up.

## Status

**Idle between milestones.** PRs #1–#6 shipped + merged. The wiki + tooling are now live on `main`.

## Last completed

- **PR #6 — Wiki bootstrap + tooling.** 13 pages, 4 automations, `pnpm wiki:*` scripts. Merged.
- **Hotfix PR #7 (in flight on this branch)** — wiki-graph + wiki-search parsers were CRLF-naive; freshly-pulled files on Windows have `\r\n` and the regex expected `\n`, so the post-merge graph rebuild reported `0 edges`. Caught by the post-merge hook itself — the automation worked. Fix: normalise CRLF → LF before parsing.

## Currently in flight

`fix/ck-mob/wiki-crlf-parser` — the parser CRLF normalisation + this in-flight update. Open as PR #7.

## Next action — pick one

1. **PR #8 (small): minimal CI workflow.** No `.github/workflows/` exists today; CLAUDE.md mentions a CI section but it's actually local-gates-before-push. ~30 min to add a single `ci.yml` running `pnpm install` + `tsc --noEmit` + `lint` + `test` on every PR. Cheap insurance.
2. **`llama.rn` integration** — the largest pending milestone. Replaces the stub in `src/services/inferenceService.ts`. Probably its own session due to scope.
3. **Smaller follow-ups** — `react-native-iap` for Google Play Billing; `Detox` E2E suite.

## Open questions / blockers

- None right now.

## How to update this page

End of every session, before stopping:

1. Move what was just completed into "Last completed" (keep only the 2–3 most recent — older work belongs in `wiki/log.md`).
2. Update "Currently in flight" to reflect what got paused mid-flight, if anything (a branch name, an open PR number, a function half-written).
3. Update "Next action" to the _one or two_ concrete next steps.
4. Append today's session summary to `wiki/log.md` for the long-form record.

If a session ended with no in-flight work and no obvious next step, write that explicitly: "Idle between milestones. User to pick direction." That's a valid state.

## See also

- [[project-status]] — slow-changing narrative of shipped milestones
- `wiki/log.md` — append-only history
- `tasks/todo.md` — prioritized roadmap
