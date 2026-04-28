/**
 * Auth types — must mirror the web backend's `AuthUser` interface in
 * `packages/server/src/services/authService.ts`. The full contract lives
 * in `docs/architecture/web-backend-api.md`; if web changes shape, run
 * `pnpm check:web` and `pnpm test:contract` to detect drift.
 */

/**
 * The user payload returned by every authenticated endpoint
 * (`/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/google/idtoken`,
 * `/auth/mfa/verify`, etc.). Field names match the backend exactly —
 * `userId` (not `id`), `userEmail` (not `email`), `userName` (not
 * `displayName`).
 */
export interface AuthUser {
  userId: number;
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  userPhotoPath: string | null;
  freeSessions: number;
  subscriptionStatus: string;
  subscriptionTier: string;
  userStatus: string;
  roles: string[];
  permissions: string[];
}

/**
 * Token pair returned alongside `user` from auth endpoints. Always
 * nested under `tokens` in the response envelope (NOT flat).
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Standard authenticated success envelope: `{ user, tokens }`. */
export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

/** /auth/login MFA branch (HTTP 200, NOT 202). */
export interface MfaChallenge {
  requiresMfa: true;
  mfaSessionToken: string;
}

/** /auth/register success — does NOT auto-log-in. */
export interface RegisterResult {
  userId: number;
  message: string;
  autoVerified: boolean;
}
