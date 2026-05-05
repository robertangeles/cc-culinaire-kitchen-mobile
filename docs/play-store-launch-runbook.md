# Google Play Store launch runbook (Expo + React Native + EAS)

The end-to-end sequence for taking an Expo app from "code works on dev client" to "live on Google Play." Optimised against the actual hurdles encountered launching CulinAIre Kitchen Lite on 2026-05-05 — every section that says "do this" exists because not doing it cost a build cycle, a wait day, or a debugging detour.

Read top to bottom on a first launch. On subsequent launches, jump to the phase you're in.

---

## Phase 0 — Pre-flight checklist (must complete BEFORE any cloud build)

Every item below must be locked in or verified. Skipping these costs ~20 min of cloud-build time per landmine.

### 0.1 Decide and lock the production package name

The Android `package` is **immutable** once an AAB is uploaded to Play Console. Even deleting the listing doesn't free the namespace.

- Pattern: `com.{org}.{app}.{variant}` (e.g. `com.culinairekitchen.mobile.lite`)
- Avoid `com.anonymous.*` (Expo's default dev placeholder)
- If you plan a paid/pro fork later, leave headroom: `.lite`, `.pro` variants share the org/app prefix
- Edit `app.config.ts` → `android.package`, run `pnpm tsc` to verify

### 0.2 Decide developer-account type

| Type             | Identity verification                    | 12-tester / 14-day rule                                                                            | Notes                                         |
| ---------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Personal**     | Photo ID + face match (~24-72h)          | **Yes** — must run Closed Testing for ≥14 days with ≥12 opted-in testers before Production unlocks | What most solo devs use                       |
| **Organisation** | DUNS or equivalent business verification | No (exempt)                                                                                        | Faster path to Production but heavier upfront |

For personal accounts: identity verification can run in parallel with everything else, so submit it on day 1. The 14-day Closed Testing clock is the schedule-defining gate — no way around it.

### 0.3 Wire up EAS

```powershell
npx eas-cli login              # one-time
npx eas-cli init               # creates project on Expo, returns projectId
```

`eas init` does NOT auto-write the `projectId` to `app.config.ts` when the config is dynamic (TypeScript). Manually add:

```ts
extra: {
  eas: {
    projectId: '<uuid from eas init output>';
  }
}
```

Verify with `npx eas-cli project:info`.

### 0.4 Create `eas.json` with three profiles

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "android": { "buildType": "app-bundle" } }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./play-console-service-account.json",
        "track": "internal",
        "releaseStatus": "completed"
      }
    }
  }
}
```

`appVersionSource: "remote"` means EAS auto-increments versionCode in the cloud — you only manually bump the marketing `version` when meaningful.

Add `play-console-service-account.json` to `.gitignore`. Never commit this file.

### 0.5 Create + verify EAS environment variables

For every `EXPO_PUBLIC_*` env var the app reads, create it on EAS for both `preview` and `production` environments:

```powershell
npx eas-cli env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "<value>" --environment preview --visibility plaintext --scope project --non-interactive

npx eas-cli env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "<value>" --environment production --visibility plaintext --scope project --non-interactive
```

**Critical: verify the create succeeded. Do not assume.**

```powershell
npx eas-cli env:list --environment preview
npx eas-cli env:list --environment production
```

If either list comes back empty for a var you just created, the create silently failed (often due to interactive prompts the `--non-interactive` flag didn't catch). Re-run.

### 0.6 Generate the EAS keystore + capture SHA-1

EAS generates the keystore on first build. To get the SHA-1 fingerprint without triggering a build:

```powershell
npx eas-cli credentials -p android
```

Pick `production` profile → the credential summary shows MD5/SHA-1/SHA-256 fingerprints directly. Exit the menu after copying.

Record:

- **SHA-1 fingerprint** (e.g. `FA:B6:F2:...:81`) — needed for Google Cloud OAuth
- **Key Alias** (e.g. `151b9463...`) — informational

Same keystore is used across all build profiles by default, so the SHA-1 stays stable.

### 0.7 Register the package + SHA-1 in Google Cloud OAuth (Android client)

Only required if the app uses Google Sign-In.

1. Open https://console.cloud.google.com/apis/credentials in the project that owns your OAuth client IDs
2. Find the **Android** OAuth client (name typically ends with `Android`, type "Android")
3. Edit:
   - **Package name** → exact value from `app.config.ts:android.package`
   - **SHA-1 certificate fingerprint** → value from §0.6
4. Save. Google's note: changes can take up to 5 min to propagate

If the dev keystore + dev package are still registered there, **replace** them (a Web/Android OAuth client allows only ONE package + ONE SHA-1 each). Old dev installs lose Google Sign-In, which is fine if you've uninstalled them.

### 0.8 Publish the OAuth consent screen to Production mode

Google's OAuth consent screen has a publishing status: **Testing** (only whitelisted test users can sign in) or **In production** (any Google user). Production mode is required before public Play Store launch — but Internal/Closed Testing can run with consent screen still in Testing mode (just whitelist your testers as "test users").

Common landmines that block "Publishing status → In production":

- **Non-HTTPS URLs in any OAuth client.** Audit `Authorised JavaScript origins` and `Authorised redirect URIs` on the Web client. Delete every `http://` entry. Production callbacks must be `https://`.
- **OAuth consent screen scope review** for sensitive scopes (drive, gmail). Doesn't apply for plain `openid email profile` — those publish in one click.

### 0.9 Privacy policy + Data Safety + Account deletion URL

Three browser-accessible HTTPS pages (or three sections of a single page) the web backend must serve:

| URL               | Required because                                          |
| ----------------- | --------------------------------------------------------- |
| `/privacy`        | Required field in Play Console + linked from app          |
| `/terms`          | Linked from app + commonly required                       |
| `/delete-account` | Required since 2024 by Google's user data deletion policy |

The deletion page must do all three:

1. Reference your app or developer name
2. Show clear deletion steps
3. List what data is deleted vs kept, plus retention period

`mailto:` links don't pass review. Generic "see our privacy policy" doesn't pass review.

If the web backend uses a SPA architecture, ensure the Express server serves the SPA shell on `Accept: text/html` for any non-API path. Test with:

```powershell
Invoke-WebRequest -Uri "https://your-domain/privacy" -Headers @{ "Accept" = "text/html,application/xhtml+xml" }
```

A bare `Invoke-WebRequest` or `curl` (no Accept header) will appear to 404 even when the route is correct. **Always test SPA routes with a browser-like Accept header** — Google's Play Console reviewers run real browsers.

---

## Phase 1 — First preview build (smoke test)

Don't go straight to production AAB. A preview APK validates the entire build pipeline first, much cheaper to iterate.

```powershell
npx eas-cli build --profile preview --platform android
```

**Watch the first 5–10 lines of output.** Two confirmations to look for:

```
Resolved "preview" environment for the build.
Environment variables with visibility "Plain text" and "Sensitive" loaded from the "preview" environment on EAS: EXPO_PUBLIC_X, EXPO_PUBLIC_Y, ...
```

**If you see "No environment variables found" — STOP, cancel the build (Ctrl-C before answering the keystore prompt).** The env-var creation didn't take effect; rerun §0.5 verification. Don't burn the 20-min build cycle to find out the env var is missing on the device.

When prompted "Generate a new Android Keystore?" → answer **Y**. EAS generates and stores it server-side; recoverable through Expo support.

Build runs ~15–25 min. While it's running, do NOT do anything else that depends on the AAB existing — track-state in your todo list / runbook so you don't lose position.

When the build finishes:

1. Download the APK from the build URL
2. Install via `adb -s <device-serial> install -r <path-to-apk>`
3. Run the smoke test on a real physical device — emulators don't reproduce all behavioural quirks (Google Play Services SHA-1 check, Vulkan availability, scoped storage)

### Smoke test checklist

Order matters — fail fast on cheap things:

1. App opens, splash → login screen → ✅ build + signing + native modules registered
2. Email + password login → ✅ apiBaseUrl reachable, auth backend works
3. Google Sign-In → ✅ env var present, SHA-1 + package registered correctly
4. Model download (if applicable) → ✅ background download survives release-mode ProGuard
5. First model inference → ✅ release-mode JS bundle works, native bindings keep
6. Feedback / support flow → ✅ user can report issues to you

If Google Sign-In specifically errors:

- "Google sign in not configured" → env var is empty in the bundled app. Re-verify §0.5; you'll need a new build.
- `DEVELOPER_ERROR (10)` → SHA-1 / package name mismatch with the registered Android OAuth client. Re-verify §0.7. No rebuild needed; OAuth changes propagate in ~5 min server-side.

---

## Phase 2 — Play Console setup (parallel with later phases)

### 2.1 Developer account ($25 one-time)

https://play.google.com/console/signup. Pick the Google account that will:

- Receive payouts (even on free apps; future-proofs)
- Be the contact email shown publicly on the listing
- Own the organization

Identity verification (personal accounts) starts here. Submit on day 1; runs in parallel for 24–72h.

### 2.2 Create the app shell

Home → Create app. Fields:

- **App name** — exact display name from `app.config.ts:name`
- **Package name** — exact value from `app.config.ts:android.package` (immutable)
- **Default language** — match your i18n default; en-AU is acceptable, en-GB is acceptable, prefer either over en-US for non-US apps
- **App or game** — App
- **Free or paid** — switching free→paid is allowed; paid→free is **NOT** allowed
- All declaration checkboxes checked

Enrol in **Play App Signing** when prompted (the Play app signing ToS checkbox during create-app or first AAB upload). Google holds the upload key; if you ever lose access, Play Console support can recover it. Without this, a lost keystore means **the app can never be updated under that package name**.

### 2.3 Store listing assets

Required for any listing review (Closed Testing onward):

- **Short description** (≤80 chars) — one-line positioning, no marketing fluff
- **Full description** (≤4000 chars) — what the app does, who it's for, what it's NOT (medical/legal disclaimers if applicable)
- **App icon** (512×512 PNG, no transparency)
- **Feature graphic** (1024×500 PNG/JPEG)
- **Phone screenshots** — minimum 2, recommended 4–8. Min dimension 1080×1920. Real device captures via `adb shell screencap -p /sdcard/screen.png`.

Voice: match in-app voice. No emoji unless brand allows. Sentence case. Don't promise specific user outcomes ("become a better cook") — Google Play's policy frowns on outcome claims.

### 2.4 Data Safety form

Mandatory questionnaire under App content → Data Safety. Declare every API and permission:

- **Network access** — what data goes over the wire (auth tokens, subscription state, etc. — NOT conversation content if it stays on-device)
- **Storage** — what's stored on-device, what's stored on-server
- **No analytics SDK** — explicitly state if you don't track user behavior; this is a marketing differentiator for privacy-first apps
- **Crash reports** — declare even if you don't collect them (Play vitals are not "your collection")

Be honest. Google's privacy policy compliance team cross-checks declarations against actual app behaviour during review. Misdeclaration = listing rejection.

### 2.4-bis App content section (often-missed required forms)

Beyond Data Safety, Play Console requires several additional forms under **App content** before Closed Testing review can be submitted. None are technically hard, but each is a separate task that blocks the green check on the dashboard. Do them in this order:

#### Content Rating questionnaire

App content → Content Rating → Submit new questionnaire. Roughly 10-15 multiple-choice questions about violence, sexual content, drug references, gambling, user-generated content, etc. Answer truthfully — Google's automated checks compare answers against the actual app behaviour during review.

For a culinary AI: nearly all answers are "No" except "User-generated content" → "Yes" (users send chat messages) and possibly "Shares user data" depending on what your Data Safety form says.

#### Target audience and content

App content → Target audience and content. Pick the **age range** the app targets:

- For a serious-cook tool: **18 and older** is the cleanest pick — sidesteps the entire Designed-for-Families program and its stricter privacy / ad rules
- "Children" or "Mixed audience" pulls in COPPA + the kid-safe content rating, which can complicate Data Safety + ads declaration

#### Ads declaration

App content → Ads → "Does your app contain ads?" — for an ad-free app: **No**. Single click, save.

#### App category

Store settings → App category → pick from the dropdown:

- **Productivity** — culinary AI fits here cleanly
- "Food & Drink" exists but is biased toward restaurant directories / delivery / recipe browsers, not assistants
- "Education" works for instruction-heavy apps but understates the tool's day-to-day utility

#### Privacy policy URL (separate from Data deletion URL)

Store presence → Main store listing → Privacy policy URL. Same SPA route pattern as `/delete-account` — point at `https://your-domain/privacy`.

### 2.5 Account deletion URL

App content → Data deletion → "Delete account URL". Paste the public HTTPS URL from §0.9. Google reviewers click this URL during Closed Testing review; it must render in a browser and contain the three required elements.

### 2.6 Foreground service declaration (if app uses one)

If the AAB declares any `FOREGROUND_SERVICE_*` permission in its AndroidManifest, Play Console blocks the release at "Preview and confirm" with: "You must let us know whether your app uses any Foreground Service permissions."

Common sources of foreground service permissions:

- WorkManager + a long-running download (e.g. on-device model download via `withBackgroundDownload` plugin → declares `FOREGROUND_SERVICE_DATA_SYNC`)
- Media playback in the background
- Location tracking
- VoIP / call apps

The form asks you to categorise the use case. For each `FOREGROUND_SERVICE_*` type your AAB declares, pick the matching task category:

| Permission                          | Category options                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `FOREGROUND_SERVICE_DATA_SYNC`      | Network processing (Backing up/restoring; Other) OR Local processing (Media transcoding; Importing/exporting; Other) OR Other tasks (Other) |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | (declaration form for media)                                                                                                                |
| `FOREGROUND_SERVICE_LOCATION`       | (declaration form for location)                                                                                                             |

For "downloading user-initiated content from a remote server" (the common LLM-app case): pick **Network processing → Other**.

#### The demo video gotcha

**Every "Other" sub-option requires a publicly-accessible demo video URL.** The video must show:

1. The user initiating the foreground-service operation in-app
2. The persistent notification appearing
3. The notification persisting across app-switches / screen-locks (proof the FG service is doing real work)

Predefined sub-options like "Backing up, restoring" might NOT require a video, but they're misrepresentations of common use cases like "downloading model files" — Google reviewers may flag during review.

**Plan for the demo video as a Phase-0 task** (do it BEFORE the production AAB build cycle so it's not a last-minute scramble):

1. **Wipe app data** to enable a fresh trigger of the foreground service:
   ```powershell
   adb -s <serial> shell pm clear <package-name>
   ```
2. **Start screen recording via adb** (works on every Android 4.4+ device, no UI variance):
   ```powershell
   adb -s <serial> shell screenrecord --time-limit 60 /sdcard/fg-service-demo.mp4
   ```
   Note: `/sdcard/` on modern Android is the device's internal shared storage, not a physical SD card.
3. **Demonstrate the service in-app:** sign in → trigger the long-running operation → show the persistent notification → swipe home for 2-3 seconds to show notification persists → return to app
4. **Stop recording** with Ctrl-C in PowerShell (or wait for auto-stop at 60s)
5. **Pull the video to PC + clean up device:**
   ```powershell
   adb -s <serial> pull /sdcard/fg-service-demo.mp4 .\fg-service-demo.mp4
   adb -s <serial> shell rm /sdcard/fg-service-demo.mp4
   ```
6. **Upload to YouTube as Unlisted** — `https://youtube.com/upload`. Visibility: **Unlisted** (NOT Private — Private requires reviewer sign-in to view). Title doesn't matter; reviewers don't read it.
7. **Paste the YouTube URL** into the Play Console FG service declaration field

A 30–60 second video is plenty. The reviewer needs to verify the FG service is real and visible to the user, not a 5 GB download in full.

#### Long-term: build an in-app "re-trigger" affordance

Recording a fresh demo requires triggering the FG service from a clean state. If the only way to do that is `adb shell pm clear` (wiping all user data), that's brittle and slow. Add a Settings → "Re-download model" / "Reset model storage" button to the app — makes future demo recordings (for re-submissions or new permissions) painless.

---

## Phase 3 — Closed Testing release

### 3.1 Service account JSON for `eas submit`

Optional but cleaner than manual AAB uploads through Play Console.

1. Google Cloud Console → IAM → Service Accounts → Create
2. Name: `eas-submit-android` (or similar)
3. After creation: Add Key → JSON → download
4. Move the JSON to repo root (or any local path), reference in `eas.json:submit.production.android.serviceAccountKeyPath`
5. **Add to `.gitignore`**

Then in Play Console: Setup → API access → link the service account, grant "Release manager" or similar.

### 3.2 Set up the Closed Testing track

App → Testing → Closed testing → Create new track (defaults to "Alpha"). Three sub-tasks:

**Country/regions** — Select all (or specific markets). Closed testing is opt-in only; tester pool is what you control via the email list, not country.

**Testers** — Email lists OR Google Groups. Email lists is simpler for solo:

1. Click "Create email list"
2. Name it
3. Paste tester emails — **must be Google account email addresses.** Outlook, Yahoo, custom-domain non-Workspace emails all reject. The form shows a red ⚠️ next to invalid entries; you cannot save until they're removed.
4. Save

**Feedback URL** — `mailto:` link to your support inbox or a public web feedback form.

### 3.3 Production AAB build + upload

```powershell
npx eas-cli build --profile production --platform android
```

Same env-var verification check as preview build. ~15–25 min cloud build.

When done:

- Download the `.aab` from the build URL
- Closed testing track → **Create new release** → upload AAB

#### The release form

Three fields on the "Create new release" page:

1. **App bundles** — drag-and-drop the `.aab` into the drop zone, or click Upload. After upload, Play Console shows a metadata table (version, versionCode, API levels, target SDK, ABIs, required features, install size). Verify these match what you expect from the AAB.

2. **Release name** — internal-only label, max 50 chars. Convention: `<version> (<versionCode>) <descriptor>` e.g. `1.3.0 (1) Initial closed alpha`.

3. **Release notes** — wrapped in language tags. The placeholder `<en-US>...</en-US>` is just a format hint; replace with whatever language tag matches your default. For an en-AU default:
   ```
   <en-AU>
   Initial closed-test build of MyApp. (Brief description of what testers should see.)
   </en-AU>
   ```

Click **Next** to proceed to "Preview and confirm".

#### Preview and confirm — the gate that surfaces every missed declaration

This page lists ALL Errors / Warnings / Messages Google's automated checks found in the AAB. Common entries:

| Severity   | Message                                                                          | What it means                                                                                                              |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 🔴 Error   | "You must let us know whether your app uses any Foreground Service permissions." | AAB declares `FOREGROUND_SERVICE_*` in manifest; needs §2.6 declaration. **Blocks submission.**                            |
| 🟡 Warning | "There is no deobfuscation file associated with this App Bundle."                | R8/ProGuard mapping not uploaded; crash reports will be obfuscated. **Does NOT block submission.** Add to v1.4+ punchlist. |
| ℹ️ Message | Release delivery size                                                            | Informational only — install size, time to download                                                                        |

**Yellow warnings do not block submission.** Don't get distracted by them. Only red errors matter.

Once all errors are cleared, click **Save** at the bottom of Preview and confirm.

Or use `eas submit` to upload directly (skips the Play Console drag-and-drop):

```powershell
npx eas-cli submit --profile production --platform android --latest --track alpha
```

(`alpha` = closed testing track in Play Console terminology.)

### 3.4 Submit for review

Click "**Send for review**" on the release. Google's pipeline runs in two phases:

1. **Automated quick checks (~13 min)** — policy + quality scans. The Publishing Overview shows a "Running quick checks for commonly found issues" banner with a countdown. If anything's wrong with the AAB itself (missing declarations, manifest mismatches), this phase flags it.
2. **Human review (1–7 days for Closed Testing, often faster)** — listing copy, screenshots, Data Safety, the Account deletion URL, the Foreground Service demo video, all get audited.

#### Managed publishing on / off

Settings → Publishing overview → "Managed publishing." Two modes:

- **Off (default for Closed Testing):** approved changes auto-publish to the track immediately
- **On:** approved changes wait in a holding pen until you manually click "Publish"

For Closed Testing: leave **off** — you want testers to see the build the moment Google approves it. For Production launch: turning on lets you sync a marketing moment (press release, social post) with the actual go-live.

#### What you'll see in Publishing Overview

The "Changes in review" list shows EVERY pending change Google is reviewing in this submission, broken into categories:

- **Closed testing - Alpha:** the release itself + countries/regions + tester list + feedback channel
- **Store listings:** language(s), name, descriptions
- **App content:** Content Rating, Target audience, Privacy policy, Ads declaration, Data Safety
- **Store settings:** App category

If any of these are red-flagged with a "Submit new questionnaire" / "Complete X" action, the submission is incomplete — go back to that section, finish it, then re-submit. **Don't click "Remove changes" unless you actually want to pull the entire submission.**

---

## Phase 4 — The 14-day Closed Testing wait (personal accounts)

### 4.1 Recruit ≥12 opted-in testers

The 12-tester gate is enforced when you eventually click "Apply for production access". Until then, 5 testers is fine to start the test running.

"Opted-in" means: tester clicked the opt-in URL (Play Console gives you one), accepted as a tester in their Play Store, and the app shows up in their library. **Just being on the email list doesn't count toward the 12.**

#### Where to find 12 Google account email addresses

The single biggest stumbling block on this rule isn't policy — it's logistics. Each tester must have a real Google account (Gmail / Google Workspace), and they must be willing to accept an opt-in link. Realistic sources:

- **Yourself** — your primary Gmail + any alts you have (work, family, old accounts). 1-3.
- **Family** — anyone with a Gmail. They don't have to actually use the app; they just have to opt-in. 1-3.
- **Friends willing to install once** — same constraint. Maybe 2-4.
- **Domain-relevant communities** — for a culinary app: cooking subreddits, Discord servers, professional chef networks. Post a "wanting alpha testers" message after the AAB is up. 0-N depending on outreach.
- **Co-workers / fellow founders** — 1-3 if applicable.

**Filter for Gmail / Google Workspace upfront.** The Play Console form rejects any non-Google email with a red ⚠️ icon and won't save until they're removed. Outlook, Yahoo, custom domain emails NOT on Google Workspace all bounce. Save yourself the round-trip by asking each prospective tester for their Gmail directly.

Send testers:

- The opt-in link (Play Console → Closed testing → "How testers join your test")
- Brief instructions: "Open this link on your Android phone, tap Become a tester, then it'll show up in your Play Store within an hour. Free, no payment, you can drop out anytime."

### 4.2 What to do during the 14 days

- Monitor Play Console → Quality → Android vitals (crash-free rate, ANR rate)
- Triage tester feedback via `mailto:` or in-app feedback channel
- Bug-fix rebuilds — bump versionCode (auto-handled by `appVersionSource: "remote"`), promote new AABs to the same Closed track
- Polish store listing assets while reviewers haven't seen them yet
- Confirm Data Safety form is complete (Production review fails if it's not)

The 14-day clock pauses if you withdraw the release. Don't withdraw unless you're rebuilding from scratch.

---

## Phase 5 — Production submission

After 14 days + 12 opted-in testers + clean Vitals:

1. Closed testing → Apply for production access
2. Answer the questionnaire about the closed test (testers, duration, feedback)
3. Production track → Create new release → promote from Closed testing AAB
4. Submit for review
5. Wait 1–7 days for Google review
6. App goes live on Play Store

### Day-1 post-launch ops

- Watch Play Console → Quality → Android vitals
- Watch your feedback inbox
- Have a hotfix path ready (versionCode bump + rebuild + submit) for any P1 within 24h

---

## Common landmines (with fixes)

These each cost a real cycle on the CulinAIre Kitchen Lite launch. Listed by category.

### Build-cycle killers

| Symptom                                                                             | Root cause                                                                   | Fix                                                                                                    |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Build output: `No environment variables ... found for the "preview" environment`    | `eas env:create` silently failed earlier                                     | Re-run create + always verify with `eas env:list`                                                      |
| Build succeeds, app installs, Google Sign-In errors `not configured`                | `EXPO_PUBLIC_*` env var was empty at build time → fallback `''` baked in     | Confirm env var on EAS via `env:list`, rebuild                                                         |
| Google Sign-In errors `DEVELOPER_ERROR (10)`                                        | New EAS keystore SHA-1 not registered with Google Cloud OAuth Android client | Update Android OAuth client's SHA-1 + package name; propagation ≤5 min, no rebuild needed              |
| OAuth consent screen blocks "In production" status with HTTPS error                 | Old dev `http://localhost:*` entries still on Web client                     | Delete all `http://` entries from JavaScript origins + redirect URIs; replace prod URL with `https://` |
| Privacy / Terms / Delete-account URL appears to 404 from `curl`/`Invoke-WebRequest` | SPA fallback gated on `Accept: text/html`; default HTTP clients send `*/*`   | Test with browser-like Accept header (`Accept: text/html`); browsers always send the right header      |

### Play Console rejections

| Symptom                                             | Root cause                                                                  | Fix                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Tester email shows red ⚠️, save fails               | Email is not a Google account (Outlook, Yahoo, non-Workspace custom domain) | Remove rejected entries; ask the person for their Gmail / Google Workspace address instead         |
| Listing review fails citing "missing data deletion" | Account deletion URL placeholder not yet a real page                        | Web team must serve the page with the three required elements (app name, steps, data deleted/kept) |
| Production access denied                            | Less than 12 testers OR less than 14 days OR vitals below threshold         | Recruit more testers; wait the full 14 days; fix crash-rate issues                                 |

### Persona / model behaviour

| Symptom                                                      | Root cause                                                                                      | Fix                                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Model answers off-topic requests despite system prompt       | Small model (e.g. Gemma 4B) under-respects instructions; system prompt rules alone insufficient | Add few-shot examples of correct refusal; adjust example diversity to avoid over-correction |
| Model refuses everything including legitimate mixed requests | Few-shot pure-refusal examples leak into all mixed-content scenarios                            | Diversify examples: refuse-only, answer-then-redirect, answer-only                          |

### Process failures (the meta-lessons)

- **Always verify side effects of CLI commands.** `eas env:create` looks like it succeeded but didn't. `eas env:list` is the verification. Same applies to: `eas init` writing projectId, `eas credentials` actually persisting changes, etc.
- **When a single HTTP client reports 404, don't infer "route doesn't exist" without checking what the client sent.** A request without `Accept` headers is not the same request a browser makes. Test the actual consumer's behaviour.
- **Track in-flight async operations in a state file (TodoWrite, lessons.md).** Long-running cloud builds are easy to lose track of in conversation. Consult the state list before any action that depends on something that's queued.
- **Pre-flight every known failure mode before triggering an expensive operation.** Cloud builds cost time. Listing each known way the build can fail and verifying each one upfront beats discovering them sequentially.
- **Don't skip warnings just because the path can keep moving.** "No env vars found" was real signal that should have stopped the first build. Keeping moving cost two extra build cycles.

---

## Reusable command reference

```powershell
# Auth + project setup
npx eas-cli login
npx eas-cli init
npx eas-cli project:info

# Env vars
npx eas-cli env:create --name X --value "y" --environment preview --visibility plaintext --scope project --non-interactive
npx eas-cli env:list --environment preview
npx eas-cli env:list --environment production

# Builds
npx eas-cli build --profile preview --platform android        # smoke-test APK
npx eas-cli build --profile production --platform android     # production AAB
npx eas-cli build:list --platform android --status=in-progress
npx eas-cli build:list --limit 5 --platform android

# Credentials (read SHA-1, manage keystore)
npx eas-cli credentials -p android

# Submit
npx eas-cli submit --profile production --platform android --latest --track alpha    # alpha = Closed Testing
npx eas-cli submit --profile production --platform android --latest --track production

# Device install + launch
adb -s <device-serial> install -r <path-to-apk>
adb -s <device-serial> shell am force-stop <package-name>
adb -s <device-serial> shell monkey -p <package-name> -c android.intent.category.LAUNCHER 1

# Test SPA routes correctly (browser-like Accept header)
Invoke-WebRequest -Uri "https://domain/path" -Headers @{ "Accept" = "text/html,application/xhtml+xml" }
```

---

## Reference URLs

- Play Console: https://play.google.com/console
- Play Console signup: https://play.google.com/console/signup
- Google Cloud Console (OAuth + service accounts): https://console.cloud.google.com
- OAuth consent screen: https://console.cloud.google.com/apis/credentials/consent
- Expo / EAS dashboard: https://expo.dev
- Closed testing personal account rule: https://support.google.com/googleplay/android-developer/answer/14151465
