import { useCallback, useState } from 'react';

import * as authService from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

/**
 * Auth hook. Wraps `authService` calls + the `authStore` so screens can
 * focus on UX. Each method:
 *   - sets `isLoading` for the duration of the call
 *   - sets `error` to the human-readable message on failure
 *   - re-throws so the screen can pattern-match for routing
 *     (e.g. `MfaRequiredError` → push /mfa, `EmailNotVerifiedError` → push /verify-email)
 *
 * `register` and `submitPasswordReset` do NOT auto-set the session —
 * the backend doesn't auto-log-in for those flows. Screens follow up
 * with their own `login()` call (or route to verify-email).
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const setSession = useAuthStore((s) => s.setSession);
  const wipeLocal = useAuthStore((s) => s.signOut);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrap = useCallback(async <T>(fn: () => Promise<T>, fallbackMsg: string): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallbackMsg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await wrap(() => authService.login(email, password), 'Login failed');
      await setSession(session.user, session.tokens.accessToken, session.tokens.refreshToken);
    },
    [wrap, setSession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      return wrap(() => authService.register(name, email, password), 'Registration failed');
    },
    [wrap],
  );

  const googleSignIn = useCallback(
    async (idToken: string) => {
      const session = await wrap(() => authService.googleSignIn(idToken), 'Google sign-in failed');
      await setSession(session.user, session.tokens.accessToken, session.tokens.refreshToken);
    },
    [wrap, setSession],
  );

  const verifyMfa = useCallback(
    async (mfaSessionToken: string, code: string) => {
      const session = await wrap(
        () => authService.verifyMfa(mfaSessionToken, code),
        'MFA verification failed',
      );
      await setSession(session.user, session.tokens.accessToken, session.tokens.refreshToken);
    },
    [wrap, setSession],
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      return wrap(() => authService.requestPasswordReset(email), 'Could not send reset email');
    },
    [wrap],
  );

  const submitPasswordReset = useCallback(
    async (token: string, newPassword: string) => {
      return wrap(
        () => authService.submitPasswordReset(token, newPassword),
        'Could not reset password',
      );
    },
    [wrap],
  );

  const resendEmailVerification = useCallback(
    async (email: string) => {
      return wrap(
        () => authService.resendEmailVerification(email),
        'Could not resend verification email',
      );
    },
    [wrap],
  );

  const refreshUser = useCallback(async () => {
    const fresh = await wrap(() => authService.getMe(), 'Could not refresh user');
    // Preserve current tokens; only the user payload changes (e.g. emailVerified flipped to true).
    const { token, refreshToken: rt } = useAuthStore.getState();
    if (token) await setSession(fresh, token, rt ?? undefined);
    return fresh;
  }, [wrap, setSession]);

  /**
   * Sign out: revoke the refresh token server-side BEFORE wiping local
   * state so the server can mark it invalid. If the network call fails,
   * still wipe local — the user clicked Sign Out and should be signed out.
   */
  const signOut = useCallback(async () => {
    if (refreshToken) {
      try {
        await authService.signOut(refreshToken);
      } catch {
        // Network or server error — proceed to local wipe anyway.
      }
    }
    await wipeLocal();
  }, [refreshToken, wipeLocal]);

  return {
    user,
    isLoading,
    error,
    login,
    register,
    googleSignIn,
    verifyMfa,
    requestPasswordReset,
    submitPasswordReset,
    resendEmailVerification,
    refreshUser,
    signOut,
  };
}
