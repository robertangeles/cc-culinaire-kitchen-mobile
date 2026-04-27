# TODOs

Open follow-up work for CulinAIre Mobile, ordered by priority. Each entry
follows the format from the eng review: **What** / **Why** / **Pros / Cons /
Context** / **Effort** / **Depends on**.

---

## P1 — Real auth & subscription

### Wire real Google Sign-In via `@react-native-google-signin/google-signin`

- **What.** Replace the `googleSignIn` stub in `src/services/authService.ts`
  with real Google OAuth.
- **Why.** Without it, no real users can register.
- **Pros.** Unblocks real onboarding; lets us start collecting users.
- **Cons.** Requires Google Cloud Console setup + URL scheme + Play Console
  registration. ~1-2 hours of console clicking, not coding.
- **Context.** The `useAuth.googleSignIn` orchestration is already in place.
  Drop the real OAuth result into `setSession(user, token)` and the rest works.
- **Effort.** Human ~1 day / CC ~30 min.
- **Depends on.** Google Cloud project + Play Console setup.

### Wire real Google Play Billing via `react-native-iap`

- **What.** Add monthly + annual subscription SKUs. Verify on every app launch
  via the existing CulinAIre Kitchen backend.
- **Why.** Subscription gates model download per CLAUDE.md § "Subscription
  and Paywall". Without it, the paywall is mock-only.
- **Pros.** Makes the app monetizable.
- **Cons.** SKU registration + tax setup in Play Console is non-trivial.
- **Context.** No `subscriptionService.ts` yet. Build it in `src/services/`
  and wire `useSubscription` to gate the chat tab.
- **Effort.** Human ~3 days / CC ~1 hour (excluding Play Console setup).
- **Depends on.** Backend `/api/subscription/status` endpoint + Play SKUs.

### Integrate `llama.rn` and ship real `inferenceService`

- **What.** Replace the canned-response stub with `llama.rn` bindings.
  `import { initLlama, releaseAllLlama } from 'llama.rn'`.
- **Why.** This is the entire product. Antoine has to actually run.
- **Pros.** Privacy invariant becomes real (inference on device, no network).
- **Cons.** Native module setup needs an EAS build (Expo Go won't load
  `llama.rn`). Verify Expo SDK ↔ `llama.rn` version compatibility before
  pinning. New Architecture is required (already enabled in `app.json`).
- **Context.** The stub already matches `llama.rn`'s function signatures
  (`initLlama`, `completion`, `releaseAllLlama`). Swap-in is ~5 lines.
- **Effort.** Human ~3 days / CC ~2 hours (incl. EAS build).
- **Depends on.** Real `gemma-4-e4b-it.Q4_K_M.gguf` on device for testing.

### Implement real model download against the CDN

- **What.** Replace the `setInterval` ticker in
  `src/services/modelDownloadService.ts` with a real download via
  `expo-file-system`. Verify via SHA-256 checksum after download per
  CLAUDE.md security § "GGUF file integrity verified via checksum".
- **Why.** Users need to actually get the model on their device.
- **Pros.** Closes the onboarding loop end-to-end.
- **Cons.** 5.9 GB download needs pause/resume support. `expo-file-system`'s
  `createDownloadResumable` is the right tool.
- **Context.** The hook (`useModelDownload`) already returns `cancel()`, so
  swapping the service implementation is contained.
- **Effort.** Human ~2 days / CC ~1 hour.
- **Depends on.** CDN URL + checksum manifest from the backend team.

---

## P2 — Backend sync, second screen, full E2E coverage

### Zero-knowledge encrypted backup (cross-device history)

- **What.** Add an end-to-end encrypted backup service. Conversation content
  is encrypted client-side with a key derived from a recovery passphrase the
  user sets at first launch (Argon2id KDF), then synced to the backend as
  opaque AES-GCM ciphertext blobs. Server cannot decrypt.
- **Why.** With the current local-only architecture, a user installing on a
  new phone loses all conversation history because the privacy invariant
  (conversation content never leaves the device readably) prevents server-side
  storage. Zero-knowledge backup restores history continuity _without_
  weakening that invariant — the server stores opaque blobs it can't read.
- **Pros.** Users can switch devices without losing chats. Privacy posture
  unchanged (server still can't read content). Same proven model as Signal
  cloud backup, 1Password, Bitwarden.
- **Cons.** Lost passphrase = lost history (irrecoverable by design — that's
  the zero-knowledge guarantee). Needs careful UX: passphrase setup during
  onboarding, recovery prompts, key rotation, "I forgot my passphrase" flow
  that surfaces "your old chats are gone but the account is intact" honestly.
  Threat modeling required before shipping (key derivation params, blob
  format, replay attacks, server-side enumeration risks).
- **Context.** Decided 2026-04-27. Local-only ships first to keep privacy
  positioning the product. Settings screen now displays "Conversations stay
  on this device." so users understand the trade-off before reinstalling.
  The existing `ckm_conversation.is_synced` and `synced_dttm` columns can be
  repurposed to track "encrypted backup uploaded" without a schema change.
  Pair with the existing P2 `/api/conversations/sync` work — encrypted backup
  rides the same endpoint with a different blob shape.
- **Effort.** Human ~5 days incl. security review + threat model / CC ~4
  hours.
- **Depends on.** Backend endpoint accepting opaque encrypted blobs +
  passphrase-set UX in onboarding + decision on what counts as "lost
  passphrase recoverable" (e.g. shamir secret sharing across trusted
  contacts? Apple keychain integration? Just "warn loudly"?).

### Backend `/api/conversations/sync` (metadata only)

- **What.** Add a `src/services/syncService.ts` that periodically POSTs
  conversation **metadata** (id, createdAt, updatedAt, deviceId,
  messageCount) to the backend. **Never content.**
- **Why.** Multi-device awareness — user sees their conversation list across
  devices, even though content stays per-device.
- **Pros.** Cross-device UX without leaking conversation content.
- **Cons.** Adds a sync state machine + conflict resolution. Per
  CLAUDE.md § "Privacy Rules — Non-Negotiable", this needs a code review
  pass focused on the privacy invariant.
- **Context.** The schema already has `is_synced` and `synced_dttm` columns
  on `ckm_conversation`. The service just needs to find unsynced rows and
  POST.
- **Effort.** Human ~3 days / CC ~1.5 hours.
- **Depends on.** Backend endpoint + `deviceId` provisioning.

### Recipe detail screen (chat action chip target)

- **What.** Build `app/(tabs)/recipe/[id].tsx` for "See recipe" action chips
  in chat replies.
- **Why.** Chat already returns "See recipe" suggestions per the design
  bundle's microcopy examples. Tapping them currently goes nowhere.
- **Pros.** Closes a known UX dead-end.
- **Cons.** Recipe data model isn't defined yet — needs a `ckm_recipe` table
  - ingredient table + steps. Decision: derive recipes from chat replies (LLM
    parses its own output) vs. seed from a recipe library.
- **Effort.** Human ~5 days / CC ~3 hours.
- **Depends on.** Recipe data model decision + on-device LLM parsing reliability.

### Detox E2E suite

- **What.** Set up Detox + write E2E for: (1) Welcome → Login → Onboarding →
  Chat happy path, (2) Logged-out user typing `/(tabs)/chat` redirects to
  welcome (tests the route guard), (3) Welcome → Skip → Chat empty state.
- **Why.** Integration tests catch most issues but the route guard + native
  navigation only really run under E2E.
- **Pros.** Confidence in cold-start + redirects.
- **Cons.** Detox setup is ~half a day of YAML and gradle config. Adds CI
  cost.
- **Effort.** Human ~3 days / CC ~2 hours.
- **Depends on.** EAS build infra (Detox needs a real APK, not Expo Go).

---

## P3 — Polish

### EN/ES translation strings + `i18n-js` wiring

- **What.** Wire `i18n-js` + extract all UI strings to JSON. Add Spanish
  translations for back-of-house teams.
- **Why.** The kebab menu already has an "EN" trailing badge — but flipping
  it does nothing.
- **Effort.** Human ~3 days / CC ~2 hours (incl. translation strings).

### Dark "service" mode for low-light kitchen use

- **What.** Port the bundle's `service` variant from `ChatScreenV2.jsx` —
  high-contrast ink-on-paper for a busy line.
- **Why.** The user explicitly designed this variant. Ports cleanly into a
  theme switcher.
- **Effort.** Human ~2 days / CC ~1 hour.

### Tablet / kitchen-display layout

- **What.** Two-pane dense layout for line-side iPad (history left,
  conversation right).
- **Why.** Bundle README mentions it as a "next step you could take".
- **Effort.** Human ~1 week / CC ~3 hours.

### Voice / push-to-talk via `expo-audio` + on-device STT

- **What.** Replace the PTT UI mock with real audio capture. STT via
  on-device `whisper.rn` (or stubbed when unavailable — never cloud STT
  per CLAUDE.md privacy rules).
- **Why.** "Line cooks have wet hands" — voice is in the design intent.
- **Effort.** Human ~5 days / CC ~3 hours.
