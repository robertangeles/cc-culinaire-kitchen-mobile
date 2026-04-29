---
title: Screen graph — CulinAIre Mobile
category: entity
created: 2026-04-29
updated: 2026-04-29
related: [[design-system]], [[antoine]]
---

The complete screen + route graph for CulinAIre Mobile, including each screen's component, hooks, services, and navigation contracts.

## Overview

CulinAIre Mobile uses Expo Router 6 (file-based routing) under `app/`. All screen logic lives in `src/components/<area>/` — `app/` files are thin route wrappers. This page mirrors the wiring map maintained at `docs/architecture/screens.md`.

> **Source of truth:** `docs/architecture/screens.md` (and the component code itself). When the routes or wiring change, update both — this page is a _navigable summary_ of the same facts.

## Route tree

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
  (downloading)/
    _layout.tsx                Stack with no header (modal-style)
    index.tsx                  Auto-download experience with rotating tips
  (tabs)/
    _layout.tsx                Bottom tabs (Chat, Settings)
    chat.tsx                   Chat (Antoine)
    settings.tsx               Settings (account, model, sign out)
```

The `(downloading)` group was added in PR #3 to host the dedicated download experience and is auto-routed from Settings whenever a download starts (PR #5).

## Screens (key wiring)

### Welcome carousel

- Component: `src/components/welcome/WelcomeCarousel.tsx`
- State: local only (slide index)
- "Get started" + "Skip" both push `/(auth)/login`

### Login

- Component: `src/components/auth/LoginScreen.tsx`
- Hook: `useAuth()` → wraps `useAuthStore` + `authService`
- Real backend: `https://www.culinaire.kitchen` (see [[web-backend]])
- On success: `router.replace('/(onboarding)')`. RouteGuard then prevents back-nav to `(auth)`.

### Onboarding (post-login, pre-download)

- Component: `src/components/onboarding/OnboardingScreen.tsx`
- Reads: `useAuthStore.user` for the "Welcome, X" line
- Reads/writes: `useModelStore.wifiOnly` (PR #5 — toggle + Alert before allowing cellular)
- "Get Antoine" auto-routes via `/(downloading)`

### DownloadingScreen

- Component: `src/components/onboarding/DownloadingScreen.tsx`
- Auto-fires `useModelDownload().start()` on mount (idempotent via in-flight adoption)
- Shows rotating culinary tips (`COOKING_TIPS` in `src/constants/hellos.ts`)
- Read-only "Wi-Fi only" / "Cellular allowed" badge (PR #5)
- Bottom safe-area inset applied so progress bar clears Android nav buttons

### Chat

- Orchestrator: `src/components/chat/ChatScreen.tsx`
- Sub-components: `ChatHeader`, `ChatList`, `ChatBubble`, `ChatComposer`, `KebabMenu`, `AttachmentSheet`, `HistorySheet`, `PressToTalk`
- Hook: `useAntoine()` orchestrates `inferenceService` + `conversationStore`
- Empty state: `ChatGreeting` (rotating multilingual hello + first name — PR #3)
- Inference: still stubbed; real `llama.rn` integration is the next major milestone (see [[project-status]])

### Settings

- Component: `src/components/settings/SettingsScreen.tsx`
- Hooks: `useAuth()`, `useModelDownload()`, `useModelStore`
- Auto-routes to `/(downloading)` whenever `state` becomes `'downloading'` (PR #5) — keeps the download UI unified with the first-launch flow
- Wi-Fi-only toggle + confirmation Alert (PR #5)

## Data layer (on-device only)

- DB client: `src/db/client.ts` — `expo-sqlite` + `drizzle-orm/expo-sqlite`. File: `culinaire.db`.
- Schema: `src/db/schema.ts` — `ckm_conversation` + `ckm_message`. All tables prefixed `ckm_` per CLAUDE.md.
- Migrations: `src/db/migrations/` (drizzle-kit) — bundled into Metro via `metro.config.js` `sourceExts` for `.sql`, run on app start via `useMigrations(db, migrations)`.
- Stores: `authStore`, `conversationStore`, `modelStore`.

## Privacy invariants enforced by code path

- `inferenceService.ts` makes zero network calls (will hold true post-llama.rn).
- `conversationStore` writes only to local SQLite; no sync service exists.
- `expo-secure-store` is the only auth-token store; AsyncStorage is not installed.

## See also

- [[design-system]] — the visual + voice system every screen follows
- [[antoine]] — the AI persona that lives inside the Chat screen
- [[project-status]] — what's shipped vs. what's next
