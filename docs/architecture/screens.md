# Screens — architecture map

Per-screen wiring map. For visual spec, see `docs/design/design-system.md`.
For the per-component file inventory, browse `src/components/`.

## Routes (Expo Router)

```
app/
  _layout.tsx                  Root: fonts + auth hydrate + Drizzle migrations
                               + RouteGuard + GestureHandlerRootView +
                               BottomSheetModalProvider + SafeAreaProvider
  index.tsx                    Redirect → /(welcome)
  (welcome)/
    _layout.tsx
    index.tsx                  Welcome carousel (3 slides)
  (auth)/
    _layout.tsx
    login.tsx                  Login screen (email/pw + Google)
  (onboarding)/
    _layout.tsx
    index.tsx                  Antoine model download intro
  (tabs)/
    _layout.tsx                Bottom tabs (Chat, Settings)
    chat.tsx                   Chat (Antoine)
    settings.tsx               Settings (account, model, sign out)
```

## Welcome carousel

- **Component:** `src/components/welcome/WelcomeCarousel.tsx`
- **State:** local (current slide index, scroll position)
- **Services:** none
- **Mocked vs real:** UI only — no data layer
- **Navigation:** "Get started" + "Skip" both push `/(auth)/login`

## Login

- **Component:** `src/components/auth/LoginScreen.tsx`
- **Hook:** `useAuth()` (`src/hooks/useAuth.ts`) → wraps `useAuthStore` and
  `authService`.
- **Service (mocked):** `src/services/authService.ts` — email/password and
  Google sign-in both stub-resolve after ~400-600ms with a fake user/token.
- **Storage:** `expo-secure-store` writes the mock JWT under
  `STORAGE_KEYS.authToken` so the SecureStore pattern is exercised from day 1.
- **Navigation on success:** `router.replace('/(onboarding)')`. The
  `RouteGuard` in `_layout.tsx` then prevents back-navigation to `(auth)`.

## Onboarding

- **Component:** `src/components/onboarding/OnboardingScreen.tsx`
- **Reads:** `useAuthStore.user` (for the "Welcome, X" line)
- **Actions:** "Download Antoine" → `router.replace('/(tabs)/settings')` (the
  Settings screen runs the actual mock download ticker). "Choose later" →
  `router.replace('/(tabs)/chat')` (the empty-state CTA there gets the user
  back to settings if they change their mind).

## Chat

- **Orchestrator:** `src/components/chat/ChatScreen.tsx`
- **Sub-components:**
  - `ChatHeader` — brand glyph, model status pill (Loaded/Download), kebab.
  - `ChatList` — `FlatList` of `ChatBubble`s; empty state card when no messages.
  - `ChatBubble` — user (ink) / assistant (paper-deep + copper accent strip).
    Image thumbnail support via `expo-image` + tap-to-expand modal.
  - `ChatComposer` — single-row pill: `[+]` `[input]` `[mic|send]`. Send button
    swaps in when text is non-empty.
  - `KebabMenu` — top-right popover (`Modal` + scrim): New chat, History,
    Clear, Language, Settings, Sign out.
  - `AttachmentSheet` — `BottomSheetModal` with Camera / Library / Files.
    Real `expo-image-picker` + `expo-document-picker` calls; consumer is
    given a stub URI that renders as a placeholder bubble for v1.
  - `HistorySheet` — `BottomSheetModal` listing `useConversation.conversations`,
    tap to `setActive(id)`.
  - `PressToTalk` — UI mock. Holding the mic shows a recording overlay; on
    release inserts a stubbed transcript bubble. No `expo-audio` yet.
- **Hook:** `useAntoine()` (`src/hooks/useAntoine.ts`) orchestrates
  `inferenceService` + `conversationStore`. On send: creates conversation if
  needed, writes the user message to SQLite via `conversationStore.addMessage`,
  calls `completion(...)` on a cached `LlamaContext`, writes the reply.
  On error or model-not-active, inserts a fallback assistant bubble.
- **Hook:** `useConversation()` reads/lists conversations and messages from
  the Drizzle SQLite layer via `conversationStore`. Hydrates on `dbReady`.
- **Service (mocked):** `src/services/inferenceService.ts` — `initLlama`,
  `completion`, `releaseAllLlama`. Function signatures match `llama.rn` so
  swap-in is one-line per function. Canned responses keyed off keywords
  ("hollandaise", "steak", etc.).
- **Mocked vs real:** all UI flows real; `expo-image-picker` / `expo-document-picker`
  real (uses native pickers); inference + audio mocked.

## Settings

- **Component:** `src/components/settings/SettingsScreen.tsx`
- **Hooks:** `useAuth()` (sign out), `useModelDownload()` (state machine).
- **Service (mocked):** `src/services/modelDownloadService.ts` — `setInterval`
  ticker. Returns a `cancel()` handle. The `useModelDownload` hook stashes
  the handle in a ref and clears it on unmount (per eng review — prevents
  timer leak when the user navigates away mid-download).
- **State:** `useModelStore` (`src/store/modelStore.ts`) — Zustand store
  tracking `state | progress | error | isActive`. Auto-flips to `isActive`
  on completion (chain in `useModelDownload.start.onDone`).

## Data layer (on-device only)

- **DB client:** `src/db/client.ts` — `expo-sqlite` + `drizzle-orm/expo-sqlite`.
  File: `culinaire.db`.
- **Schema:** `src/db/schema.ts` — `ckm_conversation` + `ckm_message`. Both
  table names start with `ckm_` per CLAUDE.md naming rule. FKs indexed.
- **Migrations:** `src/db/migrations/` — generated by
  `pnpm db:generate` (drizzle-kit). Bundled into Metro via
  `metro.config.js` (`.sql` added to sourceExts) and run on app start via
  `useMigrations(db, migrations)` in `app/_layout.tsx`.
- **Queries:** `src/db/queries/conversations.ts`, `messages.ts`. Drizzle
  query builder only — no raw SQL.
- **Stores:** `src/store/authStore.ts`, `conversationStore.ts`, `modelStore.ts`,
  `useSettings` (in `src/hooks/useSettings.ts` — small enough to colocate).

## Privacy invariants (enforced by code path)

- `inferenceService.ts` makes zero network calls. Stub today, `llama.rn` later.
- `conversationStore` writes only to local SQLite via `db/queries/*`. There is
  no sync service in this PR.
- `expo-secure-store` is the only auth-token store. `AsyncStorage` is not
  installed.
