# Web Backend API Contract

This document is the **authoritative contract** between the mobile app
(this repo) and the CulinAIre Kitchen web backend
(<https://github.com/robertangeles/cc-culinaire-kitchen>) deployed at
<https://culinaire.kitchen>.

**Why this document exists:** the mobile app derives its TypeScript types
and `apiClient` calls from these shapes. Mismatches between mobile types
and actual web responses cause silent bugs that only surface during
end-to-end testing. This file is the agreement; if web changes, this file
updates first, then mobile follows.

**Source of truth (in this order):**

1. `packages/server/src/db/schema.ts` (web repo) — Drizzle schema, real DB types
2. `packages/server/src/controllers/authController.ts` (web repo) — request handlers, real response shapes
3. `packages/server/src/services/authService.ts` (web repo) — business logic, error codes, `AuthUser` shape
4. `packages/server/src/routes/auth.ts` (web repo) — route mount paths

If anything in this document conflicts with those files, **the source files win** and this document is stale — update it.

---

## Base URL

| Env        | URL                         |
| ---------- | --------------------------- |
| Production | `https://culinaire.kitchen` |
| Local dev  | `http://localhost:3009`     |

All API paths below are prefixed with `/api`. So `/auth/login` = `https://culinaire.kitchen/api/auth/login`.

---

## The `AuthUser` shape (returned everywhere as `user`)

Every endpoint that returns `{ user, ... }` returns this exact shape.
Source: [`packages/server/src/services/authService.ts`](https://github.com/robertangeles/cc-culinaire-kitchen/blob/main/packages/server/src/services/authService.ts) `interface AuthUser`.

```ts
interface AuthUser {
  userId: number; // integer PK, NOT a string
  userName: string; // display name
  userEmail: string; // lowercase canonical
  emailVerified: boolean; // false until they click the email link
  mfaEnabled: boolean;
  userPhotoPath: string | null;
  freeSessions: number; // chat session quota for free tier
  subscriptionStatus: string; // "active", "trial", "cancelled", etc.
  subscriptionTier: string; // "free", "monthly", "annual", etc.
  userStatus: string; // "active", "suspended", "cancelled"
  roles: string[]; // e.g. ["Subscriber"]
  permissions: string[]; // RBAC permission slugs
}
```

**Mobile-side mirror lives at:** `src/types/auth.ts` — the existing
`User` type there (`{ id, email, displayName? }`) is a stub from
scaffold time. **Phase 2 must replace it with this exact shape** so all
the screens render full subscription/role state.

---

## Auth endpoints

All under `/api/auth/`. See [`packages/server/src/routes/auth.ts`](https://github.com/robertangeles/cc-culinaire-kitchen/blob/main/packages/server/src/routes/auth.ts).

### POST `/api/auth/register`

Create a new account. **Does NOT auto-log-in** — user must verify email
(if `RESEND_API_KEY` configured) then call `/login` separately.

**Request:**

```ts
{
  name: string;        // min 1, max 100
  email: string;       // valid email
  password: string;    // min 8, must contain uppercase + number
  guestToken?: string; // UUID, for linking guest conversations
}
```

**Response 201:**

```ts
{
  userId: number;
  message: string; // "Registration successful. Please verify your email to log in." (or "...You can now log in.")
  autoVerified: boolean; // true if RESEND_API_KEY is unset (dev mode)
}
```

**Errors:**

- `400` — Zod validation failed: `{ error: "<message>. <message>." }`
- `409` — `EMAIL_EXISTS`: `{ error: "An account with this email already exists." }`
- `500` — `{ error: "Registration failed: <reason>" }`

---

### POST `/api/auth/login`

Email + password sign-in. Two response paths: normal auth, or MFA challenge.

**Request:**

```ts
{
  email: string; // valid email
  password: string; // min 1 (no length validation; backend bcrypts)
}
```

**Response 200 (no MFA):**

```ts
{
  user: AuthUser;
  tokens: {
    accessToken: string; // JWT, 1-hour TTL
    refreshToken: string; // 7-day TTL
  }
}
```

**Response 200 (MFA required) — same status code, different shape:**

```ts
{
  requiresMfa: true;
  mfaSessionToken: string; // pass to /auth/mfa/verify
}
```

**Important:** mobile's `authService.login` must check
`if ('requiresMfa' in response)` before treating it as a tokens response.
**NOT a 202; status code is 200 in both branches.**

**Errors:**

- `400` — Zod validation failed
- `401` — `INVALID_CREDENTIALS`: `{ error: "Invalid email or password." }`
- `403` — `EMAIL_NOT_VERIFIED`: `{ error: "Please verify your email before logging in." }`
- `403` — `ACCOUNT_SUSPENDED`: `{ error: "Your account has been suspended." }`
- `403` — `ACCOUNT_CANCELLED`: `{ error: "Your account has been cancelled." }`

---

### POST `/api/auth/logout`

Revoke a refresh token server-side + (for cookie clients) clear cookies.

**Request:**

```ts
{
  refreshToken: string;
} // mobile sends in body; web flow uses cookie
```

**Response 200:**

```ts
{
  message: string;
} // "Logged out successfully."
```

Cookie clients can omit body. Mobile MUST send `refreshToken` in body so
the server can revoke the row in the `refresh_token` table.

---

### POST `/api/auth/refresh`

Issue a new access token using the refresh token. **The refresh token is
NOT rotated** — same one comes back. (Differs from many OAuth specs.)

**Request:**

```ts
{
  refreshToken: string;
} // mobile sends in body
```

**Response 200:**

```ts
{
  user: AuthUser;
  tokens: {
    accessToken: string;
    refreshToken: string; // same value as request, NOT rotated
  }
}
```

**Errors:**

- `401` — no refresh token provided OR `INVALID_REFRESH_TOKEN` OR `REFRESH_TOKEN_EXPIRED`: `{ error: "Session expired. Please log in again." }`

Mobile's apiClient should: on 401 from any endpoint → call `/refresh` →
on success retry original request → on failure force `signOut()`.

---

### GET `/api/auth/me`

Returns the current user. **Requires `Authorization: Bearer <accessToken>`.**

**Response 200:**

```ts
{
  user: AuthUser;
}
```

**Errors:**

- `401` — invalid/missing access token

Mobile uses this for the "I verified, continue" button on the verify-email
screen (re-fetch to see if `emailVerified` flipped to `true`).

---

### GET `/api/auth/verify-email?token=xxx`

Verifies a user's email via the link token. Called from a browser when
the user clicks the link in the verification email.

**Response 200:** `{ message: "Email verified successfully. You can now log in." }`

**Errors:**

- `400` — `INVALID_TOKEN`, `TOKEN_ALREADY_USED`, `TOKEN_EXPIRED`

For mobile: when the user clicks the email link on their phone, deep
linking can route them back into the app (scheme:
`ccculinairekitchenmob://`) — but easiest path is to let the browser
hit this endpoint, then have the user tap "I verified, continue" in the
mobile app which calls `GET /auth/me` to confirm.

---

### POST `/api/auth/resend-verification`

Resend the verification email. Always returns success to prevent email
enumeration.

**Request:**

```ts
{
  email: string;
}
```

**Response 200:**

```ts
{
  message: string;
} // "If an account exists with this email, a verification link has been sent."
```

**Errors:**

- `400` — `ALREADY_VERIFIED`: `{ error: "This email is already verified." }`

---

### POST `/api/auth/forgot-password`

Initiates a password reset. Always returns success to prevent enumeration.

**Request:**

```ts
{
  email: string;
} // valid email
```

**Response 200:**

```ts
{
  success: true;
  message: string; // "If that email is registered, a reset link has been sent."
}
```

---

### POST `/api/auth/reset-password`

Submits a new password using the token from the reset email.
**Does NOT auto-log-in** — user must call `/login` after.

**Request:**

```ts
{
  token: string; // min 1, from email link
  newPassword: string; // min 8
}
```

**Response 200:**

```ts
{
  success: true;
}
```

**Errors:**

- `400` — Zod validation
- `400` — `Invalid or expired reset token`: `{ error: "Invalid or expired reset token" }`

---

### POST `/api/auth/mfa/verify`

Completes MFA login after `/login` returned `requiresMfa: true`.

**Request:**

```ts
{
  mfaSessionToken: string; // from /login response
  code: string; // 6-digit TOTP from authenticator app
}
```

**Response 200:**

```ts
{
  user: AuthUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
  }
}
```

**Errors:**

- `400` — missing fields: `{ error: "MFA session token and code are required." }`
- `400` — `INVALID_MFA_CODE`: `{ error: "Invalid code. Please try again." }`
- `401` — `INVALID_MFA_SESSION`: `{ error: "MFA session expired. Please log in again." }`

---

### POST `/api/auth/google/idtoken` (NEW — added by W1, deployed)

Mobile native Google Sign-In flow. The Android SDK
(`@react-native-google-signin/google-signin`) returns an ID token whose
audience is the Web Client ID; the backend verifies it with
`google-auth-library` and returns our app's JWT pair.

**Request:**

```ts
{
  idToken: string;
} // from GoogleSignin.signIn().data.idToken
```

**Response 200:**

```ts
{
  user: AuthUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
  }
}
```

**Errors:**

- `400` — Zod validation: `{ error: "idToken is required" }`
- `401` — `Invalid Google ID token.` (verification failed via google-auth-library)
- `401` — `Google account email is not verified.`
- `500` — `Google sign-in is not configured on this server.` (no `GOOGLE_CLIENT_ID` populated)

---

## OAuth (browser flow — NOT used by mobile)

These exist for the web app and are NOT relevant to mobile:

- `GET /api/auth/google` → redirects to Google consent screen
- `GET /api/auth/google/callback?code=xxx` → handles the OAuth code, sets cookies, redirects to `/chat/new`

Mobile uses `POST /api/auth/google/idtoken` instead (native flow).

---

## MFA management (post-login, requires `Bearer` access token)

These let an authenticated user set up TOTP for their account. Not
strictly part of v1 mobile auth (mobile only consumes the existing MFA
challenge flow), but listed here for completeness.

- `POST /api/auth/mfa/setup` — generates a TOTP secret + QR code data URL.
- `POST /api/auth/mfa/enable` — verifies the first TOTP code and enables MFA.
- `POST /api/auth/mfa/disable` — disables MFA.

---

## Settings

- `GET /api/settings/` — public, returns `{ ... }` of branding settings (page title, tagline, theme colors, logo paths, etc.). Mobile can fetch this post-login to hydrate runtime config.

---

## Notifications (mobile-prep already in place)

Added by web commit `afecf95` (Stage 1 of the mobile pivot):

- `POST /api/notifications/register-device` — authenticated. Mobile registers an FCM device token; backend upserts to `device_token` table. FCM dispatch deferred until needed.

---

## Auth headers

All authenticated endpoints accept tokens two ways:

1. `Authorization: Bearer <accessToken>` — preferred for mobile.
2. `Cookie: access_token=<accessToken>; refresh_token=<refreshToken>` — used by web.

Bearer is checked first. Mobile should always use Bearer; never set cookies.

---

## Mobile apiClient implementation notes (for Phase 1)

- Set `Content-Type: application/json` on every POST.
- Inject `Authorization: Bearer ${authStore.accessToken}` if a token exists.
- On 401 from any endpoint (except `/auth/refresh` itself): single-flight
  call to `/auth/refresh` → on success retry original → on failure call
  `authStore.signOut()` and reject with `AuthError`.
- Normalize error responses: backend returns `{ error: string }` — wrap
  into a typed `ApiError { status, message }`.
- The MFA flow is special: `/auth/login` returning `requiresMfa: true`
  is NOT an error. authService should detect this and throw a typed
  `MfaRequiredError({ mfaSessionToken })` for the screen to catch and
  navigate to `/mfa`.
- The email-verif flow is also special: `/auth/login` returning 403
  `EMAIL_NOT_VERIFIED` should throw `EmailNotVerifiedError({ email })`
  for the screen to catch and navigate to `/verify-email`.

---

## Last verified

- 2026-04-28 — Web W1 + hotfix W1.1 deployed; smoke test 5/5 passing
  against production. AuthUser shape, all auth endpoint paths +
  request/response shapes confirmed by reading source files.
