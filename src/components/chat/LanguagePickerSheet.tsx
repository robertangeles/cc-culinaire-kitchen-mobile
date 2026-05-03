/**
 * LanguagePickerSheet — bottom-sheet picker for the user's UI + chat
 * language. Tapping a row sets the global `i18nStore.language` (which
 * fans out to SecureStore + i18next + the prompt-slug derivation in
 * useAntoine). Per-conversation language overrides exist in the data
 * model (`ckm_conversation.language`) but have no UI to set them in
 * v1.2 — the picker is global-only for the initial ship.
 *
 * Picker visibility rules (v1.2):
 *   - The picker ALWAYS shows the user's currently selected language
 *     so they can confirm/change it.
 *   - In production, the list of selectable rows is filtered to those
 *     in `featureFlags.languagesEnabled` (driven by the web-side
 *     `GET /api/mobile/feature-flags` endpoint).
 *   - In `__DEV__` builds, the list expands to every language in
 *     `SUPPORTED_LANGUAGES` so device testing can exercise FR before
 *     the web admin flips the production feature flag.
 *
 * The "partial-language" UX (no authored prompt for the picked
 * language) is handled downstream by the chat surface, which reads
 * `PromptResolution.isFallback` from `getActivePrompt`. The picker
 * itself never inspects prompt cache state.
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, palette, spacing } from '@/constants/theme';
import {
  getFeatureFlags,
  refreshFeatureFlags,
  type FeatureFlags,
} from '@/services/featureFlagsService';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, useI18nStore } from '@/store/i18nStore';

/**
 * Display name for each supported language, in its own script. Lives
 * here (not in the locale bundles) because every picker row is shown
 * in its native form regardless of the user's current language —
 * "English" stays "English", "Français" stays "Français" — so users
 * who don't speak the current UI language can still find their
 * language. This is the picker convention used by every major OS.
 */
const LANGUAGE_DISPLAY: Record<SupportedLanguage, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  fr: { native: 'Français', english: 'French' },
};

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

export const LanguagePickerSheet = forwardRef<BottomSheetModal>(
  function LanguagePickerSheet(_props, ref) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const language = useI18nStore((s) => s.language);
    const setLanguage = useI18nStore((s) => s.setLanguage);

    const snapPoints = useMemo(() => ['35%'], []);

    // Cache feature flags locally for synchronous render. Refresh on
    // mount (best-effort) so a freshly-flipped server flag surfaces
    // without waiting for the next cold launch.
    const [flags, setFlags] = useState<FeatureFlags | null>(null);
    useEffect(() => {
      let cancelled = false;
      void (async () => {
        const cached = await getFeatureFlags();
        if (!cancelled) setFlags(cached);
        const fresh = await refreshFeatureFlags();
        if (!cancelled) setFlags(fresh);
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    const enabledLanguages = useMemo<SupportedLanguage[]>(() => {
      // In dev, show every shipped bundle so we can exercise the picker
      // on device before the web admin flips the production flag.
      if (__DEV__) return [...SUPPORTED_LANGUAGES];
      const enabled = new Set(flags?.languagesEnabled ?? ['en']);
      // Always include the user's currently selected language so the
      // picker never hides the active state, even if the server flag
      // somehow drops a language the user already picked.
      enabled.add(language);
      return SUPPORTED_LANGUAGES.filter((l) => enabled.has(l));
    }, [flags, language]);

    const onPick = async (lang: SupportedLanguage) => {
      if (lang === language) {
        // Tapping the active row just dismisses — nothing to change.
        (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
        return;
      }
      await setLanguage(lang);
      (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
    };

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        bottomInset={insets.bottom}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.container}>
          <Text style={styles.eyebrow}>{t('chat.language').toUpperCase()}</Text>
          <View style={styles.list}>
            {enabledLanguages.map((lang) => {
              const display = LANGUAGE_DISPLAY[lang];
              const isActive = lang === language;
              return (
                <Pressable
                  key={lang}
                  onPress={() => void onPick(lang)}
                  style={[styles.row, isActive && styles.rowActive]}
                  accessibilityRole="button"
                  accessibilityLabel={display.english}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.native}>{display.native}</Text>
                    {display.native !== display.english ? (
                      <Text style={styles.english}>{display.english}</Text>
                    ) : null}
                  </View>
                  {isActive ? <View style={styles.activeDot} /> : null}
                </Pressable>
              );
            })}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  bg: { backgroundColor: palette.paper },
  handle: { backgroundColor: palette.paperEdge, width: 40 },
  container: { paddingHorizontal: spacing.s5, paddingTop: spacing.s2 },
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.98,
    color: palette.copperDeep,
    marginBottom: spacing.s3,
  },
  list: { gap: spacing.s1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s3,
    borderRadius: 12,
  },
  rowActive: { backgroundColor: palette.copperTint },
  rowBody: { flex: 1, gap: 2 },
  native: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.ink },
  english: { fontFamily: fonts.ui, fontSize: 12, color: palette.inkMuted },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.copper,
    marginLeft: spacing.s3,
  },
});
