import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '@/store/authStore';

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, token: null, isHydrated: false });
  });

  it('hydrates from SecureStore when a session exists', async () => {
    const user = { id: 'u1', email: 'a@b.com' };
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('mock-token')
      .mockResolvedValueOnce(JSON.stringify(user));

    await useAuthStore.getState().hydrate();

    const s = useAuthStore.getState();
    expect(s.token).toBe('mock-token');
    expect(s.user).toEqual(user);
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
    const user = { id: 'u1', email: 'a@b.com' };
    await useAuthStore.getState().setSession(user, 'tk');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ckm_auth_token', 'tk');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ckm_auth_user', JSON.stringify(user));
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('signOut clears state and SecureStore', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com' },
      token: 'tk',
      isHydrated: true,
    });
    await useAuthStore.getState().signOut();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ckm_auth_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ckm_auth_user');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
  });
});
