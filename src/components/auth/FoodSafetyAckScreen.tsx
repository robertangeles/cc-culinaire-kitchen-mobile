/**
 * FoodSafetyAckScreen — pre-launch acknowledgement of the food-safety,
 * allergen, medical, and AI-output disclaimers from the Terms of
 * Service. Required before the user can reach the chat surface.
 *
 * Why a dedicated screen and not just "ToS scroll-and-accept on
 * sign-up": the food-safety / allergen / medical clause is the most
 * legally consequential section in the v1 launch. A separate explicit-
 * consent step materially strengthens enforceability under both
 * Australian Consumer Law and EU/UK consumer protection regimes — it
 * converts "buried in legal text" to "user actively acknowledged."
 *
 * Re-prompting: the screen reappears whenever
 * `FOOD_SAFETY_ACK_VERSION` (constants/config.ts) is bumped above the
 * SecureStore-persisted value. Bump the constant when the ToS food-
 * safety language is materially updated.
 *
 * Style: editorial-design system. Paper background, ink body, copper
 * primary CTA. Sentence case. No emoji. Numerals for measurements
 * inside the bullet copy.
 */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CopperButton } from '@/components/ui/CopperButton';
import { fonts, palette, spacing, theme } from '@/constants/theme';
import { useFoodSafetyStore } from '@/store/foodSafetyStore';

export function FoodSafetyAckScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const acknowledge = useFoodSafetyStore((s) => s.acknowledge);

  const onAcknowledge = () => {
    acknowledge();
    // RouteGuard reacts to the store change and routes to chat (or
    // onboarding if the model isn't on disk yet) on the next render —
    // no explicit navigation needed. The replace() below is defensive
    // for the rare case where the user got here via a deep link.
    router.replace('/(tabs)/chat');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.s5 }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.s8 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>{t('foodSafety.eyebrow')}</Text>
        <Text style={styles.title}>{t('foodSafety.title')}</Text>
        <Text style={styles.lede}>{t('foodSafety.lede')}</Text>

        <View style={styles.bullets}>
          <Bullet label={t('foodSafety.bullet1Label')} sub={t('foodSafety.bullet1Body')} />
          <Bullet label={t('foodSafety.bullet2Label')} sub={t('foodSafety.bullet2Body')} />
          <Bullet label={t('foodSafety.bullet3Label')} sub={t('foodSafety.bullet3Body')} />
          <Bullet label={t('foodSafety.bullet4Label')} sub={t('foodSafety.bullet4Body')} />
        </View>

        <Text style={styles.fineprint}>{t('foodSafety.fineprint')}</Text>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.s4 }]}>
        <CopperButton onPress={onAcknowledge}>{t('foodSafety.ackButton')}</CopperButton>
      </View>
    </View>
  );
}

function Bullet({ label, sub }: { label: string; sub: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <View style={styles.bulletBody}>
        <Text style={styles.bulletLabel}>{label}</Text>
        <Text style={styles.bulletSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: {
    paddingHorizontal: spacing.s5,
  },
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.98,
    color: palette.copperDeep,
    marginBottom: spacing.s3,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    color: palette.ink,
    marginBottom: spacing.s3,
  },
  lede: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: palette.inkMuted,
    marginBottom: spacing.s5,
  },
  bullets: { gap: spacing.s4, marginBottom: spacing.s6 },
  bulletRow: { flexDirection: 'row', gap: spacing.s3 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.copper,
    marginTop: 8,
  },
  bulletBody: { flex: 1, gap: 2 },
  bulletLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: palette.ink,
    lineHeight: 20,
  },
  bulletSub: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: palette.inkMuted,
  },
  fineprint: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 18,
    color: palette.inkMuted,
    fontStyle: 'italic',
  },
  ctaBar: {
    paddingHorizontal: spacing.s5,
    paddingTop: spacing.s3,
    backgroundColor: theme.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.paperEdge,
  },
});
