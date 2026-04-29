import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { ASSISTANT_NAME } from '@/constants/config';
import { COOKING_TIPS } from '@/constants/hellos';
import { fonts, palette, radii, spacing, theme, type } from '@/constants/theme';
import { useRotatingText } from '@/hooks/useRotatingText';
import { useModelStore } from '@/store/modelStore';

interface DownloadingScreenProps {
  /** 0..1 — current download progress, driven by useModelStore. */
  progress: number;
  /** Called once on mount to start the download (auto-trigger). */
  onMount: () => void;
  /** Called when progress reaches 1 — typically routes user to chat. */
  onComplete: () => void;
}

const TIP_CADENCE_MS = 4_000;

/**
 * Auto-starts the model download on mount, shows progress + ETA + a
 * rotating culinary tip as entertainment during the 6-7 GB download.
 *
 * UX rationale: target audience is culinary professionals, generally
 * not tech-savvy. Hand-hold rather than ask them to find a button.
 * Entertainment during the wait keeps them engaged so they don't bail.
 *
 * The progress prop is wired from `useModelStore.progress` (0..1).
 * onMount kicks off the download via the parent's `useModelDownload.start`.
 * onComplete fires when progress reaches 1 — parent routes to chat.
 */
export function DownloadingScreen({ progress, onMount, onComplete }: DownloadingScreenProps) {
  const insets = useSafeAreaInsets();
  const { value: tip, index: tipIndex } = useRotatingText(COOKING_TIPS, TIP_CADENCE_MS);
  const wifiOnly = useModelStore((s) => s.wifiOnly);

  // Fire onMount exactly once. The parent route is responsible for not
  // re-mounting unnecessarily; if it does, the underlying useModelDownload
  // hook is idempotent (returns early if a handle is already active).
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

      <Text style={styles.title}>{ASSISTANT_NAME} is moving in.</Text>
      <Text style={styles.body}>
        Downloading once, then everything happens on your phone — no internet needed to cook with{' '}
        {ASSISTANT_NAME}.
      </Text>

      <View style={styles.spacer} />

      <View style={styles.tipFrame}>
        {/* Re-mount on tipIndex change so FadeIn re-runs. */}
        <Animated.Text
          key={tipIndex}
          entering={FadeIn.duration(360)}
          exiting={FadeOut.duration(240)}
          style={styles.tip}
        >
          {tip}
        </Animated.Text>
      </View>

      <View style={styles.spacer} />

      <View style={styles.progressBlock}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.progressLabel}>{pct}%</Text>
          <View style={styles.networkBadge}>
            <Text style={styles.networkBadgeText}>
              {wifiOnly ? 'Wi-Fi only' : 'Cellular allowed'}
            </Text>
          </View>
        </View>
      </View>
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
  tipFrame: {
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.s4,
  },
  tip: {
    ...type.body,
    fontFamily: fonts.body,
    color: palette.copperDeep,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  progressBlock: { gap: spacing.s2 },
  progressTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: palette.paperDeep,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.copper,
    borderRadius: radii.pill,
  },
  progressLabel: {
    ...type.uiSm,
    color: palette.inkMuted,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  networkBadge: {
    backgroundColor: palette.copperTint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  networkBadgeText: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    letterSpacing: 1.62,
    textTransform: 'uppercase',
    color: palette.copperDeep,
  },
});
