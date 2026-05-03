import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { HELLOS } from '@/constants/hellos';
import { fonts, palette, spacing, theme, type } from '@/constants/theme';
import { useRotatingText } from '@/hooks/useRotatingText';
import { useAuthStore } from '@/store/authStore';

const HELLO_CADENCE_MS = 3_500;

/**
 * Empty-state greeting on the chat screen. Rotates the word "Hello"
 * through major spoken languages every ~3.5 seconds, keeps the user's
 * first name static, and offers a simple "How can I help you today?"
 * prompt.
 *
 * Replaces the previous "Pick a Chef." / "Ask Antoine." dual empty
 * states. The download CTA that used to live in the empty card is no
 * longer needed because the new first-launch flow auto-routes users
 * with no model to the DownloadingScreen — by the time they reach this
 * greeting, the model is already loaded.
 *
 * Falls back to "Hello, chef" when the user payload doesn't have a
 * first name (rare; backend requires `userName`, but Google Sign-In
 * users with single-word display names still resolve cleanly).
 */
export function ChatGreeting() {
  const { t } = useTranslation();
  const userName = useAuthStore((s) => s.user?.userName);
  const firstName = (userName ?? '').trim().split(/\s+/)[0] || 'chef';

  const { value: hello, index: helloIndex } = useRotatingText(HELLOS, HELLO_CADENCE_MS);

  return (
    <View style={styles.root}>
      <View style={styles.glyph}>
        <BrandGlyph size={280} />
      </View>

      <View style={styles.greetingFrame}>
        <Animated.Text
          key={helloIndex}
          entering={FadeIn.duration(360)}
          exiting={FadeOut.duration(240)}
          style={styles.helloWord}
        >
          {hello}
        </Animated.Text>
        <Text style={styles.name}>, {firstName}</Text>
      </View>

      <Text style={styles.subtitle}>{t('chat.greeting')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s6,
  },
  glyph: { marginBottom: spacing.s5 },
  greetingFrame: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'wrap',
    minHeight: 44,
  },
  helloWord: {
    ...type.h2,
    fontFamily: fonts.display,
    color: palette.copperDeep,
  },
  name: {
    ...type.h2,
    fontFamily: fonts.display,
    color: palette.ink,
  },
  subtitle: {
    ...type.body,
    color: palette.inkSoft,
    textAlign: 'center',
    marginTop: spacing.s4,
  },
});
