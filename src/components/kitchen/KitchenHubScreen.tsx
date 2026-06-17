import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow } from '@/components/ui/Eyebrow';
import { itemsForSection, KITCHEN_SECTIONS, type KitchenNavItem } from '@/constants/kitchenNav';
import { fonts, layout, motion, palette, radii, spacing, theme, type } from '@/constants/theme';

import { SoonChip } from './SoonChip';

/**
 * The Kitchen hub: a chef's-notebook table of contents. Each section is one
 * grouped inset surface (paperDeep) with hairline-divided rows — NOT a
 * card-per-feature mosaic. Tapping a row pushes the nested placeholder.
 *
 *   ┌─ Eyebrow: CREATIVE LABS ─────────────┐
 *   │ ▢ Recipe Lab                 [Soon] │
 *   │ ─────────────────────────────────── │
 *   │ ▢ Patisserie Lab             [Soon] │
 *   └──────────────────────────────────────┘
 */
export function KitchenHubScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const onPressItem = useCallback(
    (slug: string) => {
      // expo-router's typed-routes union doesn't include the new kitchen
      // routes until the dev server / prebuild regenerates types — cast as
      // never until then (same convention as RouteGuard's redirects).
      router.push({ pathname: '/(tabs)/kitchen/[slug]', params: { slug } } as never);
    },
    [router],
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.s4, paddingBottom: insets.bottom + spacing.s10 },
      ]}
    >
      <Text style={styles.title}>{t('kitchen.title')}</Text>

      {KITCHEN_SECTIONS.map((section) => {
        const items = itemsForSection(section.id);
        return (
          <Animated.View
            key={section.id}
            entering={FadeInDown.duration(motion.durations.base)}
            style={styles.section}
          >
            <View style={styles.eyebrowWrap}>
              <Eyebrow>{t(section.labelKey)}</Eyebrow>
            </View>
            <View style={styles.surface}>
              {items.map((item, index) => (
                <KitchenRow
                  key={item.slug}
                  item={item}
                  label={t(item.labelKey)}
                  first={index === 0}
                  onPress={onPressItem}
                />
              ))}
            </View>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

interface KitchenRowProps {
  item: KitchenNavItem;
  label: string;
  first: boolean;
  onPress: (slug: string) => void;
}

function KitchenRow({ item, label, first, onPress }: KitchenRowProps) {
  const { t } = useTranslation();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withTiming(pressed.value === 1 ? 0.98 : 1, {
          duration: motion.durations.micro,
          easing: motion.easing,
        }),
      },
    ],
    backgroundColor: pressed.value === 1 ? palette.paperEdge : 'transparent',
  }));

  const isPlaceholder = item.status === 'placeholder';
  const a11yLabel = isPlaceholder ? t('kitchen.a11y.soonRow', { feature: label }) : label;

  return (
    <Pressable
      onPress={() => onPress(item.slug)}
      onPressIn={() => {
        pressed.value = 1;
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <Animated.View style={[styles.row, !first && styles.rowDivider, animatedStyle]}>
        <Feather name={item.icon} size={20} color={palette.inkMuted} style={styles.rowIcon} />
        <Text style={styles.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        {isPlaceholder ? (
          <SoonChip />
        ) : (
          <Feather name="chevron-right" size={20} color={palette.inkFaint} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: spacing.s4 },
  title: { ...type.h1, color: palette.ink, marginBottom: spacing.s6 },
  section: { marginBottom: spacing.s6 },
  eyebrowWrap: { paddingHorizontal: spacing.s2, marginBottom: spacing.s2 },
  surface: {
    backgroundColor: palette.paperDeep,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.paperEdge,
    overflow: 'hidden',
  },
  row: {
    minHeight: layout.tap + 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
    gap: spacing.s3,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.paperEdge,
  },
  rowIcon: { width: 24, textAlign: 'center' },
  rowLabel: { ...type.ui, flex: 1, color: palette.ink, fontFamily: fonts.uiBold },
});
