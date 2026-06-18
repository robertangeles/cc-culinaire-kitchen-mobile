# Plan: Purchasing → Suppliers on Mobile

> Reviewed plan (CEO + outside voice + eng + design, all CLEARED). Mirrored into
> the repo so it syncs across machines via `git pull`. Working copy of record;
> the original lives in `~/.claude/plans/` on the authoring machine.

## Context

The web app (`cc-culinaire-kitchen`) has a **Purchasing → Suppliers** module: a
B2B inventory feature, org-scoped (`organisationId`), permission-gated, with a
23-column supplier table, ingredient links, locations, and purchase orders. The
mobile app (`cc-culinaire-kitchen-mob`) is a privacy-first **B2C single-user
culinary-AI** app (Antoine chat) with a Kitchen hub whose `purchasing` tile is
currently a `placeholder`. The ask: bring Suppliers to mobile.

This is not a UI copy. Review (CEO + spec-review ×2 + outside voice, all
code-verified) surfaced one decisive fact: **the web supplier list is gated on
`inventory:manage` — the write/admin tier — and there is no read-only path.** The
mobile `AuthUser` carries `permissions[]` but no mobile user's org/permission
state is verified. The honest base rate is that a typical consumer user gets
**empty or 403**, which makes the feature dead-on-arrival.

So the plan is **phased**: prove access and unblock the backend dependency FIRST
(Phase 0), then build the feature only if Phase 0 is green (Phase 1). The mobile
job is **lookup + reach** (find a supplier mid-service, tap to call/email, check
lead time, fix a contact/note in passing) — full create/edit stays on web.

Intended outcome: the first real kitchen-ops screen on mobile, establishing the
read + light-actions + Antoine-link pattern that Stock Room / Menu Intelligence
will follow — without cloning desktop admin onto a phone, and without shipping
a feature no real user can reach.

## Decisions locked (CEO review, SELECTIVE EXPANSION mode)

- **Approach C** — read (list + detail) + tap-to-call/email/maps + narrow edit.
- **E1 accepted** — durable SQLite read mirror for offline lookup.
- **E2 accepted** — "Ask Antoine about this supplier" chat deep-link (store-seed).
- **E3 accepted** — ingredient links on detail (with a defer escape hatch).
- **SQLCipher DB encryption: DECOUPLED** into its own P1 plan (it breaks Expo Go +
  is an irreversible re-key — must not ride this PR). Suppliers ships on the
  existing plaintext posture, same as chat today.
- **Auth is single-token** — `apiClient` renders one `authStore` token as Bearer
  or Cookie; there is no dual-credential seam.

## Phase 0 — Spike + backend dependency (BLOCKS Phase 1; ~1 day human / ~part-day CC)

1. **Gate spike, nothing else.** Make one real authenticated
   `GET /api/inventory/suppliers` call as a typical mobile user.
   - Returns rows → proceed to Phase 1 (after step 3).
   - Empty / 403 (expected) → Phase 1 blocked on step 2.
2. **Raise backend dependency in `../cc-culinaire-shared-context/mobile-needs.md`:**
   request a **read-only supplier endpoint + `inventory:view`-style permission**
   scoped for mobile. Today's only read path is the `inventory:manage` admin tier,
   which also grants org-wide create/edit/delete — wrong to hand a phone.
3. **Data-exposure decision (one-way door):** decide what supplier subset mobile
   may read before building. `GET /suppliers` returns the org's _entire_ purchasing
   book (all contacts, commercial terms, locations); a lost/stolen phone is a real
   exposure the web avoids via desktop admin sessions.

**Do not write Phase 1 feature code until Phase 0 is green.** The Phase 1 spec
below is reference, not work to start now.

## Phase 1 — Suppliers feature (CONTINGENT on Phase 0)

Follows the existing chat vertical-slice layering (service → hook → store →
screens → queries → types → tests). Reuse, don't reinvent.

**Ship as stacked PRs (eng review):** base read+edit → E1 mirror → E2 Antoine
link → E3 ingredient links. Each is independently reviewable + revertable; base
lands value first. A problem in a later expansion never blocks the base.

**E3 go/no-go (eng review):** E3 ships LAST and only after measuring the
`GET /ingredients` payload size during Phase 0. The fetch-all-and-filter join is
the one perf smell; if the list is large, ship ids-only or defer E3.

### Pre-req

- **Document the supplier contract** in `mobile-needs.md` / `api-contracts.md`:
  list + PATCH request/response shapes, field types, `activeInd`, error envelopes.
  Note: there is **no `GET /suppliers/:id`** — detail is a client-side selection
  from the cached list, not a separate fetch.

### Files (new unless noted)

- `src/types/supplier.ts` — `Supplier` type mirroring the documented contract.
- `src/services/suppliersService.ts` — `list()` via `apiClient.get` (Bearer);
  narrow `update(id, patch)` via a new `apiClient.patch<T>()` helper (see below).
  Typed errors via existing `ApiError`/`NetworkError`; log list-call outcome (§ below).
- `src/services/apiClient.ts` (edit) — add a one-line `patch<T>()` helper alongside
  `get/post/del` (first PATCH consumer in the app; don't scatter `request({method})`).
- `src/db/schema.ts` (edit) + `src/db/migrations/` (new) — additive `ckm_supplier`
  table (read mirror) + index on `(active_ind)`; **new Drizzle migration file**
  (CLAUDE.md §7, append-only, runs on app start).
- `src/db/queries/suppliers.ts` — mirror read/upsert; reuses the conversation
  read-hydrate-fallback pattern (`conversationStore.ts:18-19`).
- `src/store/suppliersStore.ts` — hydrate-from-backend, fall back to mirror on
  network fail; writes go straight to backend then refresh mirror (mirror is never
  the source of truth for a pending edit).
- `src/store/conversationStore.ts` (edit) — add `seededPrompt` field for E2.
- `src/hooks/useSuppliers.ts` — selector wrapper over the store.
- `app/(tabs)/kitchen/purchasing/_layout.tsx`, `index.tsx` (list), `[id].tsx`
  (detail) — new dedicated route group (NOT a `[slug].tsx` branch).
- `src/components/kitchen/purchasing/` — `SuppliersListScreen`, `SupplierDetailScreen`,
  row + edit-sheet components. Use `CopperButton`/`TextField`/theme tokens only.
- `src/constants/kitchenNav.ts` (edit) — flip `purchasing` `status` to `live`
  **last**; `src/components/kitchen/KitchenHubScreen.tsx` (edit) — status-aware push
  so `live` tiles route to their real screen.

### Behavior

- **List:** client-side search (baseline — a phone list without search is unusable).
- **Detail:** read the selected row; tap-to-call / tap-to-email / open-maps with
  `Linking.canOpenURL` fallback when no handler app exists.
- **Narrow edit (online-only):** editable set = `contactName`, `contactEmail`,
  `contactPhone`, `notes`, `activeInd` toggle. Partial PATCH. Form **disabled
  offline**. On PATCH 4xx (422/403): inline error, form stays dirty, do NOT refresh
  the mirror until success.
- **E1 mirror:** read-only offline durability for list + detail.
- **E2 deep-link:** detail sets `conversationStore.seededPrompt`, navigates to chat
  tab; composer reads + clears it on mount.
- **E3 ingredient links:** `GET /suppliers/:supplierId/ingredient-ids` (`inventory:count`)
  - names joined against a cached one-time `GET /ingredients`. On name-fetch failure,
    render the count ("Provides 7 items"); never fail the detail screen. If heavy →
    drop to ids-only or defer (it's the most likely item to cut).

### Observability

- Add a **minimal app-wide log helper** and record the `GET /suppliers` outcome
  (success+count / 403 / empty / network) in production — the one signal that tells
  you whether the feature is alive for real users vs silently DOA. Doubles as the
  app's first reusable log primitive.

### Edge cases to handle

Double-tap nav guard; block pull-to-refresh while edit sheet open; empty-org state;
403 "not available on your account" state distinct from generic error; offline banner
over mirror data.

### Design spec (from /plan-design-review — Paper/Ink/Copper, APP UI ruleset)

**Detail screen hierarchy (decided):** contact-actions-primary.

1. Supplier name (Fraunces) + status pill at top. Status uses `theme.positive`
   (active) / `theme.textMuted` (inactive) AND a text label ("Active"/"Inactive") —
   never color alone (colorblind a11y).
2. **Action row as the visual anchor** — Call / Email / Maps, copper icons, 44pt
   targets, each with an `accessibilityLabel`. This is the mobile job; it sits highest.
3. Terms / lead time / category (Inter labels, muted).
4. Ingredients ("Provides…", E3) — quiet list.
5. Notes.
6. "Ask Antoine about this supplier" — quieter copper **text-link** (not a hero button).
7. Edit — top-right affordance, opens the edit sheet.
   List rows: hairline-separated (NOT a card grid) — name (Fraunces) + category chip
   (Inter) + muted lead-time line + chevron.

**Interaction state table (what the user SEES):**

```
STATE     | LIST                              | DETAIL
----------|-----------------------------------|------------------------------
LOADING   | LoadingDots, centered             | LoadingDots
EMPTY-ORG | paper card: "No suppliers yet."   | n/a
          | one head-chef line; no blame      |
403       | warm explainer card (see below)   | (reached via list → same card)
OFFLINE   | mirror data + top banner          | mirror data + banner;
          | "Offline — showing saved"         | edit disabled, Call/Email still work
SUCCESS   | rows                              | full detail
PATCH-ERR | n/a                               | inline field error, form stays dirty
```

**403 "not available" state (decided — warm explainer + Antoine CTA):** paper card,
copper accent. Copy direction: "Suppliers is part of CulinAIre Kitchen for pros" +
one line on what it does + a copper CTA "Ask Antoine about sourcing instead" that
deep-links into chat (reuses the E2 seed mechanism). Turns the likely-most-seen
screen into a redirect to the core product, not a dead-end. Sentence case, no emoji,
calm-head-chef voice.

**Empty/offline copy:** follow the ChatList "paper card + copper CTA" empty-state
pattern. Offline banner is calm, not alarming.

**A11y (mobile):** every icon action (call/email/maps/edit) has an
`accessibilityLabel`; 44pt min targets (`layout.tap`); status never color-only;
body text ≥16px; copper focus/press, never blue.

**Motion:** new rows / detail enter with `FadeInDown.duration(240)` (house pattern);
press-scale 0.97 on tappables. No new colors, no glassmorphism, no card mosaic.

### Tests (CLAUDE.md §7 — unit AND integration, mandatory)

- Unit: `suppliersService` (200 shape, 403→typed, 429, network→throw);
  `useSuppliers` (hydrate→mirror fallback); `suppliersStore` (mirror r/w, edit
  rollback on 4xx); E3 id→name join + count fallback.
- Component: empty / offline / no-permission(403) states.
- Integration: list→detail→edit→PATCH→mirror-refresh (mocked native).
- Contract: extend `src/__tests__/contract/web-backend.contract.test.ts` to pin the
  supplier list/PATCH shape (guards the undocumented-contract risk).
- **[CRITICAL regression]** migration test: the new `ckm_supplier` Drizzle migration
  must run on an **existing-install upgrade path** without disturbing chat
  conversations/messages (additive table — verify, don't assume).
- **E2E (Detox):** list → detail → tap-to-call launches the dialer. **Prereq: Detox
  is not set up in this repo** — the harness is a one-time setup task before this test
  (benefits chat too).

## NOT in scope

- Approach B full CRUD parity (create/soft-delete, all-23-field forms, offline
  write/sync) — wrong UX for a phone; web serves it.
- SQLCipher DB encryption — decoupled to its own P1 plan.
- Purchase orders, locations, ingredient-supplier pricing — web admin only.

## What already exists (reused)

- `apiClient` (Bearer + auto-refresh + typed errors), chat vertical-slice layering,
  `conversationStore` read-hydrate-fallback mirror pattern, design primitives
  (`CopperButton`, `TextField`, theme tokens), Kitchen route scaffold + `kitchenNav`
  placeholder, contract-test harness. The feature fills the proven pattern.

## Verification (end-to-end)

1. **Phase 0:** the `GET /api/inventory/suppliers` spike returns rows for a real
   mobile user (or the backend `inventory:view` dependency is filed and resolved).
2. `pnpm tsc` clean, `pnpm test` green (new unit/integration/contract tests pass,
   no existing tests broken).
3. On the **Moto G86 Power**: open Kitchen → Purchasing → list loads → search →
   detail → tap-to-call launches dialer → narrow edit PATCHes and persists →
   airplane-mode shows mirror data + offline banner → "Ask Antoine" seeds chat.
4. Confirm the supplier-access log emits the list outcome.
5. Recommended before implementation: **`/plan-design-review`** (two new screens),
   then **`/plan-eng-review`** (required shipping gate).

## Open risks (carry into build)

- **DOA risk** — typical users likely lack `inventory:manage`; Phase 0 exists to
  catch this before any feature code.
- **E3** — client-side ingredient-list join; cut to ids-only if heavy.
- **E2** — store-seed must survive tab switch + cold launch; may exceed "M" effort.

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                             | Runs | Status       | Findings                                                                                      |
| ------------- | --------------------- | ------------------------------- | ---- | ------------ | --------------------------------------------------------------------------------------------- |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 1    | ISSUES_OPEN  | SELECTIVE_EXPANSION; 3 proposed, 3 accepted; 1 strategic gap (DOA → Phase 0)                  |
| Outside Voice | (Claude subagent)     | Independent challenge           | 1    | ISSUES_FOUND | 6 criticisms; 2 changed decisions (SQLCipher decouple, phased posture)                        |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 1    | CLEAR        | 3 issues; 0 critical gaps; split into 4 stacked PRs; migration regression test mandated       |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 1    | CLEAR        | score 7→9/10; 2 decisions (detail hierarchy, 403-as-Antoine-redirect); full design spec added |

- **OUTSIDE VOICE:** decoupled SQLCipher from this PR; restructured to phased
  (spike + backend `inventory:view` dependency before feature spec); corrected a
  non-existent Bearer/cookie auth seam.
- **ENG REVIEW:** apiClient verified PATCH-ready (add `patch()` helper); ~14-file
  Phase 1 split into stacked PRs (base → E1 → E2 → E3); E3 gated on ingredient-list
  size; CRITICAL migration-on-existing-install regression test mandated; Detox E2E
  for tap-to-call (harness setup is a prereq).
- **DESIGN REVIEW:** 7→9/10 (APP UI, Paper/Ink/Copper). Detail screen ordered
  contact-actions-primary; the 403 state (likely most-seen) turned into a warm
  Antoine-redirect, not a dead-end; full state table + a11y spec added. Remaining
  gap to 10 is a visual mockup — blocked only by missing OpenAI key for the designer.
- **CROSS-MODEL:** CEO + outside voice + eng + design all agree the feature is gated
  on Phase 0; no contradictions among reviews.
- **UNRESOLVED:** 0 decisions outstanding.
- **VERDICT:** CEO + ENG + DESIGN CLEARED — ready to implement, but Phase 0 (access
  spike + backend `inventory:view` dependency) blocks all feature code regardless.
