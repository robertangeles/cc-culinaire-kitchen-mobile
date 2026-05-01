import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette } from '@/constants/theme';

interface LiteBadgeProps {
  /**
   * Visual scale. 1.0 ≈ 10pt cap height, 8px horizontal padding.
   * Keep in step with whichever mark this sits under (Wordmark or
   * BrandGlyph) so the badge never reads larger than the parent mark.
   */
  scale?: number;
}

/**
 * Small "LITE" badge that sits beneath the brand mark to disambiguate
 * the Lite build from the future Full fork.
 *
 * Visual treatment (locked to the design system — paper, ink, copper):
 * - Inter SemiBold (Caveat is reserved for "Kitchen", Fraunces is for
 *   display copy — Inter is the dense-UI / chip choice)
 * - Copper hairline outline + copper text
 * - Letter-spaced (~18% of font size) so the four characters carry
 *   weight without going large
 */
export function LiteBadge({ scale = 1 }: LiteBadgeProps) {
  return (
    <View
      style={[
        styles.pill,
        {
          paddingHorizontal: 8 * scale,
          paddingVertical: 2 * scale,
          borderRadius: 4 * scale,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: 10 * scale, letterSpacing: 10 * scale * 0.18 }]}>
        LITE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.copper,
  },
  text: {
    fontFamily: fonts.uiBold,
    color: palette.copper,
  },
});
