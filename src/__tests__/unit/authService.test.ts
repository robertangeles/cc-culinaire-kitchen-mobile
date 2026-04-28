import { apiClient } from '@/services/apiClient';
import * as authService from '@/services/authService';
import { ApiError, EmailNotVerifiedError, MfaRequiredError } from '@/services/__errors__';
import type { AuthSession, AuthUser } from '@/types/auth';

jest.mock('@/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    del: jest.fn(),
    request: jest.fn(),
  },
}));

const mockUser: AuthUser = {
  userId: 1,
  userName: 'Test Chef',
  userEmail: 'a@b.com',
  emailVerified: true,
  mfaEnabled: false,
  userPhotoPath: null,
  freeSessions: 5,
  subscriptionStatus: 'active',
  subscriptionTier: 'monthly',
  userStatus: 'active',
  roles: ['Subscriber'],
  permissions: ['chat:access'],
};

const mockSession: AuthSession = {
  user: mockUser,
  tokens: { accessToken: 'access-jwt', refreshToken: 'refresh-jwt' },
};

const mockedPost = apiClient.post as jest.Mock;
const mockedGet = apiClient.get as jest.Mock;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('returns AuthSession on success', async () => {
      mockedPost.mockResolvedValueOnce(mockSession);
      const result = await authService.login('a@b.com', 'pw');
      expect(result).toEqual(mockSession);
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/auth/login',
        { email: 'a@b.com', password: 'pw' },
        { skipAuth: true },
      );
    });

    it('throws MfaRequiredError carrying mfaSessionToken when backend returns requiresMfa branch', async () => {
      mockedPost.mockResolvedValue({
        requiresMfa: true,
        mfaSessionToken: 'mfa-tok-xyz',
      });
      const promise = authService.login('a@b.com', 'pw');
      await expect(promise).rejects.toBeInstanceOf(MfaRequiredError);
      await expect(promise).rejects.toMatchObject({ mfaSessionToken: 'mfa-tok-xyz' });
    });

    it('throws EmailNotVerifiedError on 403 with verify-email message', async () => {
      mockedPost.mockRejectedValueOnce(
        new ApiError(403, 'Please verify your email before logging in.'),
      );
      await expect(authService.login('a@b.com', 'pw')).rejects.toBeInstanceOf(
        EmailNotVerifiedError,
      );
    });

    it('passes through other ApiErrors (e.g. 401 invalid credentials)', async () => {
      mockedPost.mockRejectedValue(new ApiError(401, 'Invalid email or password.'));
      await expect(authService.login('a@b.com', 'pw')).rejects.toMatchObject({
        status: 401,
        message: 'Invalid email or password.',
      });
    });
  });

  describe('register', () => {
    it('posts to /api/auth/register and returns the result envelope', async () => {
      mockedPost.mockResolvedValueOnce({
        userId: 42,
        message: 'Check your inbox',
        autoVerified: false,
      });
      const result = await authService.register('Marco', 'a@b.com', 'Password1');
      expect(result.userId).toBe(42);
      expect(result.autoVerified).toBe(false);
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/auth/register',
        { name: 'Marco', email: 'a@b.com', password: 'Password1' },
        { skipAuth: true },
      );
    });

    it('includes guestToken when provided', async () => {
      mockedPost.mockResolvedValueOnce({ userId: 42, message: 'ok', autoVerified: true });
      await authService.register('Marco', 'a@b.com', 'Password1', 'guest-uuid');
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/auth/register',
        { name: 'Marco', email: 'a@b.com', password: 'Password1', guestToken: 'guest-uuid' },
        { skipAuth: true },
      );
    });
  });

  describe('googleSignIn', () => {
    it('posts the idToken and returns AuthSession', async () => {
      mockedPost.mockResolvedValueOnce(mockSession);
      const result = await authService.googleSignIn('google-id-token');
      expect(result).toEqual(mockSession);
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/auth/google/idtoken',
        { idToken: 'google-id-token' },
        { skipAuth: true },
      );
    });
  });

  describe('signOut', () => {
    it('posts the refreshToken to /api/auth/logout', async () => {
      mockedPost.mockResolvedValueOnce(undefined);
      await authService.signOut('refresh-jwt');
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/auth/logout',
        { refreshToken: 'refresh-jwt' },
        { skipAuth: true },
      );
    });
  });

  describe('refresh', () => {
    it('returns AuthSession with rotated/same tokens', async () => {
      mockedPost.mockResolvedValueOnce(mockSession);
      const result = await authService.refresh('refresh-jwt');
      expect(result).toEqual(mockSession);
    });
  });

  describe('verifyMfa', () => {
    it('posts mfaSessionToken + code, returns AuthSession', async () => {
      mockedPost.mockResolvedValueOnce(mockSession);
      const result = await authService.verifyMfa('mfa-tok', '123456');
      expect(result).toEqual(mockSession);
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/auth/mfa/verify',
        { mfaSessionToken: 'mfa-tok', code: '123456' },
        { skipAuth: true },
      );
    });
  });

  describe('password reset', () => {
    it('requestPasswordReset posts email to /forgot-password', async () => {
      mockedPost.mockResolvedValueOnce(undefined);
      await authService.requestPasswordReset('a@b.com');
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/auth/forgot-password',
        { email: 'a@b.com' },
        { skipAuth: true },
      );
    });

    it('submitPasswordReset posts token + newPassword', async () => {
      mockedPost.mockResolvedValueOnce(undefined);
      await authService.submitPasswordReset('reset-tok', 'NewPassword1');
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/auth/reset-password',
        { token: 'reset-tok', newPassword: 'NewPassword1' },
        { skipAuth: true },
      );
    });
  });

  describe('resendEmailVerification', () => {
    it('posts email to /resend-verification', async () => {
      mockedPost.mockResolvedValueOnce(undefined);
      await authService.resendEmailVerification('a@b.com');
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/auth/resend-verification',
        { email: 'a@b.com' },
        { skipAuth: true },
      );
    });
  });

  describe('getMe', () => {
    it('returns the user from { user } envelope', async () => {
      mockedGet.mockResolvedValueOnce({ user: mockUser });
      const result = await authService.getMe();
      expect(result).toEqual(mockUser);
      expect(mockedGet).toHaveBeenCalledWith('/api/auth/me');
    });
  });
});
