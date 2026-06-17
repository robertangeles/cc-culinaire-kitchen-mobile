import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette, radii, spacing } from '@/constants/theme';

/**
 * Small copper pill marking a not-yet-built feature in the Kitchen hub.
 * copperDeep on copperTint keeps contrast ≥ 4.5:1. No left-border accent,
 * no emoji — a quiet "Soon", not a shout.
 */
export function SoonChip() {
  const { t } = useTranslation();
  return (
    <View
      style={styles.chip}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.text}>{t('kitchen.soon')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: palette.copperTint,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.s2,
    paddingVertical: spacing.s1,
  },
  text: {
    color: palette.copperDeep,
    fontFamily: fonts.uiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
