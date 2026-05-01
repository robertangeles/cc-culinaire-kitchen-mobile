import { StyleSheet, Text, View } from 'react-native';

import { LiteBadge } from '@/components/ui/LiteBadge';
import { fonts, palette } from '@/constants/theme';

type WordmarkSize = 'sm' | 'md' | 'lg';

interface WordmarkProps {
  size?: WordmarkSize;
  color?: string;
}

const SCALE: Record<WordmarkSize, number> = { sm: 0.55, md: 0.75, lg: 1 };

export function Wordmark({ size = 'lg', color = palette.ink }: WordmarkProps) {
  const scale = SCALE[size];
  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.culinaire,
          { color, fontSize: 38 * scale, letterSpacing: 38 * scale * 0.06 },
        ]}
      >
        CULINAIRE
      </Text>
      <Text style={[styles.kitchen, { fontSize: 30 * scale, marginTop: 2 * scale }]}>Kitchen</Text>
      <View style={{ marginTop: 8 * scale }}>
        <LiteBadge scale={scale} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  culinaire: { fontFamily: fonts.displayBold, lineHeight: 38 },
  kitchen: { fontFamily: fonts.script, color: palette.copper, lineHeight: 30 },
});
