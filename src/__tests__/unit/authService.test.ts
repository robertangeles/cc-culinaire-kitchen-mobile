import * as authService from '@/services/authService';

describe('authService', () => {
  beforeEach(() => {
    authService.__forceError.value = false;
  });

  it('login resolves with stub user', async () => {
    const result = await authService.login('a@b.com', 'pw');
    expect(result.user.email).toBe('a@b.com');
    expect(result.token).toBe('mock-jwt-token');
  });

  it('login rejects when __forceError is set', async () => {
    authService.__forceError.value = true;
    await expect(authService.login('a@b.com', 'pw')).rejects.toThrow();
  });

  it('googleSignIn resolves with stub user', async () => {
    const result = await authService.googleSignIn();
    expect(result.user.id).toBe('google-demo');
    expect(result.token).toBe('mock-google-jwt-token');
  });
});
