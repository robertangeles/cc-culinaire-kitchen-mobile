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

/**
 * Antoine model assets — hosted on Cloudflare R2 public bucket.
 *
 * Sizes verified via HEAD request on 2026-04-29; both files support
 * `Accept-Ranges: bytes` (required by the native background download
 * module's HTTP 206 resume logic).
 *
 * SHA-256 fields: computed via PowerShell `Get-FileHash -Algorithm SHA256`
 * on 2026-04-29 against the R2-hosted source files. The native
 * DownloadWorker compares these byte-for-byte against the file landed
 * on disk; mismatch deletes the file and surfaces FILE_CORRUPTED to JS.
 * Lowercased here because the worker calls .equals(ignoreCase = true).
 */
export const MODEL = {
  id: 'antoine',
  displayName: 'Antoine',
  files: {
    main: {
      filename: 'gemma-4-e4b-it.Q4_K_M.gguf',
      url: 'https://pub-7a835c8f4b344301811de8e23b8b3983.r2.dev/gemma-4-e4b-it.Q4_K_M.gguf',
      sizeBytes: 5_335_285_376,
      sha256: '4ec9a2f362063cc7a0c85ca649d940dc900b7cc6512cc5158e74985f7a2a0a9a',
    },
    mmproj: {
      filename: 'gemma-4-e4b-it.BF16-mmproj.gguf',
      url: 'https://pub-7a835c8f4b344301811de8e23b8b3983.r2.dev/gemma-4-e4b-it.BF16-mmproj.gguf',
      sizeBytes: 991_551_904,
      sha256: 'c4a315853ae5fb62aa642f8c9cb4f61a49dac4a5ed0428250e2ebcfa02ffde30',
    },
  },
  totalBytes: 5_335_285_376 + 991_551_904,
} as const;

export const STORAGE_KEYS = {
  authToken: 'ckm_auth_token',
  authRefreshToken: 'ckm_auth_refresh_token',
  authUser: 'ckm_auth_user',
  modelDir: 'ckm_model_dir',
  downloadWifiOnly: 'ckm_download_wifi_only',
} as const;
