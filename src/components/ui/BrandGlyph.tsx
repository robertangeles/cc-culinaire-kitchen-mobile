import { Image, type ImageStyle } from 'expo-image';
import { type ImageSourcePropType, type StyleProp } from 'react-native';

const lockupSource = require('@assets/brand/ck-logo.png') as ImageSourcePropType;
const iconSource = require('@assets/brand/ck-logo-icon.png') as ImageSourcePropType;

interface BrandGlyphProps {
  size?: number;
  compact?: boolean;
  style?: StyleProp<ImageStyle>;
}

export function BrandGlyph({ size = 240, compact = false, style }: BrandGlyphProps) {
  const source = compact ? iconSource : lockupSource;
  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityLabel="CulinAIre Kitchen"
    />
  );
}
