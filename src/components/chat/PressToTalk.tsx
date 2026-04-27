/**
 * Press-to-talk overlay (UI mock for v1).
 *
 * Per eng review: this is a pure UI simulation. No `expo-audio`, no actual
 * audio capture, no STT. The overlay shows a "recording…" state machine
 * while the parent holds the mic; on release, the parent inserts a stubbed
 * transcript bubble. Real audio + transcription is a deferred TODO.
 */
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { fonts, palette, radii, spacing } from '@/constants/theme';

import { MicIcon } from './icons';

interface PressToTalkProps {
  visible: boolean;
}

export function PressToTalk({ visible }: PressToTalkProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1.3, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [visible, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.scrim}>
        <View style={styles.bubble}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <View style={styles.center}>
            <MicIcon size={28} color={palette.textOnCopper} />
          </View>
        </View>
        <Text style={styles.label}>Listening… release to send</Text>
        <Text style={styles.hint}>Slide left to cancel</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(16,20,24,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s4,
  },
  bubble: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: radii.pill,
    backgroundColor: palette.copperTint,
    opacity: 0.55,
  },
  center: {
    width: 76,
    height: 76,
    borderRadius: radii.pill,
    backgroundColor: palette.copper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.textOnInk },
  hint: { fontFamily: fonts.ui, fontSize: 13, color: palette.paperEdge },
});
