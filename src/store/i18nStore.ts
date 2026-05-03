/**
 * Single source of truth for the user's selected language.
 *
 * v1.1 architecture (per CEO + Eng review 2026-05-03):
 * - This Zustand store is THE truth. Components subscribe via `useI18nStore`.
 * - `setLanguage()` writes to SecureStore (durable persistence) AND calls
 *   `i18n.changeLanguage()` (i18next runtime sync) as side effects. Never
 *   call those layers directly from components.
 * - Per-conversation override (v1.2) layers a derived selector ON TOP of
 *   this store: `useEffectiveLanguage(conversationId)` reads the
 *   conversation's `language` column, falls back to this store's value
 *   when null.
 * - SecureStore is durable; this store is hydrated from SecureStore at
 *   boot via `hydrate()`. i18next is initialized with whatever this store
 *   says at boot time (or the device locale if the store is empty).
 *
 * v1.1 PR-A: store wired, no UI consumer yet. UI looks identical pre/post
 * because no t() calls exist yet (extraction lands in PR-B).
 */
import i18n from 'i18next';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { STORAGE_KEYS } from '@/constants/config';

/**
 * Default language used when neither SecureStore nor device locale yields
 * a supported value. v1.1 ships only `en`; v1.2 adds `fr`.
 */
export const DEFAULT_LANGUAGE = 'en';

/**
 * Languages whose UI bundle is shipped in this build. v1.1 ships en only.
 * v1.2 will add 'fr' and gate per-language picker visibility on the
 * web-side feature flag (per Eng review D4) — but the UI bundle list lives
 * here regardless of feature-flag state.
 */
export const SUPPORTED_LANGUAGES = ['en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

interface I18nStore {
  /** Currently active language code. Always one of SUPPORTED_LANGUAGES. */
  language: SupportedLanguage;
  /**
   * True once the SecureStore-stored language has been read into the
   * store at boot. Components that need to wait for a stable language
   * before rendering subscribe to this; in v1.1 nothing actually reads
   * it because nothing reacts to language yet.
   */
  isHydrated: boolean;

  /**
   * Set the user's language. Writes to SecureStore (durable) and calls
   * i18n.changeLanguage() (runtime). Single entrypoint — components must
   * not write to SecureStore or i18next directly.
   */
  setLanguage: (lang: SupportedLanguage) => Promise<void>;

  /**
   * Boot-time read of the SecureStore-stored language. If absent or
   * unsupported, leaves the store at DEFAULT_LANGUAGE (which is the
   * initial state). Marks `isHydrated = true` regardless.
   *
   * Returns `true` when a supported persisted language was found, so
   * the caller can skip device-locale auto-detect.
   */
  hydrate: () => Promise<boolean>;
}

function isSupported(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export const useI18nStore = create<I18nStore>((set, get) => ({
  language: DEFAULT_LANGUAGE,
  isHydrated: false,

  setLanguage: async (lang) => {
    if (!isSupported(lang)) {
      // Defensive: components shouldn't pass unsupported values, but if
      // they do (e.g. plumbing a device-detected locale that's not
      // bundled yet), no-op rather than corrupt persistent state.
      console.warn(`[i18nStore] setLanguage called with unsupported '${lang}' — ignored`);
      return;
    }
    if (get().language === lang) return;

    set({ language: lang });
    // Side effect 1: durable persistence.
    await SecureStore.setItemAsync(STORAGE_KEYS.language, lang).catch((e) => {
      console.warn('[i18nStore] SecureStore write failed:', e);
    });
    // Side effect 2: i18next runtime sync. Failure here doesn't crash
    // anything — i18next just stays at the prior language until the
    // next render that reads from it.
    // eslint-disable-next-line import/no-named-as-default-member -- canonical i18next API
    await i18n.changeLanguage(lang).catch((e) => {
      console.warn('[i18nStore] i18n.changeLanguage failed:', e);
    });
  },

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEYS.language);
      if (stored && isSupported(stored)) {
        set({ language: stored, isHydrated: true });
        // Don't fire i18n.changeLanguage here — the boot effect in
        // src/i18n/index.ts handles syncing i18next AFTER hydrate
        // returns, so we don't double-fire.
        return true;
      }
    } catch (e) {
      console.warn('[i18nStore] SecureStore read failed:', e);
    }
    set({ isHydrated: true });
    return false;
  },
}));
