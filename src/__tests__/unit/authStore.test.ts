import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';

const mockUser: AuthUser = {
  userId: 1,
  userName: 'Test',
  userEmail: 'a@b.com',
  emailVerified: true,
  mfaEnabled: false,
  userPhotoPath: null,
  freeSessions: 0,
  subscriptionStatus: 'active',
  subscriptionTier: 'free',
  userStatus: 'active',
  roles: [],
  permissions: [],
};

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isHydrated: false,
    });
  });

  it('hydrates from SecureStore when a session exists', async () => {
    // hydrate() reads three SecureStore keys in parallel via Promise.all.
    // Map by key so mock-call order doesn't matter.
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'ckm_auth_token') return 'mock-token';
      if (key === 'ckm_auth_refresh_token') return 'mock-refresh';
      if (key === 'ckm_auth_user') return JSON.stringify(mockUser);
      return null;
    });

    await useAuthStore.getState().hydrate();

    const s = useAuthStore.getState();
    expect(s.token).toBe('mock-token');
    expect(s.refreshToken).toBe('mock-refresh');
    expect(s.user).toEqual(mockUser);
    expect(s.isHydrated).toBe(true);
  });

  it('marks hydrated even when no session exists', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    await useAuthStore.getState().hydrate();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.isHydrated).toBe(true);
  });

  it('setSession writes to SecureStore and updates state', async () => {
    await useAuthStore.getState().setSession(mockUser, 'tk');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ckm_auth_token', 'tk');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'ckm_auth_user',
      JSON.stringify(mockUser),
    );
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('setSession persists refreshToken when provided', async () => {
    await useAuthStore.getState().setSession(mockUser, 'tk', 'refresh-jwt');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ckm_auth_refresh_token', 'refresh-jwt');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-jwt');
  });

  it('signOut clears state and SecureStore', async () => {
    useAuthStore.setState({
      user: mockUser,
      token: 'tk',
      refreshToken: 'rt',
      isHydrated: true,
    });
    await useAuthStore.getState().signOut();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ckm_auth_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ckm_auth_refresh_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ckm_auth_user');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });
});
