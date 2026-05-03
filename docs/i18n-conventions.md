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

The skeleton in `src/locales/en.json` defines the canonical six. Everything goes inside one of these — don't add new top-levels without team agreement.

| Namespace  | What lives here                                                | Examples                                                              |
| ---------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| `auth`     | Login, register, MFA, verify-email, forgot/reset password      | `auth.signIn`, `auth.passwordRequired`, `auth.verifyEmailHeader`      |
| `chat`     | Chat screen, composer, bubble, streaming UI, history sheet     | `chat.composerPlaceholder`, `chat.modelMissing`, `chat.greeting`      |
| `settings` | Settings tab, kebab menu, model management, language picker    | `settings.title`, `settings.language`, `settings.signOut`             |
| `errors`   | User-facing error messages from any layer                      | `errors.networkOffline`, `errors.modelLoadFailed`, `errors.tryAgain`  |
| `actions`  | Generic button labels reused across screens                    | `actions.retry`, `actions.cancel`, `actions.save`, `actions.continue` |
| `chef`     | Antoine-specific UX copy — persona, model loading, brand voice | `chef.loaded`, `chef.warming`, `chef.streaming`                       |

If a string genuinely doesn't fit any of these, it's a sign the namespace list needs to grow. Surface it in the PR for discussion rather than inventing a one-off namespace.

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
