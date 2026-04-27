# Lessons

Self-improvement loop per CLAUDE.md § "Self-Improvement Loop". Format:
**Problem** / **Fix** / **Rule**.

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
