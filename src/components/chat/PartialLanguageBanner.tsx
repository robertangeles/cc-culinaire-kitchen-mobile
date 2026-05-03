/**
 * PartialLanguageBanner — surfaces the v1.2 partial-language UX.
 *
 * When the user picks a language whose Antoine system prompt has not
 * yet been authored on the web side, the prompt fetch returns 404,
 * `promptCacheService` marks the slug `not_found`, and `getActivePrompt`
 * resolves to the EN body with `isFallback: true`. This banner makes
 * that state visible so the user understands why their replies are
 * coming back in English instead of their picked language.
 *
 * Why a banner and not a toast: persistent state (lasts until the web
 * admin authors the FR prompt and the device's next cold-launch
 * refresh succeeds), and it's a status indicator rather than an event.
 *
 * Layout: a paper card with a copper accent stripe, sits above the
 * ChatList in the screen layout. Tappable hint at the right edge in
 * case we ever want to expand into a "what does this mean?" sheet —
 * for v1.2 the tap is a no-op and the banner is read-only.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette, spacing } from '@/constants/theme';
import { getActivePrompt, slugForLanguage } from '@/services/promptCacheService';
import { useI18nStore } from '@/store/i18nStore';

export function PartialLanguageBanner() {
  const { t } = useTranslation();
  const language = useI18nStore((s) => s.language);
  const [isPartial, setIsPartial] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // EN is never "partial" — we always have a baked-in EN prompt.
    if (language === 'en') {
      setIsPartial(false);
      return;
    }
    void (async () => {
      const resolution = await getActivePrompt(slugForLanguage(language));
      if (!cancelled) setIsPartial(resolution.isFallback);
    })();
    return () => {
      cancelled = true;
    };
  }, [language]);

  if (!isPartial) return null;

  return (
    <View style={styles.root} accessibilityRole="alert">
      <View style={styles.stripe} />
      <View style={styles.body}>
        <Text style={styles.title}>{t('chat.partialLanguageTitle')}</Text>
        <Text style={styles.message}>
          {t('chat.partialLanguageBody', { language: language.toUpperCase() })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    backgroundColor: palette.paperDeep,
    marginHorizontal: spacing.s4,
    marginTop: spacing.s2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stripe: { width: 4, backgroundColor: palette.copper },
  body: { flex: 1, paddingVertical: spacing.s3, paddingHorizontal: spacing.s4 },
  title: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: palette.ink,
    marginBottom: 2,
  },
  message: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: palette.inkMuted,
    lineHeight: 17,
  },
});
