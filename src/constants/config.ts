import Constants from 'expo-constants';

export const APP_NAME = 'CulinAIre Kitchen';
export const ASSISTANT_NAME = 'Antoine';

/**
 * Read env-derived values via `expo-constants`. The values flow from
 * `app.config.ts`'s `extra` block, which itself reads from
 * `process.env.EXPO_PUBLIC_*` at build time.
 *
 * Order of precedence:
 *   1. `Constants.expoConfig?.extra?.X` — production runtime (works in
 *      both dev-client and EAS builds).
 *   2. `process.env.EXPO_PUBLIC_X` — fallback for jest tests where
 *      `expo-constants` isn't fully populated.
 *   3. Hard-coded default — last resort if env is misconfigured;
 *      production URL is the safest fallback (won't accidentally point
 *      tests at a dev backend).
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  googleWebClientId?: string;
};

// IMPORTANT: use the `www` host. The apex `culinaire.kitchen` 301-redirects
// to `www.culinaire.kitchen`, and Node/browser fetch strips the
// `Authorization` header on cross-origin redirects (security default).
// That breaks any GET endpoint with a Bearer token (e.g. /api/auth/me).
// POST endpoints don't redirect, so the bug only surfaces on GETs.
export const API_BASE_URL: string =
  extra.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://www.culinaire.kitchen';

export const GOOGLE_WEB_CLIENT_ID: string =
  extra.googleWebClientId ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const MODEL = {
  id: 'antoine',
  displayName: 'Antoine',
  filename: 'gemma-4-e4b-it.Q4_K_M.gguf',
  mmprojFilename: 'gemma-4-e4b-it.BF16-mmproj.gguf',
  sizeBytes: 4_970_000_000 + 920_000_000,
  cdnUrl: 'https://cdn.culinaire-kitchen.example/models/antoine/v1/',
} as const;

export const STORAGE_KEYS = {
  authToken: 'ckm_auth_token',
  authRefreshToken: 'ckm_auth_refresh_token',
  authUser: 'ckm_auth_user',
  modelDir: 'ckm_model_dir',
} as const;
