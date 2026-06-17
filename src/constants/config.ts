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

export const STORAGE_KEYS = {
  authToken: 'ckm_auth_token',
  authRefreshToken: 'ckm_auth_refresh_token',
  authUser: 'ckm_auth_user',
  /**
   * Cached Antoine system prompt (single-slug, v1.1 format).
   *
   * v1.2 deprecates this in favour of `antoinePromptMap` below, which
   * keys cache entries by slug to support per-language prompts. This
   * key is read once on first v1.2 boot for migration, then deleted.
   * New code should NOT write to this key.
   */
  antoinePrompt: 'ckm_antoine_prompt',
  /**
   * Cached Antoine system prompts keyed by slug (v1.2 format). JSON map
   * `Record<slug, CacheEntry>` where each entry is either
   *   `{ status: 'ok', body, version, cachedAt }` or
   *   `{ status: 'not_found', checkedAt }`.
   * The `not_found` branch is set on a 404 from the prompt fetch and
   * drives the partial-language banner UX in v1.2.
   */
  antoinePromptMap: 'ckm_antoine_prompt_map',
  /**
   * User's selected language (BCP 47 code, e.g. 'en', 'fr'). Single source
   * of truth: `useI18nStore` writes here on every setLanguage(). v1.1 only
   * reads/writes; the language has no UI effect until v1.2 ships the
   * picker + first non-EN locale bundle.
   */
  language: 'ckm_language',
  /**
   * Cached feature-flag bundle from `GET /api/mobile/feature-flags`.
   * JSON-serialised `FeatureFlags` (see featureFlagsService.ts). Read by
   * the language picker to decide which non-EN locales to surface.
   */
  featureFlags: 'ckm_feature_flags',
  /**
   * Cached site-page bundles (terms + privacy + future static pages),
   * keyed by slug under a single JSON map. See siteService.ts for the
   * read/write shape. Lets users see the legal copy offline after one
   * online fetch.
   */
  sitePages: 'ckm_site_pages',
} as const;

/**
 * Slug for the on-device Antoine system prompt as authored in the web
 * admin UI. Server filters by runtime — `device` prompts are returned
 * here; `server` prompts return 404 by design.
 */
export const ANTOINE_PROMPT_SLUG = 'antoine-system-prompt';

/**
 * Site-page slugs used by the in-app legal pages. Each maps to a
 * `GET /api/site-pages/:slug?surface=mobile` request via siteService.
 * The endpoint returns markdown + a title; the LegalPageScreen renders
 * it natively. The mobile rows are partitioned from the web rows in
 * the same `site_page` table, so editorial copy can diverge between
 * surfaces without conflict (per the 2026-05-03 web-side contract).
 */
export const SITE_PAGE_SLUGS = {
  terms: 'terms',
  privacy: 'privacy',
} as const;
export type SitePageSlug = (typeof SITE_PAGE_SLUGS)[keyof typeof SITE_PAGE_SLUGS];
