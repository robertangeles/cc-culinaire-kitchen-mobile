import { type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { fonts, palette } from '@/constants/theme';

interface EyebrowProps {
  children: ReactNode;
  color?: string;
}

export function Eyebrow({ children, color = palette.copperDeep }: EyebrowProps) {
  return <Text style={[styles.text, { color }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.98,
    textTransform: 'uppercase',
  },
});
