import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useCallback } from 'react';
import {
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { fonts, layout, motion, palette, radii, shadows } from '@/constants/theme';

interface CopperButtonProps {
  children: ReactNode;
  onPress?: () => void;
  full?: boolean;
  disabled?: boolean;
  leading?: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export function CopperButton({
  children,
  onPress,
  full = true,
  disabled = false,
  leading,
  style,
  accessibilityLabel,
}: CopperButtonProps) {
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
  }));

  const onPressIn = useCallback(() => {
    pressed.value = 1;
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = 0;
  }, [pressed]);

  const renderContent = useCallback(
    (_state: PressableStateCallbackType) => (
      <AnimatedGradient
        colors={[palette.copper, palette.copperDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.button, full && styles.full, animatedStyle, disabled && styles.disabled]}
      >
        {leading}
        <Text style={styles.label}>{children}</Text>
      </AnimatedGradient>
    ),
    [animatedStyle, disabled, full, leading, children],
  );

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[full ? styles.fullPressable : styles.pressable, style]}
    >
      {renderContent}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.e2,
  },
  disabled: { opacity: 0.5 },
  label: {
    color: palette.textOnCopper,
    fontFamily: fonts.uiBold,
    fontSize: 16,
    letterSpacing: 0.16,
  },
});
