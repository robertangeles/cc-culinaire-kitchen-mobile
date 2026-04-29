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

**Idle between milestones.** PRs #1–#5 shipped + merged. Wiki + tooling work is local and uncommitted.

## Last completed

- PR #5 — Wi-Fi/cellular toggle + unified DownloadingScreen routing + safe-area fix. Merged.
- Wiki bootstrap (12 pages + 1 raw doc) + tooling (`pnpm wiki:search/watch/graph/status`) + 4 automations (pre-commit, post-merge, status line, `/wiki-audit` command). All local, not yet committed.

## Currently in flight

Nothing actively in progress. Local working directory has uncommitted wiki + tooling changes that should ship as their own PR (suggested branch: `feature/ck-mob/wiki-bootstrap`).

## Next action — pick one

1. **Commit the wiki + tooling work as PR #6.** Recommended before starting new code work so the wiki state is shared.
2. **Start `llama.rn` integration** — the largest pending milestone. Replaces the stub in `src/services/inferenceService.ts`. The Antoine model files are already on disk (verified PR #4). Probably warrants its own session due to scope.
3. **Smaller follow-ups** — `react-native-iap` for Google Play Billing; `Detox` E2E suite. Both are P1/P2 in `tasks/todo.md` but lower-impact than llama.rn.

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
