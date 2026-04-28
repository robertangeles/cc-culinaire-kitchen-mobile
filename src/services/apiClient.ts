/**
 * apiClient — fetch wrapper for the CulinAIre Kitchen web backend.
 *
 * Responsibilities:
 *   - Build full URLs from `API_BASE_URL` + a relative path.
 *   - Inject `Authorization: Bearer ${accessToken}` from authStore on
 *     every request (when a token is present).
 *   - JSON in / JSON out. Sets `Content-Type: application/json`,
 *     stringifies body, parses response.
 *   - Single-flight 401 → /auth/refresh → retry. If 5 requests 401
 *     simultaneously, only ONE refresh call is made; the others wait
 *     on the same promise. If refresh fails, force `signOut()` and
 *     reject all pending requests with `AuthError`.
 *   - Normalize errors: backend returns `{ error: string }`. We wrap
 *     into `ApiError(status, message)` for consistent screen-side catch.
 *   - Distinguish network failures (`NetworkError`) from server errors
 *     (`ApiError`).
 *
 * Public surface intentionally minimal: `apiClient.get/post/del`
 * (and the lower-level `apiClient.request` if a screen needs custom
 * headers for the future file-upload case).
 *
 * The full backend API contract is documented at
 * `docs/architecture/web-backend-api.md`. Read that before adding new
 * endpoint helpers — response shapes are the source of truth.
 */
import { API_BASE_URL } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';

import { ApiError, AuthError, NetworkError } from './__errors__';

interface RequestOptions {
  /** HTTP method. Defaults to 'GET'. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Body for non-GET requests; will be JSON.stringified. */
  body?: unknown;
  /**
   * If true, do NOT inject the Authorization header even if an access
   * token exists. Used by /auth/refresh, /auth/login, /auth/register,
   * etc. that don't need (or shouldn't have) a Bearer token.
   */
  skipAuth?: boolean;
  /**
   * If true, do NOT trigger the 401-refresh-retry loop. Used internally
   * by the refresh call itself to prevent infinite recursion.
   */
  skipRefresh?: boolean;
}

/** Single in-flight refresh promise (single-flight guard). */
let refreshPromise: Promise<string> | null = null;

/**
 * Performs the refresh call to /api/auth/refresh.
 *
 * Returns the new access token on success. Throws `AuthError` on
 * failure (which the caller propagates to the original request and
 * forces a sign-out via authStore).
 */
async function refreshAccessToken(): Promise<string> {
  const store = useAuthStore.getState();
  const refreshToken = store.refreshToken;
  if (!refreshToken) {
    throw new AuthError('No refresh token available.');
  }

  const url = `${API_BASE_URL}/api/auth/refresh`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw new NetworkError('Failed to reach refresh endpoint.');
  }

  if (!res.ok) {
    // 401 INVALID_REFRESH_TOKEN / REFRESH_TOKEN_EXPIRED → force sign-out.
    await store.signOut();
    throw new AuthError('Session expired. Please sign in again.');
  }

  const json = (await res.json()) as {
    user: { userId: number; userEmail: string; userName: string };
    tokens: { accessToken: string; refreshToken: string };
  };

  // Persist the new tokens. Refresh token is NOT rotated server-side
  // (same value comes back), but write-through anyway in case backend
  // ever changes that.
  await store.setSession(
    // Cast through unknown — the new authStore will accept the full AuthUser
    // shape; for now Phase 1 doesn't change the store, Phase 4 does.
    json.user as unknown as Parameters<typeof store.setSession>[0],
    json.tokens.accessToken,
  );

  return json.tokens.accessToken;
}

/** Public single-flight wrapper around refreshAccessToken. */
async function getRefreshedAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * Core request method. Returns parsed JSON on success, throws typed
 * error on failure.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipAuth = false, skipRefresh = false } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (!skipAuth) {
    const token = useAuthStore.getState().token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError(`Failed to reach ${url}`);
  }

  // 401 → try refresh once, then retry once. Skipped on the refresh
  // call itself (skipRefresh) and on requests with skipAuth (login,
  // register, etc. — re-auth doesn't help if creds were the issue).
  if (res.status === 401 && !skipRefresh && !skipAuth) {
    try {
      const newToken = await getRefreshedAccessToken();
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      res = await fetch(url, {
        method,
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      // Refresh failed — propagate AuthError or NetworkError as-is.
      throw e;
    }
  }

  // Parse the response body once, even on errors (backend always
  // returns JSON for both success and error per the API contract).
  let json: unknown = undefined;
  const text = await res.text();
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response (rare; only happens on infrastructure errors
      // like 502 Bad Gateway from a load balancer). Treat as ApiError
      // with the raw text as message.
      throw new ApiError(res.status, text.slice(0, 200));
    }
  }

  if (!res.ok) {
    const errorMessage =
      typeof json === 'object' && json !== null && 'error' in json && typeof json.error === 'string'
        ? json.error
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, errorMessage);
  }

  return json as T;
}

export const apiClient = {
  request,

  get<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
    return request<T>(path, { ...options, method: 'GET' });
  },

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
    return request<T>(path, { ...options, method: 'POST', body });
  },

  del<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
    return request<T>(path, { ...options, method: 'DELETE' });
  },
};
