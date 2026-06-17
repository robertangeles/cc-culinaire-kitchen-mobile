import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { palette, spacing, theme, type } from '@/constants/theme';

interface DownloadingScreenProps {
  /**
   * Retained for API compatibility with the prior on-device-download
   * flow. Always at 1 now — there's nothing to download. The prop is
   * kept so tests + callers don't break while the backend-chat pivot is
   * in flight.
   */
  progress: number;
  /** Called once on mount. Kept for parity with the prior shape. */
  onMount: () => void;
  /** Called when the screen is ready to hand off — typically routes to chat. */
  onComplete: () => void;
}

/**
 * Previously the 6+ GB Antoine GGUF download screen. The backend-chat
 * pivot removed on-device inference; this is now a placeholder that
 * fires `onMount` once and `onComplete` once so the route file's
 * navigation logic still works. No setup required.
 */
export function DownloadingScreen({ progress, onMount, onComplete }: DownloadingScreenProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    onMount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (progress >= 1) onComplete();
  }, [progress, onComplete]);

  const pct = Math.round(progress * 100);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.s5, paddingBottom: insets.bottom + spacing.s6 },
      ]}
    >
      <View style={styles.glyph}>
        <BrandGlyph size={280} />
      </View>

      <Text style={styles.title}>Antoine is moving in</Text>
      <Text style={styles.body}>No setup needed — you&apos;re all set.</Text>

      <View style={styles.spacer} />

      <Text style={styles.progressLabel}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: spacing.s6,
  },
  glyph: { alignItems: 'center', marginTop: spacing.s4 },
  title: {
    ...type.h2,
    textAlign: 'center',
    color: palette.ink,
    marginTop: spacing.s5,
  },
  body: {
    ...type.body,
    textAlign: 'center',
    color: palette.inkSoft,
    paddingHorizontal: spacing.s4,
    marginTop: spacing.s3,
  },
  spacer: { flex: 1, minHeight: spacing.s6 },
  progressLabel: {
    ...type.uiSm,
    color: palette.inkMuted,
    textAlign: 'center',
  },
});
