# CulinAIre Mobile

The on-device mobile companion to [CulinAIre Kitchen](https://github.com/robertangeles)
— Antoine, the culinary AI persona, running privately and locally on the
user's Android phone with no internet connection required for inference.

This is not a recipe app. It is a private culinary intelligence that lives
on the user's device, responds to culinary questions with the directness and
precision of a seasoned professional, and never sends conversation content
to a server.

## Status

Currently in foundational scaffold state — full mocked flow shipping. All
five screens render end-to-end on a real Android device with stubbed
services (Google auth, Play Billing, model download, on-device inference).
See [tasks/todo.md](tasks/todo.md) for the prioritized roadmap to real
integrations (P1: `llama.rn`, OAuth, billing; P2: backend metadata sync,
zero-knowledge backup; P3: i18n, dark service mode, tablet).

## Architecture

- **Framework:** Expo SDK 54 + React Native 0.81 (New Architecture) +
  Expo Router 6 (file-based routing).
- **State:** Zustand stores with `expo-secure-store` for auth tokens.
- **Local persistence:** `expo-sqlite` + Drizzle ORM. All conversation
  content stays device-local per the privacy invariant in
  [CLAUDE.md](CLAUDE.md). Backend stores only metadata (deferred P2).
- **On-device inference:** `llama.rn` against a local GGUF model file.
  Today this is a stub matching the real API; swap-in is one line per
  function once the GGUF lands on device.
- **Animation:** `react-native-reanimated` v4 worklets, `@gorhom/bottom-sheet`
  for the production-grade sheet primitives.
- **Design system:** Editorial paper / ink / copper. Fraunces + Inter +
  Caveat type. See [docs/design/design-system.md](docs/design/design-system.md)
  for the full spec.

```
app/                    Expo Router screens (file-based routing)
  (welcome)/            Welcome carousel (3 slides)
  (auth)/               Login (email/pw + Google)
  (onboarding)/         Antoine model download intro
  (tabs)/chat.tsx       Chat with Antoine (composer, sheets, history)
  (tabs)/settings.tsx   Account, model card, sign out

src/
  components/{ui,welcome,auth,onboarding,chat,settings}/
                        Reusable primitives + per-screen components
  hooks/                Hooks orchestrating services + stores
  services/             Stub services matching real API shapes
  store/                Zustand stores
  db/                   Drizzle schema + queries + migrations
  constants/            theme.ts, config.ts, antoine.ts
  types/                Shared TypeScript types
  __tests__/            Unit + integration tests

assets/brand/           Brand mark PNGs (lockup + icon)
docs/                   Architecture + design system docs
tasks/                  todo.md (roadmap) + lessons.md (self-improvement log)
prompts/                Antoine system prompt source
```

See [CLAUDE.md](CLAUDE.md) for the full project contract: folder structure,
separation-of-concerns rules, database standards, privacy rules, git
workflow, testing standards.

## Local development

### Prerequisites

- Node.js 20+ and `pnpm`
- Android Studio with SDK + JDK 17 (Android Studio's bundled JBR works)
- `ANDROID_HOME` and `JAVA_HOME` set in your user env vars
- A real Android device (Moto G86 Power is the primary test device).
  Emulators won't exercise the inference path correctly.

### First-time setup

```bash
pnpm install
adb devices                  # confirms your phone is detected
adb reverse tcp:8081 tcp:8081  # forwards localhost:8081 over USB
```

### Running the app

Use **two PowerShell windows side-by-side**:

**Window 1 (Metro — leave running, do not commandeer):**

```bash
pnpm start --dev-client
```

**Window 2 (everything else — adb, builds, git):**

```bash
pnpm android   # first build ~5-10 min, subsequent ~30s
```

Once installed on the phone, future code changes hot-reload — just press
`r` in the Metro window. APK rebuild only needed when native deps change.

### Verification

```bash
pnpm tsc            # TypeScript check (must be 0 errors)
pnpm lint           # ESLint check (must be 0 errors)
pnpm test           # Jest unit + integration suite (currently 31 tests)
pnpm db:generate    # regenerate Drizzle migrations after schema.ts edits
```

## Privacy

Conversation content **never** leaves the device. Antoine runs locally via
`llama.rn`. Stored on-device in SQLite. The backend stores only metadata
(conversation IDs, timestamps, message counts) — never message text.

A consequence: switching phones means a fresh chat history. Zero-knowledge
encrypted backup is planned (P2) and will let users carry history across
devices without weakening the privacy posture. See
[tasks/todo.md](tasks/todo.md) for details.

## Contributing

This is a private project; open issues and PRs go through the team workflow
defined in [CLAUDE.md](CLAUDE.md) § Git Workflow:

- Trunk-based development (`main` is the trunk).
- Small changes commit directly to `main`. Non-trivial changes use
  short-lived feature branches.
- Pre-commit hooks run lint + format on staged files.
- Always ask for explicit confirmation before `git push`.

## License

Private — © Robert Angeles 2026. All rights reserved.
