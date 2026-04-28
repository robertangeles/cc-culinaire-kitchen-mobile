/**
 * Web backend contract test.
 *
 * Hits the real deployed backend (default https://culinaire.kitchen) and
 * asserts that response shapes + status codes still match what mobile's
 * apiClient + types/auth.ts expect. This is the alarm that fires when
 * the web team renames a field, drops a key, or changes a status code.
 *
 * NOT run by default (excluded via jest.config.js testPathIgnorePatterns).
 * Run explicitly with: pnpm test:contract
 *
 * Required env (only for full coverage; tests skip gracefully if missing):
 *   CONTRACT_API_BASE_URL   default: https://culinaire.kitchen
 *   CONTRACT_TEST_EMAIL     a real account in the prod DB (test-only user)
 *   CONTRACT_TEST_PASSWORD  password for that account
 *
 * Source contract: docs/architecture/web-backend-api.md
 */

const BASE = (process.env.CONTRACT_API_BASE_URL ?? 'https://culinaire.kitchen').replace(/\/$/, '');
const TEST_EMAIL = process.env.CONTRACT_TEST_EMAIL;
const TEST_PASSWORD = process.env.CONTRACT_TEST_PASSWORD;
const HAVE_CREDS = Boolean(TEST_EMAIL && TEST_PASSWORD);

type AuthUserShape = {
  userId: number;
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  userPhotoPath: string | null;
  freeSessions: number;
  subscriptionStatus: string;
  subscriptionTier: string;
  userStatus: string;
  roles: string[];
  permissions: string[];
};

type TokensShape = { accessToken: string; refreshToken: string };

function assertType(value: unknown, expected: string, path: string): void {
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (actual !== expected) {
    throw new Error(
      `Contract drift at "${path}": expected ${expected}, got ${actual} (value: ${JSON.stringify(value)?.slice(0, 100)})`,
    );
  }
}

function assertNullableType(value: unknown, expected: string, path: string): void {
  if (value === null) return;
  assertType(value, expected, path);
}

function assertStringArray(value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`Contract drift at "${path}": expected array, got ${typeof value}`);
  }
  value.forEach((v, i) => assertType(v, 'string', `${path}[${i}]`));
}

function assertAuthUserShape(user: unknown): asserts user is AuthUserShape {
  assertType(user, 'object', 'user');
  const u = user as Record<string, unknown>;
  assertType(u.userId, 'number', 'user.userId');
  assertType(u.userName, 'string', 'user.userName');
  assertType(u.userEmail, 'string', 'user.userEmail');
  assertType(u.emailVerified, 'boolean', 'user.emailVerified');
  assertType(u.mfaEnabled, 'boolean', 'user.mfaEnabled');
  assertNullableType(u.userPhotoPath, 'string', 'user.userPhotoPath');
  assertType(u.freeSessions, 'number', 'user.freeSessions');
  assertType(u.subscriptionStatus, 'string', 'user.subscriptionStatus');
  assertType(u.subscriptionTier, 'string', 'user.subscriptionTier');
  assertType(u.userStatus, 'string', 'user.userStatus');
  assertStringArray(u.roles, 'user.roles');
  assertStringArray(u.permissions, 'user.permissions');
}

function assertTokensShape(tokens: unknown): asserts tokens is TokensShape {
  assertType(tokens, 'object', 'tokens');
  const t = tokens as Record<string, unknown>;
  assertType(t.accessToken, 'string', 'tokens.accessToken');
  assertType(t.refreshToken, 'string', 'tokens.refreshToken');
  if ((t.accessToken as string).length < 20) {
    throw new Error('Contract drift: tokens.accessToken too short to be a JWT');
  }
}

function assertErrorShape(body: unknown): void {
  assertType(body, 'object', 'errorBody');
  const b = body as Record<string, unknown>;
  if (typeof b.error !== 'string') {
    throw new Error(
      `Contract drift: error responses must include a string "error" field. Got: ${JSON.stringify(body)}`,
    );
  }
}

async function http(
  method: string,
  path: string,
  init: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: unknown }> {
  const url = `${BASE}/api${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers ?? {}),
  };
  let body: string | undefined;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        `Non-JSON response from ${method} ${path}: status=${res.status} body=${text.slice(0, 200)}`,
      );
    }
  }
  return { status: res.status, body: parsed };
}

describe('web backend contract', () => {
  // Long timeout — these go over the network to production.
  jest.setTimeout(30_000);

  beforeAll(() => {
    // Helpful banner so it's obvious which env we hit.
    console.log(`[contract] base URL: ${BASE}`);
    if (!HAVE_CREDS) {
      console.warn(
        '[contract] CONTRACT_TEST_EMAIL / CONTRACT_TEST_PASSWORD not set — auth-required checks will be SKIPPED',
      );
    }
  });

  describe('POST /auth/login (bad creds)', () => {
    it('returns 401 with { error: string } for invalid credentials', async () => {
      const { status, body } = await http('POST', '/auth/login', {
        body: { email: 'nobody-contract-test@example.invalid', password: 'NotARealPassword1' },
      });
      expect(status).toBe(401);
      assertErrorShape(body);
    });

    it('returns 400 for malformed body (missing password)', async () => {
      const { status, body } = await http('POST', '/auth/login', {
        body: { email: 'foo@example.com' },
      });
      expect(status).toBe(400);
      assertErrorShape(body);
    });
  });

  describe('POST /auth/forgot-password (anti-enumeration)', () => {
    it('returns 200 with { success, message } even for unknown email', async () => {
      const { status, body } = await http('POST', '/auth/forgot-password', {
        body: { email: 'never-existed-contract-test@example.invalid' },
      });
      expect(status).toBe(200);
      assertType(body, 'object', 'body');
      const b = body as Record<string, unknown>;
      assertType(b.success, 'boolean', 'success');
      assertType(b.message, 'string', 'message');
    });
  });

  describe('POST /auth/google/idtoken (W1 endpoint)', () => {
    it('returns 401 for an obviously invalid idToken (proves verifier is reachable)', async () => {
      const { status, body } = await http('POST', '/auth/google/idtoken', {
        body: { idToken: 'this-is-not-a-real-google-id-token' },
      });
      // 401 = good (token rejected by google-auth-library)
      // 500 OAUTH_NOT_CONFIGURED = bad (the bug W1.1 fixed)
      // 400 = also acceptable (validator rejected before verifier ran)
      expect([400, 401]).toContain(status);
      assertErrorShape(body);
    });

    it('returns 400 with { error } for missing idToken', async () => {
      const { status, body } = await http('POST', '/auth/google/idtoken', {
        body: {},
      });
      expect(status).toBe(400);
      assertErrorShape(body);
    });
  });

  // ============================================================
  // Tests below need a real test account in the prod DB.
  // Conditionally skipped if CONTRACT_TEST_EMAIL/PASSWORD missing.
  // ============================================================

  const describeIfCreds = HAVE_CREDS ? describe : describe.skip;

  describeIfCreds('POST /auth/login (good creds) — needs CONTRACT_TEST_EMAIL/PASSWORD', () => {
    let capturedAccessToken = '';
    let capturedRefreshToken = '';

    it('returns 200 with { user: AuthUser, tokens: { accessToken, refreshToken } }', async () => {
      const { status, body } = await http('POST', '/auth/login', {
        body: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });
      expect(status).toBe(200);
      assertType(body, 'object', 'body');
      const b = body as Record<string, unknown>;

      // Either tokens response OR mfaRequired branch — assert one of them.
      if ('requiresMfa' in b) {
        expect(b.requiresMfa).toBe(true);
        assertType(b.mfaSessionToken, 'string', 'mfaSessionToken');
        console.warn('[contract] test account has MFA enabled — downstream tests will skip');
        return;
      }

      assertAuthUserShape(b.user);
      assertTokensShape(b.tokens);
      capturedAccessToken = (b.tokens as TokensShape).accessToken;
      capturedRefreshToken = (b.tokens as TokensShape).refreshToken;
    });

    it('GET /auth/me returns same AuthUser shape', async () => {
      if (!capturedAccessToken) {
        // login captured nothing (probably MFA branch); skip
        return;
      }
      const { status, body } = await http('GET', '/auth/me', {
        headers: { Authorization: `Bearer ${capturedAccessToken}` },
      });
      expect(status).toBe(200);
      assertType(body, 'object', 'body');
      const b = body as Record<string, unknown>;
      assertAuthUserShape(b.user);
    });

    it('POST /auth/refresh returns same shape and same refreshToken (NOT rotated)', async () => {
      if (!capturedRefreshToken) return;
      const { status, body } = await http('POST', '/auth/refresh', {
        body: { refreshToken: capturedRefreshToken },
      });
      expect(status).toBe(200);
      assertType(body, 'object', 'body');
      const b = body as Record<string, unknown>;
      assertAuthUserShape(b.user);
      assertTokensShape(b.tokens);
      // Documented behavior: refresh does NOT rotate the refresh token.
      // If the web team flips this, mobile's single-flight refresh logic still
      // works but our docs are wrong — flag it.
      expect((b.tokens as TokensShape).refreshToken).toBe(capturedRefreshToken);
    });

    it('POST /auth/logout returns 200 and revokes the refresh token', async () => {
      if (!capturedRefreshToken) return;
      const { status, body } = await http('POST', '/auth/logout', {
        body: { refreshToken: capturedRefreshToken },
      });
      expect(status).toBe(200);
      assertType(body, 'object', 'body');
      assertType((body as Record<string, unknown>).message, 'string', 'message');

      // Verify revocation: refresh with the same token now fails.
      const after = await http('POST', '/auth/refresh', {
        body: { refreshToken: capturedRefreshToken },
      });
      expect(after.status).toBe(401);
    });
  });
});
