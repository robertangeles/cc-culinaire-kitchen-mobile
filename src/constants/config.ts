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
 * Quantization: Q4_0 main weights (re-quantized via mainline llama.cpp
 * on 2026-04-30, replacing the prior Q4_K_M file). Q4_0 stores weights
 * in a NEON-friendly layout that runs natively on ARM without the
 * SIMD repack buffer that OOMs the 8 GB device — expected ~5× prefill
 * speedup on the Moto G86 Power. Mmproj stays at BF16 (~945 MB) — same
 * bytes as the prior antoine_mmproj.gguf, just renamed on R2.
 *
 * Sizes + SHA-256 verified via PowerShell `Get-FileHash` against the
 * R2-hosted files on 2026-04-30. The native DownloadWorker compares
 * SHA byte-for-byte against the file landed on disk; mismatch deletes
 * the file and surfaces FILE_CORRUPTED to JS. Lowercased here because
 * the worker calls .equals(ignoreCase = true).
 */
export const MODEL = {
  id: 'antoine',
  displayName: 'Antoine',
  files: {
    main: {
      filename: 'antoine-v2-q4_0.gguf',
      url: 'https://pub-7a835c8f4b344301811de8e23b8b3983.r2.dev/antoine-v2-q4_0.gguf',
      sizeBytes: 5_185_929_024,
      sha256: '86b4b9d898bb65c771fcbd1e64c7ac80465c669ac1388ecb84963409b2e74481',
    },
    mmproj: {
      filename: 'antoine-v2-mmproj-bf16.gguf',
      url: 'https://pub-7a835c8f4b344301811de8e23b8b3983.r2.dev/antoine-v2-mmproj-bf16.gguf',
      sizeBytes: 991_551_840,
      sha256: '737485f56225fc61a1468711c4bb07c2b0b9f7f94db0c4cc5feb9aaae429938b',
    },
  },
  totalBytes: 5_185_929_024 + 991_551_840,
} as const;

export const STORAGE_KEYS = {
  authToken: 'ckm_auth_token',
  authRefreshToken: 'ckm_auth_refresh_token',
  authUser: 'ckm_auth_user',
  modelDir: 'ckm_model_dir',
  downloadWifiOnly: 'ckm_download_wifi_only',
  /** Cached Antoine system prompt (body + version + cachedAt as JSON). */
  antoinePrompt: 'ckm_antoine_prompt',
} as const;

/**
 * Slug for the on-device Antoine system prompt as authored in the web
 * admin UI. Server filters by runtime — `device` prompts are returned
 * here; `server` prompts return 404 by design.
 */
export const ANTOINE_PROMPT_SLUG = 'antoine-system-prompt';
