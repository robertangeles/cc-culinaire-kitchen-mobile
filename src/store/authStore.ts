import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { STORAGE_KEYS } from '@/constants/config';
import type { User } from '@/types/auth';

interface AuthStore {
  user: User | null;
  token: string | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (user: User, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isHydrated: false,

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.authToken);
      // For v1 mocked auth, the SecureStore token is the only signal that
      // a session exists. The user object is reconstructed from the email
      // we stashed alongside the token (also mock — real auth lands later).
      const userJson = await SecureStore.getItemAsync('ckm_auth_user');
      if (token && userJson) {
        set({ token, user: JSON.parse(userJson) as User });
      }
    } finally {
      set({ isHydrated: true });
    }
  },

  setSession: async (user, token) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.authToken, token);
    await SecureStore.setItemAsync('ckm_auth_user', JSON.stringify(user));
    set({ user, token });
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.authToken);
    await SecureStore.deleteItemAsync('ckm_auth_user');
    set({ user: null, token: null });
  },
}));
