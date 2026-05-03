import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { STORAGE_KEYS } from '@/constants/config';
import { useFoodSafetyStore } from '@/store/foodSafetyStore';
import type { AuthUser } from '@/types/auth';

/**
 * Auth state. Holds the full backend `AuthUser` shape (12 fields, see
 * `src/types/auth.ts`) plus the access + refresh token pair.
 *
 * `refreshToken` is needed by `apiClient`'s single-flight 401-refresh-retry
 * loop. `signOut` clears all SecureStore keys; the server-side refresh
 * token revocation is performed by `useAuth.signOut` BEFORE calling this
 * store action (so we still wipe local even if the network call fails).
 */
interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (user: AuthUser, token: string, refreshToken?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isHydrated: false,

  hydrate: async () => {
    try {
      const [token, refreshToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.authToken),
        SecureStore.getItemAsync(STORAGE_KEYS.authRefreshToken),
        SecureStore.getItemAsync(STORAGE_KEYS.authUser),
      ]);
      if (token && userJson) {
        set({
          token,
          refreshToken: refreshToken ?? null,
          user: JSON.parse(userJson) as AuthUser,
        });
      }
    } finally {
      set({ isHydrated: true });
    }
  },

  setSession: async (user, token, refreshToken) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.authToken, token);
    await SecureStore.setItemAsync(STORAGE_KEYS.authUser, JSON.stringify(user));
    if (refreshToken !== undefined && refreshToken !== null) {
      await SecureStore.setItemAsync(STORAGE_KEYS.authRefreshToken, refreshToken);
      set({ user, token, refreshToken });
    } else {
      set({ user, token });
    }
  },

  signOut: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.authToken),
      SecureStore.deleteItemAsync(STORAGE_KEYS.authRefreshToken),
      SecureStore.deleteItemAsync(STORAGE_KEYS.authUser),
    ]);
    set({ user: null, token: null, refreshToken: null });
    // Reset the per-session food-safety ack so the next sign-in sees
    // the screen fresh. Without this, signing out + signing back in
    // within the same JS lifetime would skip the ack screen.
    useFoodSafetyStore.getState().resetAck();
  },
}));
