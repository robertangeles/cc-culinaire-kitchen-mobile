---
title: In flight — what's being worked on right now
category: synthesis
created: 2026-04-29
updated: 2026-06-19
related: [[project-status]], [[privacy-invariant]], [[screens]], [[on-device-inference]]
---

The single source of truth for "where we are right now". Updated at the end of every session and read at the start of every new one. Always short.

> **Read this FIRST in any new session, before `index.md` or anything else.** It tells you what to pick up.

## Active feature — Suppliers (Phase 1 base) · branch `feature/ck-mob/suppliers-base`

Building **Purchasing → Suppliers** on mobile — the first real feature filling
the Kitchen scaffold. Plan: [`docs/specs/purchasing-suppliers-mobile.md`](../../docs/specs/purchasing-suppliers-mobile.md).
**Phase 0 is CLOSED** (backend read-gating fixed + live-verified). The **Phase 1
base data + state layer is committed** (`4704414`); the **UI layer is the next
chunk and is not yet started.** Suppliers is a non-AI read feature, so it stays
legitimately under the Kitchen food-safety-ack bypass (no Antoine output).
Details in "Last completed" + "Next action" below and the `tasks/todo.md` banner.

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

## Last completed (2026-06-19)

- **Suppliers Phase 0 — CLOSED.** `GET /api/inventory/suppliers` was 403 for
  normal users: the supplier _read_ routes were mis-gated on `inventory:manage`
  (write tier) while every sibling inventory read sits on `inventory:count`.
  Coordinated the fix with the web session via `mobile-needs.md`; they shipped
  the `inventory:count` re-gate (web PR #28, prod `c1776fd`). Live-verified:
  `GET /suppliers` → 200, `/suppliers/:id/locations` → 200, writes still 403,
  no-org → 400. Sign-off + full contract review in
  `../cc-culinaire-shared-context/mobile-needs.md` [2026-06-19].
- **Suppliers Phase 1 base — data + state layer committed** (`4704414`):
  `apiClient.patch()`, `src/types/supplier.ts`, `suppliersService.ts`
  (list/update + `isNoOrganisationError`), `suppliersStore.ts` (status machine:
  idle/loading/ready/no-org/error + edit-replace), `useSuppliers.ts` (edit gated
  on `inventory:manage`; client-side `getSupplier`). 13 new tests; full suite
  **207/207 green**; tsc clean. Backend-only — the SQLite read mirror is the
  separate E1 PR.
- (2026-06-18, prior milestone) Pulled the backend-chat pivot to `main` — see
  Status above.

## Currently in flight

- **Suppliers Phase 1 UI layer** (`feature/ck-mob/suppliers-base`, NOT started):
  list screen, detail (client-side pick — no `GET /suppliers/:id`), narrow edit
  sheet (`{contactName, contactEmail, contactPhone, notes}`, online-only, shown
  only when the token holds `inventory:manage`), tap-to-call/email/maps. Must
  honor Paper/Ink/Copper (`CopperButton`/`TextField`/theme tokens,
  `@gorhom/bottom-sheet`, `FadeInDown`). Then: flip `kitchenNav` purchasing →
  live + KitchenHub status-aware push, component/contract tests, device verify.
- **Two pivot open-items** (still open, lower priority): on-device chat smoke
  test + privacy-posture doc reversal.

## Next action — recommended sequence

1. **Build the Suppliers UI** on `feature/ck-mob/suppliers-base` — list → detail
   → edit sheet → tap-actions, matching the design system. The data/state/hook
   layer underneath is done and tested (`4704414`).
2. **Flip `kitchenNav` purchasing → live** + KitchenHub status-aware push so the
   hub routes into the new screens.
3. **Component + contract tests**, then **on-device verify on the Moto G86**
   (the mandated gate — and where we finally observe the real Subscriber-tier
   200 end-to-end).
4. **Privacy-posture doc reversal** (CLAUDE.md privacy section +
   `privacy-invariant` wiki) — no device needed; still outstanding from the pivot.
5. **react-native-iap billing** — the real monetization gap; paywall does not
   exist yet.

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
