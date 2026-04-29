# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add chat input" → "User can type and send a message, response appears in the list"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

# Project Overview

CulinAIre Mobile is the on-device mobile companion to CulinAIre Kitchen —
Antoine, the culinary AI persona, running privately and locally on the
user's Android phone with no internet connection required for inference.

This is not a recipe app. It is a private culinary intelligence that lives
on the user's device, responds to culinary questions with the directness
and precision of a seasoned professional, and never sends conversation
content to a server.

**Core architecture:**

- GGUF model lives on the device. Inference runs on the device. Always.
- User identity, subscription, and profile live on the existing
  CulinAIre Kitchen backend (PostgreSQL).
- Conversations and messages live on the device (SQLite).
- Conversation metadata — not content — syncs to the backend for
  cross-device awareness.
- Conversation content never leaves the device under any circumstance.

**User journey:**

1. User downloads the app from Google Play — small APK
2. User registers or signs in (email/password, Google, Apple)
3. User subscribes (monthly or annual) via Google Play Billing
4. App downloads the Antoine GGUF model from the CDN — one time
5. All inference runs locally from that point forward
6. Conversations persist on device and sync metadata across devices

The audience is culinary professionals and serious home cooks who value
privacy and want a culinary AI that does not require a subscription to
a cloud inference service.

---

# Workflow Orchestration

## 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — do not keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, use multiple subagents for parallel reasoning
- One task per subagent for focused execution

## 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md`
- After ANY significant implementation, architectural decision, or
  non-obvious bug fix: record it in `tasks/lessons.md`
- Format: Problem / Fix / Rule
- Write rules that prevent repeating mistakes
- Review lessons at session start

## 4. Verification Before Done

- Never mark a task complete without proving it works on a real device
- Test on the Moto G86 Power — never assume emulator behaviour matches device
- Ask: "Would a staff engineer approve this?"
- When any user-facing feature is added or modified, the corresponding
  `docs/` file must be created or updated before the task is marked complete

## 5. Demand Elegance (Balanced)

- For non-trivial changes ask: "Is there a more elegant solution?"
- If a fix feels hacky, refactor before presenting
- Avoid over-engineering simple problems

## 6. Autonomous Bug Fixing

- When given a bug report: investigate logs and errors and resolve it
- Do not require the user to guide debugging steps
- Fix failing tests independently when possible

## 7. Testing Standards

Act as a senior QA engineer. Test at the smallest level possible.

Always write **both** unit tests and integration tests for new features and significant changes:

- **Unit tests** (`__tests__/unit/`): Test individual functions, hooks, and store actions in isolation with mocked dependencies.
- **Integration tests** (`__tests__/integration/`): Test how multiple modules work together end-to-end (e.g., service A calls service B which writes to database C). Use mocked native modules but real logic across layers.
- **End-to-end tests**: for full user flows using Detox

Do not consider a feature complete with only unit tests. Integration tests catch wiring bugs, incorrect data flow between layers, and lifecycle issues that unit tests miss.

### Regression Testing Protocol

After every new feature, before marking work complete:

1. Run the full test suite: `pnpm test`
2. Check for TypeScript errors: `pnpm tsc`
3. Run the app on the Moto G86 Power via Expo Go or EAS build
4. Verify inference works with the Antoine GGUF model on device
5. If any DB schema changes were made:
   - On-device SQLite: run migrations via drizzle-kit for React Native
   - Backend PostgreSQL: coordinate with CulinAIre Kitchen backend team
6. Confirm no existing tests were broken, modified, or deleted without justification
7. Report pass/fail results before closing the task

Never consider a feature done until all existing tests pass and the feature
has been verified on the physical device.

## 8. Enterprise Code Quality

Every change must meet production-grade standards:

- No shortcuts, workarounds, or "good enough" implementations
- Every feature must be tested on the physical device before marking complete
- Error handling must be specific and actionable — no generic error messages
- No hardcoded values — use `src/constants/config.ts`
- The system prompt lives in `src/constants/antoine.ts` only — never inline it
- Unused or experimental code must not ship — verify all code paths work
- When integrating any external API or service, make a real test call during
  implementation to verify the connection works
- Never add any SDK, library, or dependency that transmits conversation
  content to a remote server

## 9. Debugging Protocol

Follow this sequence strictly. Do not skip steps.

1. Read the error output exactly as written. Do not interpret.
2. Identify the exact file, line, and function where the error originates.
3. State only what the error message confirms. Label anything else [Inference].
4. Do not suggest a fix until root cause is confirmed by evidence in the code or logs.
5. If root cause cannot be determined from available information, state:
   "I need more information." Then list exactly what information is needed.
6. Never guess. Never patch. Never suggest multiple fixes hoping one works.
7. One confirmed problem. One evidence-based fix. One test to verify.

### Investigation Format

Every debugging response must follow this structure:

- Confirmed: [what the error proves]
- Evidence: [exact file, line, log output]
- Root cause: [only if confirmed by evidence]
- Fix: [only after root cause is confirmed]
- Verify with: [exact command or test]

---

# Architecture Principles

The system must follow:

- Separation of concerns
- Modular architecture
- Maintainable code
- On-device inference — no network calls for AI inference, ever
- Local-first privacy — conversation content never leaves the device
- Clear folder structure
- Two distinct data layers — on-device SQLite and backend PostgreSQL

Screens, components, hooks, services, constants, and types must remain separated.

---

# Project Folder Structure

This is a standalone **Expo Router** React Native app. All application
code lives under `src/` except Expo Router pages which live under `app/`.

    culinaire-mobile/

    app/                          ← Expo Router file-based routing (screens only)
      (tabs)/
        _layout.tsx
        chat.tsx                  ← main chat screen
        settings.tsx              ← model path and inference config
      (auth)/
        login.tsx
        register.tsx
      (subscription)/
        plans.tsx
        download.tsx              ← model download progress screen
      _layout.tsx                 ← root layout, fonts, theme provider
      index.tsx                   ← entry redirect

    src/
      components/
        chat/
          ChatBubble.tsx
          ChatInput.tsx
          ChatList.tsx
        ui/
          Button.tsx
          Header.tsx
          LoadingDots.tsx
      hooks/
        useAntoine.ts             ← orchestrates inference and conversation state
        useConversation.ts        ← conversation CRUD
        useAuth.ts                ← authentication state
        useSubscription.ts        ← subscription state and gating
        useModelDownload.ts       ← GGUF download progress
        useSettings.ts            ← model config read/write
      services/
        inferenceService.ts       ← on-device inference via llama.cpp bindings
        authService.ts            ← authentication API calls
        subscriptionService.ts    ← Google Play Billing integration
        modelDownloadService.ts   ← GGUF CDN download management
        syncService.ts            ← conversation metadata sync to backend
      db/
        schema.ts                 ← Drizzle SQLite schema definitions
        migrations/               ← Drizzle migration files
        queries/
          conversations.ts        ← conversation queries
          messages.ts             ← message queries
      store/
        conversationStore.ts      ← Zustand conversation state
        authStore.ts              ← Zustand auth state
      constants/
        antoine.ts                ← Antoine system prompt (single source of truth)
        config.ts                 ← model path, API base URL, defaults
      types/
        chat.ts                   ← Message, Conversation interfaces
        inference.ts              ← ModelConfig interface
        auth.ts                   ← User, AuthState interfaces
        subscription.ts           ← Plan, SubscriptionState interfaces

    prompts/
      antoine-system-prompt.md

    docs/
      architecture/
      specs/

    tasks/
      todo.md
      lessons.md

Claude must follow this structure when generating code. Never create
`services/` or `hooks/` files directly under `app/` — always use `src/`.

---

# Separation of Concerns

## Screens

Location:

    app/

Responsibilities:

- Layout and navigation only
- Import and compose components
- Pass props — no business logic

Rules:

- No direct inference calls in screens
- No direct database calls in screens
- No direct API calls in screens
- All data flows through hooks

---

## Components

Location:

    src/components/

Responsibilities:

- UI rendering only
- Receive props, emit callbacks
- No state beyond local UI state

Rules:

- No inference calls
- No database calls
- No API calls
- No business logic

---

## Hooks

Location:

    src/hooks/

Responsibilities:

- Orchestrate services and store
- Expose clean interfaces to screens and components
- Handle loading and error states

Rules:

- Hooks call services — never call services from components directly
- One hook per domain concern
- Hooks must not contain UI logic

---

## Services

Location:

    src/services/

---

# Database Design — Mandatory Standards

Apply these rules to ALL database work in this project — both the
on-device SQLite layer and the backend PostgreSQL layer.

---

## Two Distinct Data Layers

This project operates two separate databases. They must never be confused.

**On-device SQLite (via Drizzle for React Native)**

Purpose: Store conversation content, messages, local settings, sync queue.
Location: `src/db/`
Privacy rule: Conversation content stored here NEVER syncs to the backend.

**Backend PostgreSQL (via existing CulinAIre Kitchen backend)**

Purpose: Store user identity, subscription, profile, conversation metadata.
Privacy rule: Conversation content NEVER stored here.

When generating schema or queries, always state which layer the work applies to.

---

## 1. Normalization (2NF)

- Every table must be in Second Normal Form before review.
- No transitive dependencies. Each non-key column depends only on the primary key.
- Repeating groups, comma-separated values, and JSON blobs used as relational
  columns are not allowed.
- Exception: JSONB metadata columns and vector embedding columns are permitted
  where explicitly noted in a comment.

---

## 2. On-Device SQLite Standards

The on-device database uses **Drizzle ORM** with SQLite via
`expo-sqlite` and `drizzle-orm/expo-sqlite`.

- Schema defined in `src/db/schema.ts`
- Migrations managed via `drizzle-kit` for React Native
- No raw SQL queries — use Drizzle query builder only
- All queries live in `src/db/queries/`
- Services call query functions — never call Drizzle directly from services

---

## 3. Backend PostgreSQL Standards

The backend database is the existing CulinAIre Kitchen PostgreSQL instance.

- Schema changes to the backend follow the same standards as the
  CulinAIre Kitchen CLAUDE.md database design rules
- Star schema applies to any analytics tables added for mobile
- New backend tables added for mobile must be reviewed against the
  existing schema for conflicts before implementation

---

## 4. Naming Conventions

Apply consistently across both SQLite and PostgreSQL layers.

| Object          | Pattern                          | Example                                              |
| --------------- | -------------------------------- | ---------------------------------------------------- |
| Tables          | `snake_case`, singular noun      | `conversation`                                       |
| Primary key     | `id` (integer preferred)         | `id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY` |
| Foreign keys    | `{referenced_table_singular}_id` | `user_id`, `conversation_id`                         |
| Timestamps      | `created_dttm`, `updated_dttm`   | standard on every table                              |
| Boolean cols    | `is_` or `has_` prefix           | `is_synced`, `has_model`                             |
| Junction tables | both entity names, alphabetical  | `device_conversation`                                |
| Sync columns    | `synced_dttm`, `sync_status`     | standard on sync-aware tables                        |

- No abbreviations unless universally understood (e.g. `id`, `url`).
- No camelCase in schema files or raw SQL.
- All table name with start with `ckm_`

---

## 5. Index Strategy

- Every foreign key column gets an index. No exceptions.
- Add a composite index when two or more columns are consistently queried together.
- Unique constraints replace unique indexes wherever the constraint is semantic.
- Do not add indexes speculatively. Every index must have a stated query it serves,
  written as a comment directly above the index definition.
- On SQLite: be conservative with indexes — SQLite index overhead is higher
  relative to dataset size on mobile.

---

## 6. Privacy-First Schema Rules

These rules apply to every table in every layer.

- Conversation content (`content` column on messages) must NEVER appear
  in any backend table — not even in an encrypted form.
- Backend tables may store conversation metadata: id, created_at,
  updated_at, device_id, message_count, sync_status.
- If a column could contain user-generated text from a conversation —
  it belongs in SQLite only.
- Before adding any column to a backend table, state explicitly:
  "This column does not contain conversation content."

---

## 7. Migration Standards

**On-device SQLite:**

- Every schema change requires a Drizzle migration file
- Migration files are never edited after creation — create a new one
- Migrations run automatically on app start via `drizzle-kit`
- Test migrations on a clean device before releasing

**Backend PostgreSQL:**

- Follow the migration standards in the CulinAIre Kitchen CLAUDE.md
- Mobile-initiated backend schema changes must be coordinated with the
  existing backend — never applied independently

---

## 8. Enforcement

Before generating or reviewing any schema:

1. State which layer the table belongs to — SQLite or PostgreSQL.
2. State which normal form the table satisfies.
3. Confirm every FK has an index.
4. Flag any column that violates naming conventions.
5. Confirm no conversation content appears in any backend table.
6. Identify whether the table is OLTP or OLAP and confirm it follows
   the correct design pattern for that layer.

If a design decision deviates from any rule above, state the deviation
explicitly and provide a justification before proceeding.

---

# AI Integration

Inference service location:

    src/services/inferenceService.ts

Responsibilities:

- Load the Antoine GGUF model from device storage on app start
- Construct the full message array including system prompt
- Run inference on-device via llama.cpp React Native bindings
- Return the assistant response string
- Handle and surface model load and inference errors clearly

Rules:

- Hooks call InferenceService — screens and components never call it directly
- System prompt is always injected by InferenceService
- No network calls of any kind inside InferenceService

### llama.cpp React Native Integration

Library: `llama.rn`

Model files required on device storage:

    gemma-4-e4b-it.Q4_K_M.gguf      ← main model — 4.97GB
    gemma-4-e4b-it.BF16-mmproj.gguf ← multimodal projector — 0.92GB

Both files are downloaded from the CDN after subscription is confirmed.
Both files must be in the same folder on the device.
The settings screen allows the user to reconfigure the path.

---

# Authentication

Auth service location:

    src/services/authService.ts

Supported methods:

- Email and password
- Google Sign In
- Apple Sign In

Rules:

- JWT tokens stored in SecureStore — never AsyncStorage
- Tokens never logged or exposed in error messages
- Refresh token rotation on every use
- Auth state lives in `src/store/authStore.ts`
- Routes guard access based on auth state and subscription state

---

# Subscription and Paywall

Subscription service location:

    src/services/subscriptionService.ts

Plans:

- Monthly
- Annual

Paywall gates:

- App access — unsubscribed users cannot reach the chat screen
- Model download — GGUF download only initiates after subscription confirmed

Rules:

- Subscription verification happens on every app launch via backend
- Cached subscription state used when offline — with expiry
- Google Play Billing is the source of truth for subscription status
- Never gate features based on client-side subscription state alone —
  always verify with backend before granting access

---

# Conversation Handling

On-device SQLite schema (to be defined in `src/db/schema.ts`):

    conversations: id, user_id, created_at, updated_at, is_synced, synced_at
    messages:      id, conversation_id, role, content, timestamp

Roles:

- user
- assistant

Rules:

- Conversation content stays in SQLite only — never synced to backend
- System messages injected by InferenceService — never stored
- `is_synced` and `synced_at` track metadata sync status to backend
- Backend receives only: conversation id, created_at, updated_at,
  device_id, message_count — never content

---

# Privacy Rules — Non-Negotiable

These rules cannot be overridden by any feature request.

- Conversation content never leaves the device
- No analytics SDKs that collect conversation content
- No crash reporting SDKs that upload conversation content
- No network calls during inference
- No remote storage of conversation content
- If a third-party library requires network access to conversation content — reject it
- If a dependency update introduces remote telemetry on conversation data — revert it
- Before adding any new dependency, audit its network behaviour

---

# Security Guidelines

- JWT tokens stored in `expo-secure-store` — never AsyncStorage
- Never commit secrets, tokens, or API keys
- Validate all inputs before passing to InferenceService or API calls
- Sanitize user data before database writes
- Implement rate limiting on auth endpoints (backend responsibility)
- GGUF file integrity verified via checksum after download
- All API calls to backend use HTTPS only
- Follow OWASP Mobile Top 10 for all security decisions

### OWASP Mobile Risk Categories

Code and APIs must be reviewed for:

1. Improper Platform Usage
2. Insecure Data Storage
3. Insecure Communication
4. Insecure Authentication
5. Insufficient Cryptography
6. Insecure Authorization
7. Client Code Quality
8. Code Tampering
9. Reverse Engineering
10. Extraneous Functionality

---

# API Design

All backend API calls go through `src/services/` only.
No screen or component calls the backend directly.

Example endpoints (backend implements these):

    POST /api/auth/register
    POST /api/auth/login
    POST /api/auth/refresh
    GET  /api/subscription/status
    POST /api/conversations/sync     ← metadata only, never content
    GET  /api/model/version          ← check for new Antoine version

Request/response format matches the existing CulinAIre Kitchen API conventions.

---

# Documentation

Documentation location:

    docs/

Structure:

    docs/
      architecture/
      specs/

---

# LLM Wiki

This project maintains a living knowledge wiki in `wiki/`.

## At the start of every session

1. **Read `wiki/synthesis/in-flight.md` FIRST.** It's a short, fast-changing page that tells you what's currently in progress, what was just completed, and what the next action is. If a previous session paused mid-task, this is where to find the breadcrumb.
2. **Then read `wiki/index.md`** for the catalog of all wiki pages and to understand what is already known.

The two-step read order matters: in-flight first (so you know what to pick up), index second (so you know where to find detail).

## During the session

When you make a significant decision, discover a non-obvious pattern, or implement something architecturally important — write it to the appropriate wiki folder.

## At the end of every session

1. **Update `wiki/synthesis/in-flight.md`** — move what was just completed into "Last completed", update "Currently in flight" to reflect anything paused mid-task, update "Next action" to the concrete next step. This is what the next session reads first.
2. **Append to `wiki/log.md`** with the long-form summary of what was done and decided.

## Wiki rules

- `wiki/entities/` — named things: Antoine, the screen graph, the design system, the web backend
- `wiki/concepts/` — patterns and ideas: background download architecture, on-device inference lifecycle, privacy invariant enforcement
- `wiki/decisions/` — architectural decisions with date and rationale: "Why KSP over kapt", "Why JS-side multi-file orchestration"
- `wiki/synthesis/` — cross-cutting analysis, lessons, open questions, project status
- `raw/` — immutable source documents, never modify; sync from upstream when upstream changes
- Always update `wiki/index.md` when creating a new wiki page
- Always append to `wiki/log.md` when modifying the wiki
- Never modify files in `raw/`

## Wiki page format

Every wiki page must start with:

```markdown
---
title: [page title]
category: [entity | concept | decision | synthesis]
created: [YYYY-MM-DD]
updated: [YYYY-MM-DD]
related: [[page-name]], [[page-name]]
---

[one sentence summary]

[content]
```

## Wiki tooling

Three local scripts maintain the wiki without external services. Use them in this order of effort:

### Level 1 — read the index

`wiki/index.md` is loaded into context at the start of every session. For < 50 pages, this is fine.

### Level 2 — search before reading

When the wiki grows past ~30 pages and full-page reads are slow, search first:

```bash
pnpm wiki:search "background download"
pnpm wiki:search "ksp" --category decision
pnpm wiki:search "privacy" --limit 3
```

Returns title, category, summary, and path for each match. Backed by `git grep` (always present in a git repo, sub-second on hundreds of pages).

### Level 3 — watch raw/

A long-running file watcher surfaces new drops in `raw/` so they don't get forgotten:

```bash
pnpm wiki:watch       # Ctrl-C to stop
```

When a file appears in `raw/`, prints the suggested ingest command. Doesn't auto-invoke Claude.

### Level 4 — graph relationships

Build a graph of `related: [[...]]` edges and traverse:

```bash
pnpm wiki:graph build                              # rebuild from wiki/
pnpm wiki:graph stats                              # node/edge counts by category
pnpm wiki:graph links-to antoine                   # incoming references
pnpm wiki:graph links-from background-download     # outgoing references
pnpm wiki:graph neighbours antoine                 # both directions
pnpm wiki:graph path antoine ksp-vs-kapt           # shortest path (BFS)
pnpm wiki:graph orphans                            # pages with no edges
pnpm wiki:graph broken                             # references to missing pages
```

`pnpm wiki:graph broken` is especially useful — surfaces forward-references to pages you intended to create but haven't yet, so they don't rot silently.

The graph is persisted to `wiki/.graph.json` (gitignored). Rebuild after meaningful edits. JSON-backed at this scale; the script's API stays the same if we ever swap to SQLite for 1000+ pages.

## Automations

Four pieces of automation keep the wiki healthy without ceremony:

### 1. Pre-commit health check (non-blocking)

`.husky/pre-commit` runs `node scripts/wiki-status.mjs` after `lint-staged`. Prints `wiki: 12 pages, 1 broken` (or similar) on every commit. **Does NOT block the commit** — broken refs are often intentional forward-references (e.g. `[[on-device-inference]]`). The print is shame-driven maintenance: visible, not silent.

### 2. Status line / shell prompt

`scripts/wiki-status.mjs` prints a one-liner suitable for any status bar. Wire into Claude Code's status line by adding to `.claude/settings.json`:

```json
{
  "statusLine": { "type": "command", "command": "node scripts/wiki-status.mjs" }
}
```

Or invoke manually via `pnpm wiki:status` (or `pnpm wiki:status -- --verbose` for the breakdown). The script auto-rebuilds the graph if any wiki .md is newer than the cached graph, so the number is always live.

### 3. Post-merge graph rebuild

`.husky/post-merge` runs `node scripts/wiki-graph.mjs build` automatically after `git pull` / `git merge`. Pulling a teammate's wiki edits keeps `wiki/.graph.json` fresh without needing to remember.

### 4. `/wiki-audit` slash command

Defined at `.claude/commands/wiki-audit.md`. Type `/wiki-audit` in any Claude session to:

1. Rebuild the graph
2. Print stats + broken refs + orphans
3. Synthesize a brief report: which broken refs are intentional vs. real bugs, which orphans need linking, what to do next

Doesn't auto-fix anything — proposes; user confirms.

---

# Code Quality Rules

- Keep files small and focused
- Prefer modular functions
- Avoid deeply nested logic
- Use descriptive variable names
- Avoid duplicated logic
- Strict TypeScript — no `any` types

---

# MANDATORY: Editorial Design Standard — Paper, Ink, Copper

The visual system is **two materials and one accent**: paper and ink, with copper
as the only highlight. Treat copper like saffron — a little goes a long way.
Read like a chef's notebook, not a SaaS dashboard.

**Authoritative implementations:**

- `src/constants/theme.ts` — palette, semantic tokens, type, radii, spacing,
  shadows, motion. Source of truth for code.
- `docs/design/design-system.md` — full design system reference (copy of the
  bundle's README). Voice rules, microcopy examples, iconography.
- `assets/brand/ck-logo.png` + `ck-logo-icon.png` — the only brand marks.

## Principles

- **Two materials, one accent.** Background `paper` `#F3EFE4`. Cards
  `paperDeep` `#E8E2D6`. Hairline borders `paperEdge` `#C9C2B3`. Text `ink`
  `#101418`. The single accent is `copper` `#B87840` (deep variant
  `copperDeep` `#8A5530` for pressed/text-on-paper).
- **Status from the spice rack.** `herb` `#3F5B3A` for confirm/in-stock.
  `saffron` `#D9A441` for warning/expiring. `ember` `#C24A28` for
  destructive/over-temp. **No blues, no purples, no true greys.**
- **Solid surfaces. No glass morphism.** Backdrop blur is reserved for the
  bottom tab bar and keyboard accessory dock only — never on sheets, popovers,
  or composer. The user explicitly rejected blur during design iteration.
- **Soft warm shadows.** Cast through `ink` (`#101418`), low contrast, single
  layer. No stacked multi-shadow stacks. No drop-shadow lifts on hover.
- **Quiet confidence in motion.** 160ms (micro), 240ms (default), 360ms
  (sheet/page). Easing `cubic-bezier(.2, .7, .2, 1)`. No bounces. Page
  transitions cross-fade with a 4px upward translate, not slide carousels.
- **Tactility by press, not by glow.** Every tappable element press-scales to
  0.97 with a 4% fill darken in 160ms. Focus rings are copper, never blue.
  Buttons earn their depth from inner highlight + soft warm shadow, not from
  amber glows.
- **Type carries the editorial feel.** `Fraunces` (variable serif) for display
  and body. `Inter` for dense UI (chips, table rows, button labels). `Caveat`
  script reserved exclusively for the "Kitchen" wordmark accent and rare
  signature flourishes — never for body or buttons.
- **Voice: calm head chef.** Sentence case for UI labels. No emoji in product
  UI. Numerals for measurements (350°F, 4 oz). Em-dashes for asides. Never
  "powered by AI". Never "Hey chef!". Never food puns in primary CTAs.

## When Building New UI

1. Pull tokens from `src/constants/theme.ts` — never hex literals in component code.
2. Use `CopperButton` for primary actions, `GhostButton` for secondary, `TextField`
   for inputs. Don't reinvent the primitives.
3. Press-scale 0.97 on any interactive element via Reanimated `withTiming(160ms)`.
4. Bottom sheets: use `@gorhom/bottom-sheet` (`BottomSheetModal`), not a custom
   slide-up panel. Drag-down-to-close, snap points, keyboard avoidance,
   focus trap come for free.
5. Touch targets minimum 44pt (`layout.tap` from `theme.ts`).
6. Empty states are paper cards with a copper CTA — inviting, not generic.
   Reference `ChatList`'s "Pick a Chef" state.
7. New chat bubbles use `entering={FadeInDown.duration(240)}` from Reanimated.
8. Loading states use `LoadingDots`, never a spinner alone.
9. Status colors come from `theme.positive | warning | danger`. Never new colors.

---

# When Generating Code

Claude must:

- Follow the folder structure exactly
- Maintain separation of concerns
- Keep files modular
- Avoid monolithic code
- Generate production-quality TypeScript
- Never inline the system prompt
- Never make network calls from InferenceService
- Never hardcode model paths or API URLs
- Always state which database layer is being modified before writing schema

---

# Git Workflow — Trunk-Based Development

`main` is the trunk.

## Rules

- **MANDATORY**: Always ask for explicit user confirmation before running
  `git push`. Never push automatically.
- Small changes (< 3 files, config, docs): commit directly to `main`
- Non-trivial changes: short-lived feature branch (max 2 days)
- Merge to `main` with `--no-ff`
- Pre-commit hooks (Husky + lint-staged) run lint + format on staged files

## Branch Naming

    feature/ck-mob/on-device-inference
    feature/ck-mob/google-play-billing
    fix/ck-mob/chat-scroll-to-bottom
    hotfix/ck-mob/model-load-crash

## CI Pipeline

When the user says "push" (or any equivalent like "ship it", "send it", "push this"), follow this full workflow:

### Before pushing

0. Write tests for any new or changed logic if they don't already exist.
1. Run `npm run lint && npx tsc --noEmit && npm test` — fix any failures before continuing.
2. Commit all staged changes with a descriptive message.
3. Ensure you are NOT on `main`. If you are, create an appropriately named branch first: `git checkout -b feat/...` or `fix/...` or `hotfix/...` etc.

### Pushing & PR

4. Push the branch: `git push -u origin <branch>`
5. If no PR exists for this branch, create one with `gh pr create`. **Do NOT include any AI attribution in PR descriptions.**
6. If a PR already exists, update its description to reflect **all commits in the PR** (not just the latest push). Read the full commit history with `git log ma

All steps must pass. No exceptions.

## Commit Message Format

    <verb> <area>: <detail>

    Examples:
    Add ChatBubble component with slide-in animation
    Fix InferenceService: handle model load failure gracefully
    Update antoine.ts: tighten system prompt prose rules
    Add conversations table: SQLite schema with sync columns

## Never

- Push to any remote without explicit user confirmation
- Push broken code to `main`
- Commit `.env` files or secrets
- Commit GGUF model files — they are downloaded at runtime, not bundled
- Skip pre-commit hooks (--no-verify)
- Let a feature branch live longer than 2 days

---

# Local Development

## Running the app

    pnpm start              ← start Expo dev server
    pnpm android            ← run on connected Android device
    pnpm ios                ← run on iOS simulator (Mac only)

## Testing

    pnpm test               ← run unit tests with Jest
    pnpm tsc                ← TypeScript check

## Prerequisites

- Node.js 20+
- pnpm
- Expo CLI
- Moto G86 Power with Expo Go installed (primary test device)

## Model Setup on Device

The GGUF model files are downloaded at runtime after subscription.
They are not bundled with the app.

Required files:

    gemma-4-e4b-it.Q4_K_M.gguf      ← 4.97GB
    gemma-4-e4b-it.BF16-mmproj.gguf ← 0.92GB

For development: transfer via USB cable to device storage.
For production: downloaded from CDN via modelDownloadService.
Never commit GGUF files to the repository.
