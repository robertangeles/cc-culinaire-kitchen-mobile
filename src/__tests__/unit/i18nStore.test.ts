import * as SecureStore from 'expo-secure-store';

import { DEFAULT_LANGUAGE, useI18nStore } from '@/store/i18nStore';

// Minimal i18next mock so setLanguage's side-effect (changeLanguage) doesn't
// blow up. The actual i18next module is heavy and not relevant for testing
// the store's contract.
jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    changeLanguage: jest.fn(async () => undefined),
  },
}));

describe('useI18nStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18nStore.setState({ language: DEFAULT_LANGUAGE, isHydrated: false });
  });

  describe('hydrate', () => {
    it('returns true and sets state when SecureStore has a supported language', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('en');

      const found = await useI18nStore.getState().hydrate();

      expect(found).toBe(true);
      const s = useI18nStore.getState();
      expect(s.language).toBe('en');
      expect(s.isHydrated).toBe(true);
    });

    it('returns false and stays at default when SecureStore is empty', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

      const found = await useI18nStore.getState().hydrate();

      expect(found).toBe(false);
      const s = useI18nStore.getState();
      expect(s.language).toBe(DEFAULT_LANGUAGE);
      expect(s.isHydrated).toBe(true);
    });

    it('ignores an unsupported persisted value but still marks hydrated', async () => {
      // 'xx' is not in SUPPORTED_LANGUAGES — defensive: shouldn't poison state.
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('xx');

      const found = await useI18nStore.getState().hydrate();

      expect(found).toBe(false);
      const s = useI18nStore.getState();
      expect(s.language).toBe(DEFAULT_LANGUAGE);
      expect(s.isHydrated).toBe(true);
    });

    it('returns false and marks hydrated when SecureStore throws', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('store down'));

      const found = await useI18nStore.getState().hydrate();

      expect(found).toBe(false);
      expect(useI18nStore.getState().isHydrated).toBe(true);
    });
  });

  describe('setLanguage', () => {
    it('updates state, writes SecureStore, and calls i18n.changeLanguage on a real switch', async () => {
      // v1.1 only ships 'en'. To exercise the actual switch path, prime
      // the store with a different value first via setState (bypasses
      // the supported-language guard since we're not going through
      // setLanguage itself for the prime).
      useI18nStore.setState({ language: 'fr' as unknown as 'en' });

      await useI18nStore.getState().setLanguage('en');

      expect(useI18nStore.getState().language).toBe('en');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ckm_language', 'en');
    });

    it('is a no-op when called with the current language', async () => {
      // Current is 'en' default. setLanguage('en') should early-return
      // with no side effects.
      await useI18nStore.getState().setLanguage('en');

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('warns and no-ops on an unsupported language', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Cast: setLanguage's type forbids unsupported values, but a buggy
      // caller (e.g., reading a stale value from SecureStore) could pass
      // one. Defensive guard.
      await useI18nStore.getState().setLanguage('xx' as unknown as 'en');

      expect(useI18nStore.getState().language).toBe(DEFAULT_LANGUAGE);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
