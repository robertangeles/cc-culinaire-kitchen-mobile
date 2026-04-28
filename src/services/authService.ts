/**
 * authService — thin layer over apiClient that calls the web backend's
 * auth endpoints and returns typed results.
 *
 * Each function maps 1:1 to a documented endpoint in
 * `docs/architecture/web-backend-api.md`. Response shapes are NOT
 * defended against drift here — that's the contract test's job
 * (`pnpm test:contract`). If the backend changes, the contract test
 * fails and these functions get updated.
 *
 * Two protocol branches need typed errors so screens can route on them:
 *   - `login` may return `{ requiresMfa: true, mfaSessionToken }` instead
 *     of `{ user, tokens }`. Translated to `MfaRequiredError`.
 *   - `login` may return 403 with `EMAIL_NOT_VERIFIED`. Translated to
 *     `EmailNotVerifiedError(email)`.
 *
 * Everything else propagates `ApiError | NetworkError` from apiClient.
 */
import { apiClient } from '@/services/apiClient';
import type { AuthSession, AuthUser, MfaChallenge, RegisterResult } from '@/types/auth';

import { ApiError, EmailNotVerifiedError, MfaRequiredError } from './__errors__';

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

type LoginResponse = AuthSession | MfaChallenge;

/**
 * Email + password login.
 *
 * @throws MfaRequiredError if the account has MFA enabled (caller routes to /mfa)
 * @throws EmailNotVerifiedError if 403 EMAIL_NOT_VERIFIED (caller routes to /verify-email)
 * @throws ApiError on other 4xx/5xx
 * @throws NetworkError on transport failure
 */
export async function login(email: string, password: string): Promise<AuthSession> {
  let response: LoginResponse;
  try {
    response = await apiClient.post<LoginResponse>(
      '/api/auth/login',
      { email, password },
      { skipAuth: true },
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 403 && /verify your email/i.test(err.message)) {
      throw new EmailNotVerifiedError(email, err.message);
    }
    throw err;
  }

  if ('requiresMfa' in response) {
    throw new MfaRequiredError(response.mfaSessionToken);
  }
  return response;
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

/**
 * Create a new account. Does NOT auto-log-in — caller must follow up with
 * `login()` after email verification (or immediately if backend returned
 * `autoVerified: true` in dev mode without RESEND_API_KEY).
 */
export async function register(
  name: string,
  email: string,
  password: string,
  guestToken?: string,
): Promise<RegisterResult> {
  return apiClient.post<RegisterResult>(
    '/api/auth/register',
    guestToken ? { name, email, password, guestToken } : { name, email, password },
    { skipAuth: true },
  );
}

// ---------------------------------------------------------------------------
// Google native sign-in (idToken from @react-native-google-signin SDK)
// ---------------------------------------------------------------------------

export async function googleSignIn(idToken: string): Promise<AuthSession> {
  return apiClient.post<AuthSession>('/api/auth/google/idtoken', { idToken }, { skipAuth: true });
}

// ---------------------------------------------------------------------------
// Sign out (server-side revoke + caller wipes local state)
// ---------------------------------------------------------------------------

/**
 * Revoke the refresh token server-side. Caller is responsible for wiping
 * SecureStore via `useAuthStore.signOut()` AFTER this returns (or after
 * the network call fails — local state must be cleared either way).
 */
export async function signOut(refreshToken: string): Promise<void> {
  await apiClient.post('/api/auth/logout', { refreshToken }, { skipAuth: true });
}

// ---------------------------------------------------------------------------
// Refresh (rarely called directly — apiClient does this internally)
// ---------------------------------------------------------------------------

/**
 * Manually refresh the access token. apiClient handles this automatically
 * on 401, so screens should never need to call this directly. Exported for
 * tests and edge cases (e.g. proactive refresh before a long operation).
 */
export async function refresh(refreshToken: string): Promise<AuthSession> {
  return apiClient.post<AuthSession>('/api/auth/refresh', { refreshToken }, { skipAuth: true });
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

/**
 * Resend the verify-email link. Backend always returns success (anti-
 * enumeration), so no error path beyond network failure.
 */
export async function resendEmailVerification(email: string): Promise<void> {
  await apiClient.post('/api/auth/resend-verification', { email }, { skipAuth: true });
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Send a password-reset email. Backend always returns 200 + `{ success: true }`
 * (anti-enumeration), so no error path beyond network failure.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/api/auth/forgot-password', { email }, { skipAuth: true });
}

/**
 * Submit a new password using the token from the reset email. Does NOT
 * auto-log-in — caller must `login()` after.
 */
export async function submitPasswordReset(token: string, newPassword: string): Promise<void> {
  await apiClient.post('/api/auth/reset-password', { token, newPassword }, { skipAuth: true });
}

// ---------------------------------------------------------------------------
// MFA verification (the 2nd step of an MFA-required login)
// ---------------------------------------------------------------------------

export async function verifyMfa(mfaSessionToken: string, code: string): Promise<AuthSession> {
  return apiClient.post<AuthSession>(
    '/api/auth/mfa/verify',
    { mfaSessionToken, code },
    { skipAuth: true },
  );
}

// ---------------------------------------------------------------------------
// Get current user (re-fetch after email verification, etc.)
// ---------------------------------------------------------------------------

export async function getMe(): Promise<AuthUser> {
  const response = await apiClient.get<{ user: AuthUser }>('/api/auth/me');
  return response.user;
}
