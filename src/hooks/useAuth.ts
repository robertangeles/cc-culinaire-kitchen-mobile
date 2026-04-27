import { useCallback, useState } from 'react';

import * as authService from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const signOut = useAuthStore((s) => s.signOut);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await authService.login(email, password);
        await setSession(result.user, result.token);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Login failed');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [setSession],
  );

  const googleSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.googleSignIn();
      await setSession(result.user, result.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  return { user, login, googleSignIn, signOut, isLoading, error };
}
