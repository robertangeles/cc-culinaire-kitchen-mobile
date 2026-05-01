import { Image, type ImageStyle } from 'expo-image';
import { StyleSheet, View, type ImageSourcePropType, type StyleProp } from 'react-native';

import { LiteBadge } from '@/components/ui/LiteBadge';

const lockupSource = require('@assets/brand/ck-logo.png') as ImageSourcePropType;
const iconSource = require('@assets/brand/ck-logo-icon.png') as ImageSourcePropType;

interface BrandGlyphProps {
  size?: number;
  compact?: boolean;
  style?: StyleProp<ImageStyle>;
  /**
   * Override the auto-decision for the "Lite" badge underneath the
   * mark. Default: shown when the mark is the full lockup AND big
   * enough to read a small pill underneath (~80px+). Small compact
   * icons (chat header, carousel paginator) suppress it.
   */
  withLiteBadge?: boolean;
}

export function BrandGlyph({ size = 240, compact = false, style, withLiteBadge }: BrandGlyphProps) {
  const source = compact ? iconSource : lockupSource;
  const showBadge = withLiteBadge ?? (!compact && size >= 80);
  // Scale the badge against the parent mark — a 280px hero gets the
  // default 1.0 pill; a 140px auth-screen lockup gets 0.85; a 96px
  // edge case gets 0.7. Keeps the badge from looking oversized
  // relative to the mark.
  const badgeScale = Math.min(1, Math.max(0.7, size / 280));
  if (!showBadge) {
    return (
      <Image
        source={source}
        style={[{ width: size, height: size }, style]}
        contentFit="contain"
        accessibilityLabel="CulinAIre Kitchen"
      />
    );
  }
  return (
    <View style={styles.column}>
      <Image
        source={source}
        style={[{ width: size, height: size }, style]}
        contentFit="contain"
        accessibilityLabel="CulinAIre Kitchen Lite"
      />
      <View style={{ marginTop: -size * 0.08 }}>
        <LiteBadge scale={badgeScale} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center' },
});
