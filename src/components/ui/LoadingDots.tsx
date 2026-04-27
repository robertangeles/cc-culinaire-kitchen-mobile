import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/constants/theme';

interface LoadingDotsProps {
  color?: string;
  size?: number;
}

export function LoadingDots({ color = palette.copperDeep, size = 6 }: LoadingDotsProps) {
  const a = useSharedValue(0.25);
  const b = useSharedValue(0.25);
  const c = useSharedValue(0.25);

  useEffect(() => {
    const cycle = (sv: typeof a, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
            withTiming(0.25, { duration: 320, easing: Easing.in(Easing.quad) }),
          ),
          -1,
          false,
        ),
      );
    };
    cycle(a, 0);
    cycle(b, 160);
    cycle(c, 320);
  }, [a, b, c]);

  const aStyle = useAnimatedStyle(() => ({ opacity: a.value }));
  const bStyle = useAnimatedStyle(() => ({ opacity: b.value }));
  const cStyle = useAnimatedStyle(() => ({ opacity: c.value }));

  return (
    <View style={styles.row}>
      <Animated.View
        style={[styles.dot, { width: size, height: size, backgroundColor: color }, aStyle]}
      />
      <Animated.View
        style={[styles.dot, { width: size, height: size, backgroundColor: color }, bStyle]}
      />
      <Animated.View
        style={[styles.dot, { width: size, height: size, backgroundColor: color }, cStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { borderRadius: 999 },
});
