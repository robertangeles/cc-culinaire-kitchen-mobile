import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { STORAGE_KEYS } from '@/constants/config';
import type { User } from '@/types/auth';

/**
 * Auth state. Phase 1 adds `refreshToken` so apiClient can do single-flight
 * 401-refresh-retry. The full Phase 4 work (rich AuthUser shape from web,
 * server-side revoke on signOut) builds on top of this skeleton.
 */
interface AuthStore {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (user: User, token: string, refreshToken?: string | null) => Promise<void>;
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
          user: JSON.parse(userJson) as User,
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
  },
}));
