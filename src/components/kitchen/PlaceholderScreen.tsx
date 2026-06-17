import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow } from '@/components/ui/Eyebrow';
import { getKitchenItem, KITCHEN_SECTIONS } from '@/constants/kitchenNav';
import { layout, motion, palette, spacing, theme, type } from '@/constants/theme';

/**
 * The placeholder for a not-yet-built Kitchen feature. Calm and intentional,
 * never a dead end: feature icon in copper (anchor) → name → one head-chef
 * line → section overline. Return via the custom back row, not a CTA.
 *
 * Unknown slug → graceful fallback (not a crash) so a stale deep link or a
 * typo'd route lands somewhere sensible.
 */
export function PlaceholderScreen({ slug }: { slug: string | undefined }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const item = getKitchenItem(slug);
  const section = item ? KITCHEN_SECTIONS.find((s) => s.id === item.section) : undefined;

  const label = item ? t(item.labelKey) : t('kitchen.unknown.title');
  const note = item ? t('kitchen.placeholder.note', { feature: label }) : t('kitchen.unknown.note');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('kitchen.back')}
          hitSlop={10}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={24} color={palette.copperDeep} />
        </Pressable>
        {section ? <Eyebrow>{t(section.labelKey)}</Eyebrow> : null}
      </View>

      <Animated.View entering={FadeInDown.duration(motion.durations.base)} style={styles.body}>
        <Feather
          name={item ? item.icon : 'help-circle'}
          size={56}
          color={palette.copper}
          style={styles.anchor}
        />
        <Text style={styles.name}>{label}</Text>
        <Text style={styles.note}>{note}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  backButton: {
    minWidth: layout.tap,
    minHeight: layout.tap,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s8,
    paddingBottom: spacing.s20,
    gap: spacing.s4,
  },
  anchor: { marginBottom: spacing.s2 },
  name: { ...type.h2, color: palette.ink, textAlign: 'center' },
  note: { ...type.body, color: palette.inkMuted, textAlign: 'center' },
});
