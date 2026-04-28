// Provide a non-empty Google Web Client ID so signInWithGoogle doesn't
// short-circuit on the "not configured" guard. Real value comes from .env
// at runtime; tests need a fake. jest.mock must run before the imports
// it affects, so disable the import/first rule for the deliberate ordering.
/* eslint-disable import/first */
jest.mock('@/constants/config', () => ({
  ...jest.requireActual('@/constants/config'),
  GOOGLE_WEB_CLIENT_ID: 'test-web-client-id.apps.googleusercontent.com',
}));

import { GoogleSignin } from '@react-native-google-signin/google-signin';

import {
  GoogleSignInCancelledError,
  isGoogleSignInCancelled,
  signInWithGoogle,
  signOutGoogle,
} from '@/services/googleSignIn';
/* eslint-enable import/first */

// The SDK is mocked globally in jest.setup.ts. Tests here override the mock
// behavior per-case via mockResolvedValueOnce / mockRejectedValueOnce.

const mockedSignIn = GoogleSignin.signIn as jest.Mock;
const mockedHasPlayServices = GoogleSignin.hasPlayServices as jest.Mock;
const mockedConfigure = GoogleSignin.configure as jest.Mock;

describe('googleSignIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedHasPlayServices.mockResolvedValue(true);
  });

  it('returns the idToken from a successful sign-in', async () => {
    mockedSignIn.mockResolvedValueOnce({
      type: 'success',
      data: { idToken: 'real-id-token' },
    });
    const result = await signInWithGoogle();
    expect(result.idToken).toBe('real-id-token');
    expect(mockedConfigure).toHaveBeenCalled();
    expect(mockedHasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
  });

  it('throws GoogleSignInCancelledError when user backs out (response.type === cancelled)', async () => {
    mockedSignIn.mockResolvedValueOnce({ type: 'cancelled' });
    await expect(signInWithGoogle()).rejects.toBeInstanceOf(GoogleSignInCancelledError);
  });

  it('throws when SDK returns success but no idToken', async () => {
    mockedSignIn.mockResolvedValueOnce({ type: 'success', data: {} });
    await expect(signInWithGoogle()).rejects.toThrow(/did not return an ID token/i);
  });

  it('isGoogleSignInCancelled type guard distinguishes cancellation from other errors', () => {
    expect(isGoogleSignInCancelled(new GoogleSignInCancelledError())).toBe(true);
    expect(isGoogleSignInCancelled(new Error('something else'))).toBe(false);
    expect(isGoogleSignInCancelled('not even an error')).toBe(false);
  });

  it('signOutGoogle calls SDK signOut and swallows errors', async () => {
    (GoogleSignin.signOut as jest.Mock).mockRejectedValueOnce(new Error('whatever'));
    await expect(signOutGoogle()).resolves.toBeUndefined();
  });
});
