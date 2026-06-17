import { Trans, useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { CopperButton } from '@/components/ui/CopperButton';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { fonts, palette, spacing, theme, type } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

interface OnboardingScreenProps {
  /**
   * Renamed from `onDownload` during the backend-chat pivot — there's no
   * model to download anymore; this is now a single "continue to chat"
   * tap. Kept as a prop so the route file controls navigation.
   */
  onDownload: () => void;
}

/**
 * Minimal welcome card. Previously hosted the on-device Antoine model
 * download CTA + Wi-Fi-only toggle + privacy bullets. The backend-chat
 * pivot removed the download; for now this is a single continue tap so
 * the (onboarding) route still resolves cleanly until it's replaced.
 */
export function OnboardingScreen({ onDownload }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const firstName = (user?.userName ?? user?.userEmail ?? 'chef').split(/[ @]/)[0] ?? 'chef';

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.s4, paddingBottom: insets.bottom + spacing.s5 },
      ]}
    >
      <View style={styles.glyphRow}>
        <BrandGlyph size={56} compact />
      </View>

      <View style={styles.heroBlock}>
        <Eyebrow>{t('onboarding.welcomeMessage', { firstName })}</Eyebrow>
        <Text style={styles.headline}>
          <Trans
            i18nKey="onboarding.headline"
            components={{ script: <Text style={styles.headlineScript} /> }}
          />
        </Text>
        <Text style={styles.lede}>{t('onboarding.lede')}</Text>
      </View>

      <View style={styles.spacer} />

      <CopperButton onPress={onDownload}>{t('onboarding.downloadButton')}</CopperButton>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: spacing.s5 },
  glyphRow: { alignItems: 'center', marginBottom: spacing.s5 },
  heroBlock: { alignItems: 'center', gap: spacing.s2, paddingHorizontal: spacing.s4 },
  headline: {
    ...type.h2,
    color: palette.ink,
    textAlign: 'center',
    letterSpacing: -0.14,
  },
  headlineScript: { fontFamily: fonts.script, color: palette.copper },
  lede: {
    ...type.body,
    color: palette.inkSoft,
    textAlign: 'center',
    marginTop: spacing.s2,
  },
  spacer: { flex: 1 },
});
