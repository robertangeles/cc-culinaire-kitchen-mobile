/**
 * i18next initialization for CulinAIre Kitchen Lite.
 *
 * v1.1 PR-A scope: i18next is initialized at module load with the EN
 * resource bundle. The boot effect hydrates a persisted language
 * preference from SecureStore via the store. Device-locale auto-detect
 * (via `expo-localization`) is intentionally deferred to v1.2 where:
 * - 'fr' joins SUPPORTED_LANGUAGES, so device-locale detection actually
 *   does something useful
 * - The dev client is rebuilt anyway for the picker UI work, so the
 *   `expo-localization` native module gets linked at the same time
 *
 * In v1.1 with only 'en' supported, the device-locale path is already a
 * no-op (any non-EN device locale fails the supported-check), so adding
 * the native dep now buys nothing.
 *
 * Privacy: this module makes ZERO network calls. Resource bundles are
 * shipped statically with the JS bundle.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import { DEFAULT_LANGUAGE, useI18nStore } from '@/store/i18nStore';

/**
 * Static resource map. v1.2 ships en + fr (the FR bundle is a
 * placeholder — strings are still EN until a culinary-fluent reviewer
 * signs off the translation; see locales/fr.json `_meta.$comment`).
 * Add new languages by importing the JSON and adding a key here.
 */
const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const;

/**
 * Synchronous i18next init. Called once at module load (imported from
 * `app/_layout.tsx` boot path) so i18next is ready before first render.
 */
// eslint-disable-next-line import/no-named-as-default-member -- canonical i18next chain pattern
i18n.use(initReactI18next).init({
  // Default language at boot — overridden by the store hydrate effect if
  // the user has a persisted preference, or by the device-locale effect
  // if the persisted preference is empty.
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  resources,
  // We ship hierarchical-namespaced keys (per Eng review D5) so missing
  // keys returning the key string itself is the correct "I haven't
  // translated this yet" signal.
  returnNull: false,
  // React-specific: don't suspend; render with key fallback if a
  // translation is in flight (it never is for static bundles, but
  // defensive in case we add lazy-loading later).
  react: { useSuspense: false },
  // Disable dev-only warnings about missing keys for v1.1 since we ship
  // an empty namespace skeleton — extraction lands in PR-B.
  debug: false,
  interpolation: { escapeValue: false }, // React already escapes
});

export default i18n;

/**
 * Boot effect helper. Called once from the root layout's effect chain.
 *
 * v1.1 PR-A scope:
 *   1. Hydrate the store from SecureStore (sets store.language if persisted).
 *   2. If the resulting store language differs from i18next's current
 *      language, sync i18next.
 *
 * Device-locale auto-detect (step 3 of the original D2 plan) is deferred
 * to v1.2 alongside `expo-localization` and the picker UI. See the
 * docstring at the top of this file.
 *
 * Idempotent — safe to call from a useEffect with a stable dep list.
 */
export async function applyDeviceLocaleIfStoreEmpty(): Promise<void> {
  await useI18nStore.getState().hydrate();
  const current = useI18nStore.getState().language;

  if (i18n.language !== current) {
    // eslint-disable-next-line import/no-named-as-default-member -- canonical i18next API
    await i18n.changeLanguage(current).catch(() => undefined);
  }
}
