# Lessons

Self-improvement loop per CLAUDE.md § "Self-Improvement Loop". Format:
**Problem** / **Fix** / **Rule**.

---

# Cross-repo facts: shared backend with cc-culinaire-kitchen

These lessons describe the relationship between this mobile repo and the
web repo at <https://github.com/robertangeles/cc-culinaire-kitchen> (cloned
locally at `c:\My AI Projects\cc-culinaire-kitchen`). **Both apps share a
single Express + Drizzle + Postgres backend.** Read these before any auth /
backend integration work.

## 2026-04-27 — Web app already shipped Stage 1 of mobile backend prep (commit afecf95)

**Problem.** Without inspection, you'd assume the web backend needs
significant changes for mobile (Bearer auth, native CORS, JSON tokens,
device push tokens). It does NOT — the user already shipped this.

**Fix.** Confirmed via `git show afecf95da2b144c8822bd9346d22078379d5ea86`
in the web repo. That commit added:

- `packages/server/src/middleware/auth.ts` — accepts
  `Authorization: Bearer <token>` alongside `access_token` cookie. Bearer
  is checked first.
- `packages/server/src/controllers/authController.ts` — `handleLogin`,
  `handleRefresh`, `handleMfaVerify` all return tokens in the JSON body
  as `{ user, tokens: { accessToken, refreshToken } }`. Native clients
  use this; web ignores and reads cookies.
- `handleLogout` and `handleRefresh` accept `refreshToken` in the request
  body for native clients.
- `index.ts` CORS allowlist extended to `https://localhost` and
  `capacitor://localhost`. Origin-less requests (RN fetch sends no
  Origin header) still allowed.
- New `device_token` table + `POST /api/notifications/register-device`
  endpoint (idempotent upsert keyed on `token_value`). For FCM later.

**Rule.** **Do NOT duplicate existing backend work.** Before designing any
backend change for mobile, search the web repo's git log for "mobile" or
"native" keywords (`git log --grep mobile -i`) and inspect the latest
auth-adjacent commits. Most of the heavy lifting is probably done.

---

## 2026-04-27 — Web backend's actual endpoint paths and response shapes (the source of truth)

**Problem.** When I wrote the mobile auth plan from generic React/Express
expectations, several details were wrong: I assumed `/auth/password-reset/request`
when actual is `/auth/forgot-password`, assumed flat `{ accessToken,
refreshToken }` when actual is nested `{ tokens: { accessToken,
refreshToken } }`, assumed register auto-logs-in when it doesn't.

**Fix.** Mobile authService MUST match these exact paths and shapes
(read directly from `packages/server/src/routes/auth.ts` +
`packages/server/src/controllers/authController.ts`):

| Mobile call           | Path (`/api` prefix mounted in `index.ts`) | Body                                         | Response shape                                                                                     |
| --------------------- | ------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `register`            | `POST /api/auth/register`                  | `{ name, email, password, guestToken? }`     | `{ userId, message, autoVerified }` (does NOT log in)                                              |
| `login` (no MFA)      | `POST /api/auth/login`                     | `{ email, password }`                        | `{ user, tokens: { accessToken, refreshToken } }`                                                  |
| `login` (MFA)         | same                                       | same                                         | `{ requiresMfa: true, mfaSessionToken }` (HTTP 200, NOT 202)                                       |
| `refresh`             | `POST /api/auth/refresh`                   | `{ refreshToken }`                           | `{ user, tokens: { accessToken, refreshToken } }` (refresh is **NOT rotated** — same one returned) |
| `logout`              | `POST /api/auth/logout`                    | `{ refreshToken }`                           | `{ message }`                                                                                      |
| `me`                  | `GET /api/auth/me` (Bearer)                | —                                            | `{ user }`                                                                                         |
| `verify-email`        | `GET /api/auth/verify-email?token=xxx`     | — (token in URL)                             | `{ message }`                                                                                      |
| `resend-verification` | `POST /api/auth/resend-verification`       | `{ email }`                                  | `{ message }` (always 200 — anti-enumeration)                                                      |
| `forgot-password`     | `POST /api/auth/forgot-password`           | `{ email }`                                  | `{ success: true, message }`                                                                       |
| `reset-password`      | `POST /api/auth/reset-password`            | `{ token, newPassword }` (password ≥8 chars) | `{ success: true }` (does NOT auto-log-in)                                                         |
| `mfa-verify`          | `POST /api/auth/mfa/verify`                | `{ mfaSessionToken, code }`                  | `{ user, tokens: { accessToken, refreshToken } }`                                                  |
| `settings (public)`   | `GET /api/settings/` (no auth)             | —                                            | `{ settings: ... }` (already public for login-page branding)                                       |

**Error codes from authController:**

- `EMAIL_EXISTS` → 409
- `INVALID_CREDENTIALS` → 401
- `EMAIL_NOT_VERIFIED` → 403
- `ACCOUNT_SUSPENDED` / `ACCOUNT_CANCELLED` → 403
- `INVALID_REFRESH_TOKEN` / `REFRESH_TOKEN_EXPIRED` → 401
- `INVALID_TOKEN` / `TOKEN_ALREADY_USED` / `TOKEN_EXPIRED` → 400 (verify-email)
- `INVALID_MFA_SESSION` → 401
- `INVALID_MFA_CODE` → 400
- Validation errors (Zod) → 400 with `{ error: <messages> }`

**Rule.** Mobile authService imports the **exact** paths and response shapes
from this table. Don't make them up. When a backend change happens (e.g.
new field), update this table FIRST so the mobile typings can be regenerated.

Idea for future: extract these as a shared TypeScript package (e.g.
`packages/shared/src/api-types.ts` in the web monorepo, exported as an
npm package or git submodule the mobile depends on). Until then, this
table is the contract.

---

## 2026-04-27 — Mobile backend integration is mostly client-side wiring; ONE new endpoint needed

**Problem.** The original plan estimated 1-3 new backend endpoints. Inspection
revealed the existing backend already covers everything mobile needs except
**Google Sign-In ID token verification** (the existing `/auth/google` +
`/auth/google/callback` is the OAuth code flow for browsers; mobile native
SDK gives an ID token directly).

**Fix.** Backend PR scope shrunk to ONE endpoint:

- `POST /api/auth/google/idtoken` — accepts `{ idToken }`, verifies with
  `google-auth-library`'s `OAuth2Client.verifyIdToken({ idToken, audience: ANDROID_CLIENT_ID })`,
  finds-or-creates the user, returns the same `{ user, tokens }` shape as
  `/api/auth/login`.

**Rule.** When integrating a new client (mobile, CLI, third-party),
**audit existing endpoints first**. Most of the time the heavy lifting is
done; the new endpoint count is much smaller than feared. Web→mobile is
~95% reusable on the backend per this project's experience.

---

## 2026-04-27 — Web app monorepo layout (cc-culinaire-kitchen)

**Problem.** Knowing where things live in the web repo accelerates every
backend change.

**Fix.** Layout for reference:

```
cc-culinaire-kitchen/
├── packages/
│   ├── client/          React 19 + Vite frontend
│   ├── server/          Express v5 + Drizzle + Postgres backend
│   │   └── src/
│   │       ├── routes/             Express routers (auth.ts, settings.ts, etc.)
│   │       ├── controllers/        Request handlers (authController.ts, etc.)
│   │       ├── services/           Business logic (authService.ts, etc.)
│   │       ├── middleware/         auth.ts (Bearer + cookie), upload.ts, etc.
│   │       ├── db/                 schema.ts (Drizzle), migrations/
│   │       ├── models/             Domain types
│   │       ├── utils/              env.ts (CLIENT_URL etc.), helpers
│   │       └── test/               Tests
│   └── shared/          Shared types (could host shared API types later)
├── prompts/             AI prompts
├── docs/
├── tasks/
├── package.json         Root (Turbo + pnpm workspaces)
├── pnpm-workspace.yaml
└── railway.toml         Railway deployment config (= backend hosted on Railway)
```

**Stack details:**

- Express v5, jsonwebtoken + bcrypt for auth, Zod for validation,
  pino for logging.
- Drizzle ORM v0.38 + Postgres. User table is `user` (camelCase columns).
  Sensitive fields AES-256-GCM encrypted at rest.
- OAuth via `google-auth-library` (existing handler).
- Stripe billing already integrated.
- Backend runs on **Render** (configured via Render dashboard, no IaC
  config in repo). Note: `railway.toml` exists at the web repo root but
  is **stale leftover** from a previous Railway deployment — do NOT use
  it as evidence of the current deploy target. Confirmed by user
  2026-04-28.

**Rule.** When making backend changes, follow the existing path
conventions: routes → controllers → services. Validation in controllers
via Zod. Logging via pino with structured context (`logger.info({ userId,
... }, "message")`). Errors thrown from services as `Error` instances
with named codes (`throw new Error("INVALID_CREDENTIALS")`); controllers
switch on `err.message` to map to HTTP codes.

---

## 2026-04-28 — Module-level `process.env` reads in web authService capture undefined (init-order bug)

**Problem.** Added `verifyGoogleIdToken` to
`packages/server/src/services/authService.ts` with `process.env` reads
at module top-level:

```ts
const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // undefined!
```

Production smoke test against the deployed `/api/auth/google/idtoken`
returned 500 OAUTH_NOT_CONFIGURED, even though the existing browser
Google OAuth flow worked fine on the same server (proving
`GOOGLE_CLIENT_ID` IS present at runtime).

**Root cause.** `hydrateEnvFromCredentials()` in
`packages/server/src/services/credentialService.ts` populates
`process.env` from the DB at server startup — but it runs AFTER all
imports have resolved. By the time it runs, the module-level const
has already captured `undefined`, and stays `undefined` for the
lifetime of the process. JS const semantics: capture-once, never
re-evaluate.

The existing OAuth code knew about this trap and used a function getter:

```ts
// time rather than module-load time (when they may not yet be set).
function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID ?? '';
}
```

The comment is the warning. I missed it.

**Fix (commit on `fix/google-idtoken-lazy-env` branch in web repo).**
Replace const-at-module-load with function-at-call-time:

```ts
function getGoogleWebClientId() { return process.env.GOOGLE_CLIENT_ID; }
function getGoogleIosClientId() { return process.env.GOOGLE_IOS_CLIENT_ID; }

export async function verifyGoogleIdToken(idToken: string) {
  const audience = [
    getGoogleWebClientId(),
    getGoogleIosClientId(),
  ].filter((x): x is string => Boolean(x));
  ...
}
```

Behavior identical at call time; values are now read post-hydration.

**Rule.** **Anything in the web server (`packages/server/`) that reads a
DB-hydrated env var must do so at function-call time, not module-load
time.** This includes any new env-derived constant added to
`authService.ts`, `chatService.ts`, `stripeService.ts`, etc. — anything
that loads before `hydrateEnvFromCredentials()` runs.

The pattern is: write `function getX() { return process.env.X ?? ""; }`
and call `getX()` inside the function body that needs it. Never write
`const X = process.env.X` at module top level for any value listed in
`CREDENTIAL_REGISTRY` (those are the DB-hydrated ones).

Bootstrap-only env vars (`DATABASE_URL`, `CREDENTIALS_ENCRYPTION_KEY`,
`JWT_*_SECRET`) are safe at module load — they MUST be in `.env` since
they're needed BEFORE the DB connection is established.

---

## 2026-04-28 — Web backend uses DB-backed credentials (hydrated to process.env at startup)

**Problem.** Initial assumption was that secrets like `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` live in `.env` (the standard Express pattern). When
the user said "Google OAuth credentials are stored in the DB", I almost
designed a refactor to read from DB at request time. That would have been
duplicate work — the architecture already handles this elegantly.

**Fix.** Inspected the live DB and found `credential` table with category
`oauth` containing Google client ID/secret/callback URL (encrypted with
AES-256-GCM via `CREDENTIALS_ENCRYPTION_KEY` in .env). The function
`hydrateEnvFromCredentials()` in
`packages/server/src/services/credentialService.ts` runs at server
startup (called from `index.ts:338`):

```ts
export async function hydrateEnvFromCredentials(): Promise<void> {
  const rows = await db.select().from(credential);
  for (const row of rows) {
    const value = decrypt(row.credentialValue, row.credentialIv, row.credentialTag);
    process.env[row.credentialKey] = value;
  }
}
```

So **DB is the source of truth**; env is the runtime cache. Code that
reads `process.env.X` is reading a value that originated in the DB
(unless X exists in the env file as a fallback for keys not in the DB).
The `CREDENTIAL_REGISTRY` constant in the same file declares which keys
the Settings UI should expose for management. Categories live in
`CREDENTIAL_CATEGORIES`.

**Rule.** When adding a new server-read secret to the web repo:

1. Add the key to `CREDENTIAL_REGISTRY` so the UI can manage it (set
   `sensitive: false` for public values like client IDs that ship
   inside the mobile app, `sensitive: true` for secrets like client
   secrets and API keys).
2. The user populates the DB row via the Settings UI (or directly
   via psql for dev).
3. Code reads `process.env.X` as normal — the value is hydrated from
   DB at startup. No DB query needed at request time.
4. The `.env` file remains a fallback for keys not in the DB (and
   for bootstrap config like `DATABASE_URL` and
   `CREDENTIALS_ENCRYPTION_KEY` themselves, which obviously can't
   come from the DB they're used to read).

---

## 2026-04-28 — Inspecting the live web DB from a Node script (for diagnostics)

**Problem.** When uncertain how the web backend stores something
(e.g. "are Google OAuth credentials in env or DB?"), the answer is
in the live database. Pinging the user with hypothetical questions
wastes their time when one read-only SELECT would resolve it.

**Fix.** A local Node script using the web repo's existing
`dotenv` and `postgres` deps:

```js
// File at the WEB REPO ROOT (not in any package/) so module resolution works.
import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

try {
  const rows =
    await sql`SELECT credential_key, credential_category FROM credential ORDER BY credential_category`;
  for (const r of rows) console.log(r);
} finally {
  await sql.end();
}
```

Run with `cd cc-culinaire-kitchen && node _inspect.mjs`.

**Rules:**

- ALWAYS use a filename starting with `_` (e.g. `_inspect.mjs`). The
  web repo's `.gitignore` matches `/_*.mjs`, `/_*.ts`, `/_*.js` so
  these can't be accidentally staged. Delete after use.
- READ-ONLY ONLY. Use SELECT against `information_schema` and the
  user's tables. No INSERT/UPDATE/DELETE/DROP under any circumstance
  unless the user has explicitly authorized a specific change.
- NEVER echo secret-shaped column values to chat. Filter columns
  whose names match `/secret|password|token|key|hash|encrypted/i`
  before logging. Inspect SCHEMA + COUNT + non-secret columns.
- NEVER echo the `DATABASE_URL` value itself (or any part of it) in
  chat or logs.
- Connect with `{ max: 1, idle_timeout: 5, prepare: false }` to keep
  resource impact minimal.
- Run from the **web repo root** (not from `%TEMP%`) so `node_modules`
  resolution works against the user's installed deps. The repo's pnpm
  workspace hoists `postgres` and `dotenv` to root `node_modules`.
- Always `await sql.end()` in `finally` to release the connection.

This pattern saves a back-and-forth on every "how does the backend
store X" question. Use it freely for read inspection; ask the user
before any write.

---

## 2026-04-27 — Always inspect the backend before designing mobile auth (or any client-server integration)

**Problem.** I wrote a detailed mobile auth plan with several wrong
endpoint paths and response shapes because I didn't read the actual
backend code first — I extrapolated from generic Express patterns. Almost
shipped 30 minutes of code that wouldn't have integrated.

**Fix.** Spent ~5 min reading `routes/auth.ts` and `controllers/authController.ts`
in the web repo. Caught 5+ wrong assumptions:

- Tokens are nested under `tokens.{accessToken,refreshToken}`, not flat.
- MFA flag is `requiresMfa: true` on a 200, not a 202 with `challengeToken`.
- `mfaSessionToken` is the field name, not `challengeToken`.
- Routes are `/forgot-password`, `/reset-password`, `/resend-verification` (single-segment), not `/password-reset/request` etc.
- Register and reset-password do NOT auto-login.

**Rule.** Before writing any mobile API client function, read the
controller for the corresponding backend endpoint. The signatures + status
codes + error names are the contract. Generic best-practice patterns are
NOT a substitute. Cost of skipping this: hours of debugging mismatched
shapes during integration.

---

## 2026-04-27 — Reanimated worklets need `Easing` from `react-native-reanimated`, not `react-native`

**Problem.** `src/constants/theme.ts` imported `Easing` from `react-native` and
exported `motion.easing = Easing.bezier(0.2, 0.7, 0.2, 1)`. `CopperButton` and
`GhostButton` then passed `motion.easing` to Reanimated's `withTiming`, which
runs on the UI thread inside a worklet. Worklets can't call JS-thread
functions, so the app crashed with `[Reanimated] The easing function is not
a worklet. Please make sure you import Easing from react-native-reanimated.`
on first render of any screen using those buttons (welcome carousel slide 3).

**Fix.** Import `Easing` from `react-native-reanimated` in `theme.ts`. Keep
`Platform` import from `react-native` separately. One-line change.

**Rule.** Any value that ends up inside a Reanimated worklet (passed to
`withTiming`, `withSpring`, `useAnimatedStyle`, etc.) must come from
`react-native-reanimated` if it has a worklet-compatible counterpart. This
includes `Easing`, `runOnJS`, `interpolate`, `interpolateColor`. Prefer to
import these directly into the worklet file rather than threading them through
shared theme tokens, OR — if you do put them in tokens — comment the file so
future maintainers don't accidentally swap to `react-native` imports.

---

## 2026-04-27 — Drizzle Expo SQLite migrations need `babel-plugin-inline-import` AND `metro.config.js` sourceExts

**Problem.** Adding `.sql` to `metro.config.js`'s `sourceExts` makes Metro
_resolve_ `.sql` files, but Babel then tries to parse them as JavaScript and
throws `SyntaxError: Missing semicolon` at the first SQL token. The
generated Drizzle `migrations.js` does `import m0000 from './0000_*.sql'`
and expects `m0000` to be a string — but Metro alone can't make that happen.

**Fix.** Install `babel-plugin-inline-import` and add
`['inline-import', { extensions: ['.sql'] }]` to `babel.config.js` plugins
_before_ `module-resolver`. The plugin transforms the SQL import into a
string literal at compile time; Metro then bundles that string. Both
configs are required; neither alone works.

**Rule.** When integrating Drizzle on Expo SQLite, follow the _full_ recipe at
<https://orm.drizzle.team/docs/get-started/expo-new>: babel plugin +
metro.config.js sourceExts + drizzle.config.ts driver:'expo' + `useMigrations`
hook in `_layout`. Documenting only the metro.config.js change (as the eng
review did) is incomplete.

---

## 2026-04-27 — Metro caches stale Babel transforms across `babel.config.js` edits

**Problem.** After adding `babel-plugin-inline-import` to `babel.config.js`,
`pnpm android` still threw the same SQL parse error. Metro's on-disk
transform cache (`%TEMP%\metro-cache`) had the pre-fix failure cached and
served it on subsequent builds. `api.cache(true)` in `babel.config.js` makes
this worse by suppressing config-change invalidation.

**Fix.** Wipe four cache layers before re-running:

```powershell
Remove-Item -Recurse -Force "$env:TEMP\metro-cache" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:TEMP\haste-map-*" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue
```

Then `pnpm android`. Note: `pnpm android` does NOT accept `--clear` (that
flag is `expo start` only).

**Rule.** Whenever `babel.config.js`, `metro.config.js`, or any
`tsconfig`/`expo` config changes, wipe Metro + Babel + Expo caches before the
next build. Keep the four `Remove-Item` commands as a "metro-nuke.ps1" snippet
in the project root if this happens often.

---

## 2026-04-27 — `expo run:android` is the right script for projects with config plugins; `expo start --android` falls back to Expo Go

**Problem.** The default `pnpm android` script from `create-expo-app` is
`expo start --android`. With no `android/` folder yet, it falls back to
launching Expo Go, which can't host config-plugin-required modules
(`expo-secure-store`, `expo-sqlite`, etc.) and leaves the dev experience
broken in non-obvious ways.

**Fix.** In `package.json`, change scripts to:

```json
"start": "expo start --dev-client",
"android": "expo run:android",
"ios": "expo run:ios"
```

`expo run:android` runs `expo prebuild` (generates `android/`), Gradle build,
APK install, and Metro launch in dev-client mode. The `--dev-client` flag on
`start` makes Metro target the custom build, not Expo Go.

**Rule.** As soon as the project adds any Expo config plugin to `app.json`
(check the `plugins` array), drop `expo start --android` from the scripts and
use `expo run:android` exclusively. Expo Go is a beginner trap once you have
native customization.

---

## 2026-04-27 — `jest-expo` major version must match installed Expo SDK major

**Problem.** `pnpm add -D jest-expo` resolved to `jest-expo@55.0.16` while
`expo` was pinned at `~54.0.33`. Tests failed with the cryptic
`ReferenceError: You are trying to import a file outside of the scope of the
test code` from `expo/src/winter/runtime.native.ts`. The error message has
nothing to do with the actual cause (version skew between jest-expo and the
expo runtime).

**Fix.** Pinned `jest-expo@~54.0.17` and downgraded `jest@~29.7.0`. Tests
went from 0/8 suites running to 10/10 passing.

**Rule.** When installing `jest-expo`, always specify the major matching the
installed Expo SDK. The `~` range is required, e.g., `pnpm add -D
jest-expo@~54.0.0`. Same for `react-test-renderer` — pin to the exact `react`
version (currently 19.1.0).

---

## 2026-04-27 — Custom bottom sheet vs `@gorhom/bottom-sheet`

**Problem.** The design bundle's prototype implements bottom sheets as a
custom CSS slide-up panel (~50 lines, no gestures). Porting that directly to
React Native ships a `Sheet.tsx` that lacks drag-down-to-close, snap points,
focus trap, and keyboard avoidance — every gesture the user will eventually
demand.

**Fix.** During eng review, switched to `@gorhom/bottom-sheet`'s
`BottomSheetModal`. Wrapped the app root in
`<GestureHandlerRootView><BottomSheetModalProvider>`. Adds ~30KB to the
bundle but pays for itself the first time the user expects to drag a sheet
down to dismiss it.

**Rule.** When porting a web prototype's "bottom sheet", reach for
`@gorhom/bottom-sheet` first. Build custom only if the sheet is a single
ephemeral popover (kebab menu, etc.) where gesture handling isn't a feature.

---

## 2026-04-27 — Windows env vars don't propagate to running PowerShell sessions

**Problem.** After setting `ANDROID_HOME`, `JAVA_HOME`, and PATH via
`[Environment]::SetEnvironmentVariable(... 'User')`, the values were
correctly persisted to the user profile but invisible to the _current_
PowerShell process. `gradlew.bat` (spawned as a child of `pnpm android`)
inherited an empty `JAVA_HOME` and threw `Please set the JAVA_HOME variable
in your environment...`.

**Fix.** Refresh the in-session env from the persisted store:

```powershell
$env:ANDROID_HOME = [Environment]::GetEnvironmentVariable('ANDROID_HOME','User')
$env:JAVA_HOME    = [Environment]::GetEnvironmentVariable('JAVA_HOME','User')
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
```

Permanent fix: fully close + reopen the terminal host (VSCode, Windows
Terminal). Closing only the tab is not enough — the host process caches env
at launch.

**Rule.** After running any `[Environment]::SetEnvironmentVariable(... 'User')`,
either (a) instruct the user to close + reopen their terminal host
entirely, or (b) provide the in-session refresh snippet. Don't assume new
PowerShell windows opened from the same VSCode/Terminal session see the
new values — they don't.

---

## 2026-04-27 — Two-PowerShell-window workflow for React Native dev

**Problem.** Repeatedly running `pnpm start --dev-client`, then commandeering
that same terminal for `adb reverse --list`, `Test-NetConnection`, etc.
killed Metro every time. The dev client on the phone then threw "Unable to
load script" because Metro was no longer at `localhost:8081`.

**Fix.** Use two PowerShell windows side-by-side:

- **Window 1:** `pnpm start --dev-client`. Leave running. Never type into it
  except `r` (reload), `j` (debugger), `m` (toggle menu), or Ctrl+C to stop.
- **Window 2:** Everything else — `adb` commands, git, `pnpm test`,
  builds, etc.

**Rule.** Always treat the Metro terminal as sacred. Document this in the
project README under "Local Development" so new contributors don't repeat
the trap.

---

## 2026-04-27 — `adb reverse` resets on USB disconnect / phone reboot

**Problem.** Even with `adb reverse tcp:8081 tcp:8081` set up, the dev
client would lose Metro after the phone slept, was unplugged briefly, or
the app was force-closed. Reverse forwards are per-USB-session.

**Fix.** Re-run `adb reverse tcp:8081 tcp:8081` whenever the phone has been
disconnected or the workflow stalls. Verify with `adb reverse --list`
(should print `UsbFfs tcp:8081 tcp:8081`).

**Rule.** Wrap `adb reverse` into the `pnpm android` script as a pre-step
so it always fires after a build (or wait until needed and accept the
manual re-run pattern). For now, manual re-run is fine since `pnpm android`
already triggers a fresh adb session.

---

## 2026-04-27 — `expo-sqlite` web target needs `wa-sqlite.wasm` polyfill not bundled by default

**Problem.** Pressing `w` in Metro to "open web" failed with
`Unable to resolve module ./wa-sqlite/wa-sqlite.wasm` from
`node_modules/expo-sqlite/web/worker.ts`. The web target was scaffolded
automatically by `create-expo-app` and the wasm file is required for
SQLite-on-web but not shipped with `expo-sqlite@16`.

**Fix.** Removed the web target entirely from `app.json` (deleted the
`"web"` block) and removed the `web` script from `package.json`. The app is
Android-first per CLAUDE.md; web isn't a deliverable.

**Rule.** When `create-expo-app` scaffolds a web target you don't need,
strip it before any native module gets installed. Otherwise Metro
silently tries to bundle web on the side and surfaces unrelated errors
later. If web is ever a real target, follow Expo's
`expo-sqlite@web-bundling` setup for the wasm.

---

## 2026-04-27 — CLAUDE.md design section was speculative; user iterated on a real design that contradicted it

**Problem.** The original CLAUDE.md "Infection Virus Design Standard" section
(dark blacks, glass morphism, amber glows) was written speculatively before any
design existed. The user later iterated on a comprehensive design bundle
(`culinaire-kitchen-design-system`) with the opposite philosophy: paper cream,
copper accent, restrained motion, **explicitly no glassmorphism**. Implementing
naively against CLAUDE.md would have produced the wrong app.

**Fix.** Surfaced the conflict to the user. Confirmed the design bundle as
canonical. Rewrote CLAUDE.md's design section to "Editorial Design Standard —
Paper, Ink, Copper" referencing `src/constants/theme.ts` and
`docs/design/design-system.md` as the authoritative implementations.

**Rule.** When a design bundle is fetched and contradicts CLAUDE.md, surface
the conflict to the user before implementing. They almost always want the
bundle (it represents iterated taste, not a spec from blank slate). Update
CLAUDE.md as part of the same PR — don't leave it lying as future
misdirection.

---

## 2026-04-27 — `jest-expo` major version must match installed Expo SDK

**Problem.** `pnpm add -D jest-expo` resolved to `jest-expo@55.0.16` while
`expo` was pinned at `~54.0.33`. Tests failed with
`ReferenceError: You are trying to import a file outside of the scope of the
test code` from `expo/src/winter/runtime.native.ts`. The error message has
nothing to do with the actual cause (version skew between jest-expo and the
expo runtime).

**Fix.** Pinned `jest-expo@~54.0.17` and downgraded `jest@~29.7.0`. Tests
went from 0/8 suites running to 10/10 passing.

**Rule.** When installing `jest-expo`, always specify the major matching the
installed Expo SDK. The `~` range is required, e.g., `pnpm add -D
jest-expo@~54.0.0`. Same for `react-test-renderer` — pin to the exact `react`
version (currently 19.1.0).

---

## 2026-04-27 — Custom bottom sheet vs `@gorhom/bottom-sheet`

**Problem.** The design bundle's prototype implements bottom sheets as a
custom CSS slide-up panel (~50 lines, no gestures). Porting that directly to
React Native ships a `Sheet.tsx` that lacks drag-down-to-close, snap points,
focus trap, and keyboard avoidance — every gesture the user will eventually
demand.

**Fix.** During eng review, switched to `@gorhom/bottom-sheet`'s
`BottomSheetModal`. Wrapped the app root in
`<GestureHandlerRootView><BottomSheetModalProvider>`. Adds ~30KB to the
bundle but pays for itself the first time the user expects to drag a sheet
down to dismiss it.

**Rule.** When porting a web prototype's "bottom sheet", reach for
`@gorhom/bottom-sheet` first. Build custom only if the sheet is a single
ephemeral popover (kebab menu, etc.) where gesture handling isn't a feature.

---

## 2026-04-27 — Drizzle migrations need `.sql` in Metro sourceExts

**Problem.** `useMigrations(db, migrations)` from `drizzle-orm/expo-sqlite/migrator`
imports `.sql` files via the generated `migrations.js` index. By default Metro
won't bundle `.sql` files, and the import fails silently — migrations don't
run, app starts with an empty SQLite, queries throw "no such table".

**Fix.** Added `config.resolver.sourceExts.push('sql')` to `metro.config.js`.

**Rule.** Whenever `drizzle-kit generate` outputs a new dialect/driver
combination, verify the migrator's import path is bundled by the runtime.
For Expo, that means `.sql` in `metro.config.js`'s `sourceExts`. Add this
to the project README's "after pnpm install" checklist.

---

## 2026-04-27 — RN's `text-transform: uppercase` doesn't change the underlying string

**Problem.** Wrote a snapshot test:
`expect(getByText('EMAIL')).toBeTruthy()` for a `TextField` whose label was
"Email" with `textTransform: 'uppercase'`. Test failed because the underlying
text node is still `"Email"` — uppercase is a render-only transform.

**Fix.** Test against the source casing: `getByText('Email')`. Same applies
to any test that asserts on `Eyebrow`, `cardBadgeText`, `dividerLabel`, etc.

**Rule.** Tests assert against the JS string, not the rendered glyphs. If
the visual matters, snapshot it.

---

## 2026-04-28 — Cross-repo drift detection (Phase 1.5)

**Problem.** Mobile depends on the web backend's auth surface but the two
repos have no compile-time link. If web renames a field (`userEmail` →
`email`) or changes a status code (`200` for MFA → `202`), mobile builds
clean and breaks at runtime in production. The risk grows during parallel
dev between web and mobile.

**Fix.** Two automated guardrails wired into the workflow:

1. **`tasks/web-repo-pin.txt`** — last-verified web `main` SHA, checked
   into git. `scripts/check-web-drift.mjs` diffs current web HEAD against
   this pin and lists changes touching auth-surface paths
   (`packages/server/src/{routes,controllers,services}/auth*`,
   `db/schema/user*`, etc.). Wired into:
   - `pnpm android` / `pnpm ios` — blocks builds on drift.
   - `pnpm start` — warns but doesn't block dev iteration.
   - `pnpm check:web` — manual.
2. **`src/__tests__/contract/web-backend.contract.test.ts`** — hits the
   live deployed backend and asserts shapes + status codes still match
   `docs/architecture/web-backend-api.md`. Excluded from default
   `pnpm test`. Run with `pnpm test:contract` before deploys, after
   bumping the pin, and on a daily cron (when set up).

Workflow when drift is detected:

- Read the diff URL the script prints.
- If mobile is unaffected, `pnpm check:web -- --bump` to advance the pin,
  commit with a one-line note.
- If mobile IS affected, update `docs/architecture/web-backend-api.md` +
  `src/types/auth.ts` + `src/services/__errors__.ts` + relevant service
  code, then `pnpm test:contract` to confirm, then bump the pin.

**Rule.** Mobile is the consumer; web is the source of truth. Bump the
pin only after `pnpm test:contract` is green. Never edit
`tasks/web-repo-pin.txt` by hand without a corresponding doc/types
update — that defeats the alarm.

---

## 2026-04-28 — `https://culinaire.kitchen` apex strips Bearer auth on GETs (use `www`)

**Problem.** `https://culinaire.kitchen/api/auth/me` returned 401
"Authentication required" even with a valid fresh access token (just
issued by `/api/auth/login` to the same host). The middleware code is
correct — it accepts `Authorization: Bearer <token>` first, then falls
back to the `access_token` cookie. So the Bearer header was reaching
some middleware but not the one we expected.

Reproduction with `redirect: 'manual'`:

```
GET https://culinaire.kitchen/api/auth/me  ->  301
Location: https://www.culinaire.kitchen/api/auth/me
```

The apex 301-redirects to www. **Node fetch and browser fetch both strip
the `Authorization` header on cross-origin redirects** by design (security
default to prevent credential leakage to a domain the caller didn't
explicitly authorize). The retried request to www has no Bearer header,
so the `authenticate` middleware correctly returns 401.

POST endpoints don't redirect (would change semantics), so /login,
/refresh, /logout work against the apex. Only GETs surface the bug.
That's why our W1 smoke test (5/5 against apex) didn't catch this.

**Fix.** Use `https://www.culinaire.kitchen` everywhere mobile talks to
the backend. Updated:

- `src/constants/config.ts` default
- `.env.example` default
- `src/__tests__/contract/web-backend.contract.test.ts` default
- `docs/architecture/web-backend-api.md` base URL section + warning
- `tasks/web-repo-pin.txt` is unaffected (this is a config issue, not a
  web-side change)

**Rule.** Always point HTTPS clients at the canonical (post-redirect)
host directly. If you have an apex/www split, use the host that doesn't
redirect. Test GET-with-Bearer specifically — POST-only smoke tests
(like our original W1 smoke) miss this entire class of bug. The
contract test caught this because it exercised a real authenticated
GET; that's the value of having one in the suite.

Bonus rule: if you ever see "Authentication required" on a request you
KNOW has a valid token, run with `redirect: 'manual'` to check whether
a 3xx is silently eating your headers.

---

## 2026-04-28 — Adding `elevation` on TextInput focus tears down the Android IME session

**Problem.** TextField's `focused` style added `elevation: 2` to give the
field a "lifted" feel on focus. On Moto G86 (Android 14) this caused the
keyboard to flash open and immediately close every time the user tapped
a field. Logcat showed:

```
SHOW_SOFT_INPUT fromUser true       ← user taps, IME requested
showSoftInput view=ReactEditText
AssistStructure (autofill scan)
onCancelled PHASE_CLIENT_APPLY_ANIMATION
onRequestHide HIDE_SOFT_INPUT_CLOSE_CURRENT_SESSION fromUser false  ← THE KILL
hide ime, fromIme=true
onHidden
```

`HIDE_SOFT_INPUT_CLOSE_CURRENT_SESSION` is "the current input session is
closing" — typically because a new InputConnection is being created OR
the focused view's layout changed enough that Android tears down the
session. Adding `elevation` adds shadow padding which causes a 1–2px
layout shift, which the IME interprets as "the field's view has been
recreated" and closes the session.

(Tested first whether Android Autofill was the culprit by adding
`importantForAutofill="no"` — no fix. Then removed `elevation` from the
focused style — fixed instantly.)

**Fix.** Keep visual focus feedback to `borderColor` (and on iOS, shadow
props which don't affect layout). NEVER add `elevation` on focus on
Android. If you want a "lift" effect, use a transform (`scale`,
`translateY`) inside `react-native-reanimated` — those run on the UI
thread and don't trigger layout passes.

```ts
// BAD on Android:
focused: { borderColor: copper, elevation: 2 }

// GOOD:
focused: { borderColor: copper }
```

**Rule.** Any focus-state style on a TextInput must be layout-neutral on
Android — `borderColor`, `backgroundColor`, iOS `shadow*` props are
safe. Never `elevation`, never `margin`/`padding`/`borderWidth` changes
on focus. If you need a visual lift, animate via Reanimated transform,
not layout. Diagnose with `adb logcat --pid=$(adb shell pidof <pkg>)` and
look for `HIDE_SOFT_INPUT_CLOSE_CURRENT_SESSION` — that string is the
fingerprint.

---

## 2026-04-28 — Zustand selectors that return new array/object literals cause infinite re-renders

**Problem.** `useConversation` had:

```ts
const messages = useConversationStore((s) => (activeId ? (s.messages[activeId] ?? []) : []));
```

When `activeId` is null OR `s.messages[activeId]` is undefined, the
selector returns a fresh `[]` literal. Zustand uses `Object.is` to
compare selector results between renders. `[] !== []`, so Zustand thinks
the value changed, fires subscribers, re-renders the component. The
re-render runs the selector again, returning ANOTHER fresh `[]`, which
Zustand sees as changed again — infinite loop. React eventually throws
"Maximum update depth exceeded".

This bug only manifests once a component using the hook actually mounts
on a screen the user navigates to. In our case, post-login routing
landed on the chat screen for the first time, mounting `useConversation`
and `useAntoine` (both had the same pattern), and the loop fired.

**Fix.** Use a module-level constant for the empty-state value so all
selector calls return the same reference:

```ts
const EMPTY_MESSAGES: Message[] = [];

const messages = useConversationStore((s) =>
  activeId ? (s.messages[activeId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
);
```

**Rule.** A Zustand selector must return either:

1. A primitive (number/string/boolean) — Object.is on primitives is value
   equality.
2. A reference that's stable across renders — a value the store already
   stores (e.g. `s.messages[id]`), or a module-level constant.

NEVER `[]`, `{}`, `new Date()`, `Array.from(...)`, `Object.values(...)`,
or any expression that creates a new reference each call. If you need
derived data, either compute it AFTER the selector or use `useShallow`
from `zustand/shallow`. The dev-time tell: a screen that worked in
isolation suddenly throws "Maximum update depth exceeded" when mounted
behind another component that updates state. Search for selectors with
`?? []` or `?? {}` first.

---

## 2026-04-28 — `&&` and `||` have different precedence in cmd.exe vs bash

**Problem.** I wrote `package.json` `start` script as
`node scripts/check-web-drift.mjs || true && expo start --dev-client` —
intending the drift check to warn-but-not-block dev (`|| true` swallows
its non-zero exit), then run expo. In bash that's left-associative:
`((A || true) && B)` — always runs B.

In cmd.exe (which is what pnpm spawns scripts through on Windows), `&&`
binds tighter than `||`, so it parses as `A || (true && B)`. When A
succeeds (the common case), `||` short-circuits and B never runs. Result:
`pnpm start` printed the drift OK message and exited without ever
launching Metro. Took ~10 minutes of "no QR code" confusion to find.

**Fix.** Removed the warn-only chain entirely. The hard-blocking
`node scripts/check-web-drift.mjs && expo run:android` on `pnpm android`
still works (single `&&`, no precedence ambiguity) and is sufficient
because builds are when drift actually matters. Manual check via
`pnpm check:web` covers the warn-only use case.

**Rule.** Never chain `||` and `&&` in npm scripts that target Windows.
Either keep it to a single `&&` (works on both), or move the logic into
a small Node script that does its own conditional. `set -o pipefail` is
also unavailable in cmd, so don't rely on it.

---

## 2026-04-28 — Settled on Render `www` host as canonical; lessons compounded

**Summary of the four bugs that surfaced during the first real device
test of the email/password login flow against production:**

1. `https://culinaire.kitchen` apex 301-redirects to `www`. Fetch
   strips `Authorization` on cross-origin redirects → /auth/me 401.
   POST endpoints get the same redirect but lose the BODY (POST → GET
   on 301 per RFC 7231) → /auth/login returns "Invalid email or password"
   for valid creds. **Always use `https://www.culinaire.kitchen`.**
2. TextField `elevation: 2` on focus → Android keyboard flash-and-close.
3. `package.json` `start` chain → silently never launches Metro.
4. Zustand selectors returning `?? []` → infinite re-render on chat
   screen mount.

All four were caught in one device-test session. None were caught by
unit tests. Two were caught by the contract test suite (apex/www,
indirectly). The other two were device-only.

**Rule.** A device test catches an entire CLASS of bugs that no other
test layer catches: native module integration, redirects, render loops,
keyboard behavior, layout shifts, real-network behavior. **Always device-
test before claiming a phase is "done."** TypeScript clean + unit tests
green ≠ ships.
