import type { User } from '@/types/auth';

interface LoginResult {
  user: User;
  token: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * v1 stub. Real OAuth + backend lands later.
 * Set `__forceError = true` in tests to exercise the error path.
 */
export const __forceError = { value: false };

export async function login(email: string, _password: string): Promise<LoginResult> {
  await sleep(400);
  if (__forceError.value) {
    throw new Error('Couldn’t reach the kitchen. Try again in a moment.');
  }
  return {
    user: { id: 'demo', email, displayName: email.split('@')[0] },
    token: 'mock-jwt-token',
  };
}

export async function googleSignIn(): Promise<LoginResult> {
  await sleep(600);
  if (__forceError.value) {
    throw new Error('Google sign-in failed. Try again or use email.');
  }
  return {
    user: { id: 'google-demo', email: 'demo@example.com', displayName: 'Demo Chef' },
    token: 'mock-google-jwt-token',
  };
}

export async function register(email: string, password: string): Promise<LoginResult> {
  return login(email, password);
}
