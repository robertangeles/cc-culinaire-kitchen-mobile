import { type ReactNode, useCallback } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { fonts, layout, motion, palette, radii } from '@/constants/theme';

interface GhostButtonProps {
  children: ReactNode;
  onPress?: () => void;
  full?: boolean;
  leading?: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function GhostButton({
  children,
  onPress,
  full = true,
  leading,
  style,
  accessibilityLabel,
  disabled = false,
}: GhostButtonProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withTiming(pressed.value === 1 ? 0.97 : 1, {
          duration: motion.durations.micro,
          easing: motion.easing,
        }),
      },
    ],
    backgroundColor: pressed.value === 1 ? palette.paperDeep : palette.paperSoft,
  }));

  const onPressIn = useCallback(() => {
    pressed.value = 1;
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = 0;
  }, [pressed]);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[full ? styles.fullPressable : styles.pressable, disabled && styles.disabled, style]}
    >
      <Animated.View style={[styles.button, full && styles.full, animatedStyle]}>
        {leading}
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{children}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { alignSelf: 'flex-start' },
  fullPressable: { width: '100%' },
  full: { width: '100%' },
  button: {
    minHeight: layout.tap + 8,
    paddingHorizontal: 22,
    borderRadius: radii.sm + 4,
    borderWidth: 1,
    borderColor: palette.paperEdge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: { color: palette.ink, fontFamily: fonts.uiBold, fontSize: 16 },
  disabled: { opacity: 0.5 },
  labelDisabled: { color: palette.inkMuted },
});
