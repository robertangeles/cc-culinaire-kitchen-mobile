/**
 * Typed error classes for API + auth flows.
 *
 * The mobile auth flow has three special cases that aren't really
 * "errors" in the usual sense — they're protocol branches the UI must
 * handle distinctly:
 *
 *   - `MfaRequiredError` — login succeeded credentials-wise but the user
 *     has MFA enabled; UI must navigate to the MFA challenge screen
 *     with the `mfaSessionToken`.
 *   - `EmailNotVerifiedError` — login attempt blocked because the email
 *     is unverified; UI must navigate to the verify-email screen so the
 *     user can request a resend or tap "I verified, continue".
 *   - `NetworkError` — fetch threw before getting a response (offline,
 *     DNS failure, TLS error). Distinguish from server-returned errors
 *     so we can show "you're offline" UX vs "server said no" UX.
 *
 * `ApiError` is the catch-all for non-2xx responses. Includes the HTTP
 * status and the server's `{ error: string }` message.
 *
 * `AuthError` is a more specific ApiError — thrown when the apiClient's
 * automatic token refresh fails (so the user must sign in again). The
 * apiClient handles the forced sign-out itself; the screen just needs
 * to navigate.
 */

/** Base class for any backend-related error. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Network-layer failure (fetch threw, no HTTP response). */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

/** Refresh-token flow failed; user is now signed out. */
export class AuthError extends ApiError {
  constructor(message = 'Session expired. Please sign in again.') {
    super(401, message);
    this.name = 'AuthError';
  }
}

/**
 * Login succeeded credentials-wise but MFA is required.
 * Carries the `mfaSessionToken` that must be passed to /auth/mfa/verify.
 */
export class MfaRequiredError extends Error {
  readonly mfaSessionToken: string;
  constructor(mfaSessionToken: string) {
    super('MFA required');
    this.name = 'MfaRequiredError';
    this.mfaSessionToken = mfaSessionToken;
  }
}

/**
 * Login or other action blocked because the user's email isn't verified.
 * Carries the email so the verify-email screen can pre-fill it.
 */
export class EmailNotVerifiedError extends Error {
  readonly email: string;
  constructor(email: string, message = 'Please verify your email before continuing.') {
    super(message);
    this.name = 'EmailNotVerifiedError';
    this.email = email;
  }
}

/** Type guards for screen-side `catch` blocks. */
export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
export const isNetworkError = (e: unknown): e is NetworkError => e instanceof NetworkError;
export const isAuthError = (e: unknown): e is AuthError => e instanceof AuthError;
export const isMfaRequiredError = (e: unknown): e is MfaRequiredError =>
  e instanceof MfaRequiredError;
export const isEmailNotVerifiedError = (e: unknown): e is EmailNotVerifiedError =>
  e instanceof EmailNotVerifiedError;
