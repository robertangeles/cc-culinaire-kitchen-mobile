/**
 * Native Google Sign-In wrapper.
 *
 * The `@react-native-google-signin/google-signin` SDK does the heavy lifting:
 *   - Pops the Android system account picker
 *   - Talks to Google Play Services
 *   - Returns a verified ID token
 *
 * We hand the ID token to our backend via `authService.googleSignIn(idToken)`,
 * which calls `POST /api/auth/google/idtoken` (W1 endpoint). The backend
 * verifies the token with `google-auth-library` and returns our app's
 * AuthSession.
 *
 * Configuration must happen ONCE at app startup before any signIn() call —
 * see `app/_layout.tsx` where we invoke `configureGoogleSignIn()` at mount.
 *
 * **Native module**: this module imports react-native bindings that only
 * exist in a custom dev client APK (NOT Expo Go). Importing it in a JS-only
 * test environment requires the jest mock at `jest.setup.ts`.
 */
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { GOOGLE_WEB_CLIENT_ID } from '@/constants/config';

let configured = false;

/**
 * Configure once at app startup. Idempotent — safe to call multiple times.
 *
 * `webClientId` is the Google Cloud Console "Web application" OAuth Client
 * ID — NOT the Android one. On Android, the ID token returned by signIn()
 * has `aud` = the Web Client ID, so the backend's audience verification
 * matches against this value. The Android Client ID is referenced only
 * by Google Play Services on the device (via package name + SHA-1 cert
 * fingerprint configured in Google Cloud Console).
 */
export function configureGoogleSignIn(): void {
  if (configured) return;
  if (!GOOGLE_WEB_CLIENT_ID) {
    // Don't crash the app — leave Google Sign-In disabled and let the
    // button surface a friendly error if the user actually taps it.
    return;
  }
  // Permanent startup log — fires once per app launch so any env-baking
  // mismatch (between .env, Constants.expoConfig.extra, and the running
  // APK) is immediately visible in Metro output. We spent hours on
  // 2026-04-28 debugging exactly this class of bug; leaving the log keeps
  // it cheap and trivially diagnosable next time. See tasks/lessons.md
  // "app.config.ts extra is BAKED INTO THE APK at build time".
  if (__DEV__) {
    console.warn(
      '[googleSignIn.configure] webClientId =',
      GOOGLE_WEB_CLIENT_ID || '<EMPTY>',
      '(length:',
      GOOGLE_WEB_CLIENT_ID.length,
      ')',
    );
  }
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    // Request offline access only if we ever need to call Google APIs
    // server-side on the user's behalf. We don't (we just verify identity),
    // so leave this off — keeps the consent screen simpler.
    offlineAccess: false,
  });
  configured = true;
}

/**
 * Result of a successful sign-in. Includes the ID token mobile sends to
 * our backend. The SDK also returns user profile (email, name, photo) but
 * we ignore it — the backend's response is the source of truth.
 */
export interface GoogleSignInResult {
  idToken: string;
}

/**
 * User-cancelled error. Distinguished from real errors so the UI can
 * silently no-op (don't show a toast for "user pressed back").
 */
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Sign-in cancelled');
    this.name = 'GoogleSignInCancelledError';
  }
}

/**
 * Pop the Google account picker, return the ID token. The caller passes
 * this to `authService.googleSignIn(idToken)` to exchange for our app's
 * JWT pair.
 *
 * @throws GoogleSignInCancelledError when the user cancels or backs out.
 * @throws Error('Sign-in already in progress') if double-tapped.
 * @throws Error('Google Play Services not available') on devices without
 *         GPS (e.g. some custom ROMs, Huawei).
 * @throws Error with the SDK's message for any other failure.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!configured) {
    configureGoogleSignIn();
  }
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error('Google sign-in is not configured for this build.');
  }

  // Required on Android: throws immediately if Google Play Services is
  // missing or out of date, with a prompt to install/update.
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  try {
    const response = await GoogleSignin.signIn();
    // SDK v15+ returns { type: 'success' | 'cancelled', data?: ... }
    if (response.type === 'cancelled') {
      throw new GoogleSignInCancelledError();
    }
    const idToken = response.data?.idToken;
    if (!idToken) {
      throw new Error('Google did not return an ID token.');
    }
    return { idToken };
  } catch (err) {
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new GoogleSignInCancelledError();
        case statusCodes.IN_PROGRESS:
          throw new Error('Sign-in already in progress.');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error('Google Play Services is not available on this device.');
        default:
          throw err;
      }
    }
    throw err;
  }
}

/**
 * Sign out of Google's session locally (clears the cached account picker
 * choice so the next sign-in re-prompts). Does NOT touch our backend
 * tokens — `useAuth.signOut()` handles that separately.
 */
export async function signOutGoogle(): Promise<void> {
  if (!configured) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    // Non-fatal — local Google session may already be cleared.
  }
}

/** Type guard for the cancelled case so screens can silently no-op. */
export function isGoogleSignInCancelled(e: unknown): e is GoogleSignInCancelledError {
  return e instanceof GoogleSignInCancelledError;
}
