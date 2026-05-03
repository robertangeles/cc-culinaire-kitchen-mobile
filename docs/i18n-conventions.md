# i18n key naming conventions

## Style: hierarchical-namespaced

Translation keys are stable identifiers; English text lives in `src/locales/en.json`. Pick the key first, write the English second.

```ts
t('auth.signIn'); // good — stable identifier
t('chat.modelMissing'); // good — namespaced by screen
t('actions.retry'); // good — generic action

t('Sign in'); // bad — text-as-key doesn't survive copy edits
t('auth.btn1'); // bad — opaque key
```

Decided in /plan-eng-review (D5) on 2026-05-03. Switching styles later means re-extracting and re-translating every string × every shipped language. We commit to this convention now and stay disciplined.

## Top-level namespaces

The skeleton in `src/locales/en.json` defines the canonical eight. Everything goes inside one of these — don't add new top-levels without team agreement.

| Namespace    | What lives here                                                                                  | Examples                                                        |
| ------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `auth`       | Login, register, MFA, verify-email, forgot/reset password                                        | `auth.signInButton`, `auth.passwordLabel`, `auth.verifyTitle`   |
| `chat`       | Chat screen, composer, bubble, streaming UI, history sheet, kebab menu                           | `chat.composerPlaceholder`, `chat.greeting`, `chat.streaming`   |
| `settings`   | Settings tab, model management, Wi-Fi toggle                                                     | `settings.title`, `settings.wifiOnly`, `settings.signOutButton` |
| `errors`     | User-facing error messages from any layer (currently empty; populated as error paths surface UI) | `errors.networkOffline`, `errors.modelLoadFailed`               |
| `actions`    | Generic button labels reused across screens                                                      | `actions.cancel`, `actions.retry`, `actions.save`               |
| `chef`       | Antoine-specific UX copy — persona, model-load lifecycle, download messaging                     | `chef.movingIn`, `chef.downloadingBody`                         |
| `welcome`    | Pre-auth welcome carousel (the 3-slide intro shown before sign-up)                               | `welcome.slide1Title`, `welcome.getStarted`                     |
| `onboarding` | Post-auth onboarding flow (model-download screen with privacy callouts)                          | `onboarding.welcomeMessage`, `onboarding.privacy1Label`         |

If a string genuinely doesn't fit any of these, it's a sign the namespace list needs to grow. Surface it in the PR for discussion rather than inventing a one-off namespace.

**Brand marks are NOT translated.** Names ("Antoine"), product marks ("CulinAIre", "CulinAIre Kitchen", "LITE"), the "Kitchen" Caveat-script wordmark, and quantitative literals tied to product facts ("5.9 GB" in download buttons referring to the model file size) stay as literals in source. Only translatable copy goes through `t()`.

## Naming inside a namespace

Use **camelCase** for keys. Match the React component or feature name where possible.

```ts
t('auth.signIn'); // good
t('auth.signInButton'); // good — explicit when the same concept has multiple surfaces
t('auth.sign_in'); // bad — snake_case
t('auth.SignIn'); // bad — PascalCase
```

When the same concept appears in multiple places with different copy, suffix to disambiguate:

```ts
t('auth.signInButton'); // the button label: "Sign in"
t('auth.signInTitle'); // the screen title: "Sign in to CulinAIre Kitchen Lite"
t('auth.signInSubtitle'); // the supporting text under the title
```

## Variables / interpolation

Use the i18next named-variable syntax. Variables are surrounded by `{{}}`:

```ts
t('chat.greeting', { name: user.firstName });
// en.json: "greeting": "Welcome back, {{name}}."

t('chat.tokensRemaining', { count: 384 });
// en.json: "tokensRemaining": "{{count}} tokens left in this turn."
```

**Never concatenate translated strings.** `t('auth.welcome') + ', ' + user.name` makes translation impossible. Use a single template instead.

## Pluralization

Use i18next's plural suffix convention:

```ts
t('chat.messageCount', { count: messages.length });
// en.json:
//   "messageCount_one": "{{count}} message",
//   "messageCount_other": "{{count}} messages"
```

Don't write `${count} message${count !== 1 ? 's' : ''}` and call `t()` on the result. Other languages have more than two plural forms (Russian has four; Arabic has six). Let i18next handle it.

## When extracting strings (PR-B and beyond)

1. Pick the namespace.
2. Pick the camelCase key inside it. Be specific — if you find yourself writing `auth.text1`, stop and pick a better name.
3. Add the EN text to `src/locales/en.json`.
4. Replace the literal in the component with `t('namespace.key')`.
5. Don't update other languages' bundles — the eval-gated translation workflow (per /plan-ceo-review D6) handles those.

## Forbidden patterns

- **Concatenation:** never glue translated fragments together.
- **Conditional translations:** don't `t(condition ? 'a' : 'b')` — use a single key with a variable.
- **Inline JSX:** never `t('chat.welcome <strong>{{name}}</strong>')` — translators will break the markup. Use `<Trans>` from `react-i18next` for inline elements.
- **Translating data:** model names, file paths, version strings, etc. stay literal. Only **user-facing UI copy** is translated.

## Adding a new language

Every language we add ships **all eight namespaces** translated, reviewed by a fluent native speaker, in a single PR. We do not ship partial UI bundles. The partial-language banner exists for the case where the system PROMPT (Antoine's voice) hasn't been authored yet — never for missing UI chrome. Established when FR landed on 2026-05-03 with a French speaker reviewing in real-time, after a placeholder-only fr.json was rejected as user-hostile.

### Checklist for each new language

1. **Native-speaker reviewer in the loop.** A fluent speaker — ideally with culinary domain familiarity — reviews every string before merge. Not an LLM. Not "machine translation, we'll fix later." Real-time review during translation is preferred since it catches register and idiom issues at write time instead of bug time.

2. **Translate every namespace.** All eight: `auth`, `chat`, `settings`, `errors`, `actions`, `chef`, `welcome`, `onboarding`, plus any newer namespace added since this list (e.g. `foodSafety`). Do not leave English fallbacks in the new bundle's `_meta` comment as a hedge — if a string isn't ready, the language isn't ready.

3. **Preserve interpolation + `<Trans>` slots verbatim.** `{{name}}`, `{{count}}`, `<termsLink>...</termsLink>`, `<emailEm>{{email}}</emailEm>`, `<script>...</script>` — these are structural and must appear in the translation in the same form. The component reads them; translation only changes the text inside or around them.

4. **Apply the target language's typographic conventions.** This is the level of polish a native speaker notices and a non-native speaker doesn't. Examples from FR:
   - **Decimal separator:** `5,9` not `5.9`
   - **Unit names:** `Go` (gigaoctets) not `GB`
   - **Non-breaking space before `?`, `!`, `:`, `%`, `«»`** per French typography rules
   - Other languages have their own conventions (German capitalises every noun; Spanish uses inverted opening punctuation; Japanese has full-width characters). Ask the reviewer.

5. **Keep brand marks literal.** "Antoine", "CulinAIre Kitchen", "LITE", and the "Kitchen" Caveat-script wordmark stay verbatim in every bundle. They are names, not copy.

6. **Update `_meta.$comment`** in the new bundle to record: who reviewed, when, what scope. Not a guarantee, just a breadcrumb for the next person who opens the file.

7. **Update `SUPPORTED_LANGUAGES`** in `src/store/i18nStore.ts` and add the resource import in `src/i18n/index.ts`. The picker UI auto-extends; no other UI changes needed for chrome.

8. **`LANGUAGE_DISPLAY` row** in `src/components/chat/LanguagePickerSheet.tsx`. Native form + English form: `it: { native: 'Italiano', english: 'Italian' }`.

9. **Web side: per-language Antoine prompt.** Mobile chrome translation is independent of the system prompt, but the prompt must be authored + reviewer-signed + eval-passed before the language goes into the production `languages_enabled` feature flag. See `wiki/synthesis/in-flight.md` and `../cc-culinaire-shared-context/mobile-needs.md` for the cross-project handoff. Until the prompt lands, the language stays dev-only via the `__DEV__` picker override; it does not appear to production users.

10. **End-to-end device verification.** Walk every screen in the new language: welcome carousel, sign-up + sign-in + verify-email + forgot-password + reset-password + MFA, food-safety ack, onboarding download, chat (greeting, composer, kebab menu, history sheet, partial-language banner if forcing a missing prompt), settings (your kitchen, model states, cellular dialog). String overflow, line breaks, and missing-glyph fallbacks all surface here, not in code review.

### What "good" looks like — FR is the reference

When in doubt about how thoroughly to translate, scope, or polish: open `src/locales/fr.json` and match that bar. Look at the chef-line idioms ("Bon retour en cuisine.", "Pas de signal dans la chambre froide ? Toujours des réponses."), the typographic conventions, and the `_meta` comment. That's the standard.
