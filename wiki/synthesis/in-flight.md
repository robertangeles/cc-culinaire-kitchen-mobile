---
title: In flight — what's being worked on right now
category: synthesis
created: 2026-04-29
updated: 2026-06-18
related: [[project-status]], [[privacy-invariant]], [[screens]], [[on-device-inference]]
---

The single source of truth for "where we are right now". Updated at the end of every session and read at the start of every new one. Always short.

> **Read this FIRST in any new session, before `index.md` or anything else.** It tells you what to pick up.

## Status

**Backend-chat pivot is MERGED to `main`** (`777e51e`, PRs #31 + #32) as of
2026-06-18. On-device `llama.rn` inference, the GGUF model download, on-device
RAG, KV-cache persistence, and the server-managed prompt cache are all
**retired and deleted**. Antoine now answers via the web backend
`POST /api/chat` (Vercel AI SDK data-stream over XHR), with conversation
content persisted to `/api/conversations` plus a local SQLite mirror. The
**mobile navigation scaffold** (Kitchen hub + placeholder routes) merged in the
same release. Full detail: [`docs/architecture/backend-chat.md`](../../docs/architecture/backend-chat.md),
[[on-device-inference]] (now a tombstone), and the 2026-06-17 entry in `log.md`.

**Open from the pivot (two items):**

1. **On-device manual smoke test** — never run. Needs the Moto G86 + a live
   backend session (sign in → send → stream → reopen conversation → offline
   fallback). Automated verification is green but no device run has happened.
2. **Privacy-posture doc reversal** — the pivot intentionally reverses the old
   "conversation content never leaves the device" invariant (decisions.md
   2026-06-15). Mobile `CLAUDE.md` privacy rules and `wiki/concepts/privacy-invariant.md`
   still describe the old posture and must be rewritten to match.

## Last completed (2026-06-18)

- **Pulled the pivot to `main`** (`7203e08..777e51e`, fast-forward; +3917/−6628
  across 89 files), reconciled dependencies (`pnpm install --frozen-lockfile`,
  +44/−151), confirmed `tsc` clean and `pnpm test` **194/32 green**.
- **Refreshed the stale task docs** (this page body + `tasks/todo.md`) to match
  the merged pivot — the on-device inference / model-download / encrypted-backup
  entries were describing deleted code and have been quarantined as obsolete.

## Currently in flight

- The two pivot open-items above (device smoke test + privacy doc reversal) —
  neither started.
- **Nav-scaffold follow-up, P1:** re-gate the per-session food-safety ack for
  any Kitchen route that becomes AI-backed. The scaffold bypasses the ack for
  `(tabs)/kitchen` because placeholders carry no Antoine content; that breaks
  the moment a Kitchen screen produces culinary output. Bypass lives in
  `app/_layout.tsx` RouteGuard. (Detail in `tasks/todo.md`.)

## Next action — recommended sequence

1. **Rewrite the privacy posture docs** (CLAUDE.md privacy section +
   `privacy-invariant` wiki page) to reflect backend persistence — no device or
   backend needed, so it unblocks immediately.
2. **On-device smoke test** of the chat flow on the Moto G86 against the live
   backend — the only remaining gate on calling the pivot fully done.
3. **react-native-iap billing** — still the real monetization gap (see todo.md
   P1). Paywall does not exist yet.
4. **Kitchen scaffold → first real AI-backed screen**, at which point the
   food-safety ack re-gate (P1) becomes a hard blocker.

## Open questions / known gaps

- **Per-conversation `language` override is SQLite-only** — the backend
  conversation API does not model it, so it does not round-trip through a
  backend hydrate (logged in shared-context for the web team).
- **Cross-device offline mirror is partial** — SQLite caches only this device's
  own writes; conversations created on another device show live but are not
  written locally for offline reads.
- **Shared-context synced 2026-06-18** — `mobile-needs.md` (the pivot record,
  Web-action-needed: none) and `model-config.md` are now present. Two gaps
  remain on the web side: `decisions.md` has **no `[2026-06-15]` pivot entry**
  (tops out at 2026-05-05, though mobile-needs.md cites it), and `db-schema.md`
  regressed to `[TO BE FILLED BY WEB SESSION]` stubs. Raise with the web session.

## Historical (pre-pivot — kept for context, not active)

- **v1.3 launched to Play Store Closed Testing (2026-05-05)** under
  `com.culinairekitchen.mobile.lite`, real Google Sign-In working on device,
  feedback channel (PR #27) shipped. Full launch playbook in
  `docs/play-store-launch-runbook.md`. The 14-day-tester / Production-unlock
  track predates the pivot — revisit against the new architecture before
  resuming a Production push.
- **On-device inference (incl. the Vulkan-gated vision rerun) is retired.** The
  full investigation history lives in `log.md` (2026-05-01 → 2026-05-03) and
  [[on-device-inference]]. Not coming back under the backend-chat architecture.

## See also

- [`docs/architecture/backend-chat.md`](../../docs/architecture/backend-chat.md) — the new data flow, auth, streaming transport, source-of-truth model
- [[project-status]] — slow-changing narrative of shipped milestones
- [[privacy-invariant]] — **needs reversal** to match backend persistence
- [[screens]] — screen graph (now includes the Kitchen hub)
- `wiki/log.md` — append-only history (2026-06-17 = pivot execution)
- `../cc-culinaire-shared-context/decisions.md` — cross-project decisions (2026-06-15 pivot)
