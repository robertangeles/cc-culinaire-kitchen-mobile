import { useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { CopperButton } from '@/components/ui/CopperButton';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { fonts, palette, spacing, theme, type } from '@/constants/theme';

interface Slide {
  eyebrow?: string;
  title: string;
  body: string;
  showLockup?: boolean;
}

const SLIDES: readonly Slide[] = [
  {
    title: 'A Chef in every pocket.',
    body: 'CulinAIre Kitchen is your on-device culinary intelligence. Calm, precise, and yours alone.',
    showLockup: true,
  },
  {
    eyebrow: 'On device',
    title: 'Your recipes never leave the phone.',
    body: 'Antoine runs locally. No cloud calls during inference. Your kitchen stays private by default.',
  },
  {
    eyebrow: 'Built for service',
    title: 'Diagnose, suggest, time.',
    body: 'Ask in plain language: a broken hollandaise, a 12-cover dinner, a dough that won’t rise. Antoine answers like a head chef.',
  },
] as const;

interface WelcomeCarouselProps {
  onGetStarted: () => void;
  onSkip?: () => void;
}

export function WelcomeCarousel({ onGetStarted, onSkip }: WelcomeCarouselProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {onSkip ? (
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip welcome"
          style={[styles.skip, { top: insets.top + spacing.s4 }]}
          hitSlop={12}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      ) : null}

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            {slide.showLockup ? (
              <View style={styles.heroLockup}>
                <BrandGlyph size={Math.min(width * 0.7, 280)} />
              </View>
            ) : (
              <View style={styles.heroIcon}>
                <BrandGlyph size={120} compact />
              </View>
            )}
            <View style={styles.copy}>
              {slide.eyebrow ? <Eyebrow>{slide.eyebrow}</Eyebrow> : null}
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.body}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.s5 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
        {isLast ? (
          <CopperButton onPress={onGetStarted}>Get started</CopperButton>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  skip: {
    position: 'absolute',
    right: spacing.s5,
    zIndex: 10,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  skipText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.inkMuted },
  scroll: { flex: 1 },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.s6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLockup: { marginBottom: spacing.s10 },
  heroIcon: { marginBottom: spacing.s10 },
  copy: { gap: spacing.s3, alignItems: 'center', maxWidth: 360 },
  title: { ...type.h1, color: palette.ink, textAlign: 'center', letterSpacing: -0.36 },
  body: {
    ...type.body,
    color: palette.inkSoft,
    textAlign: 'center',
    marginTop: spacing.s2,
  },
  footer: {
    paddingHorizontal: spacing.s6,
    gap: spacing.s5,
  },
  dots: { flexDirection: 'row', gap: 8, alignSelf: 'center' },
  dot: { width: 8, height: 8, borderRadius: 999 },
  dotActive: { backgroundColor: palette.copper, width: 24 },
  dotInactive: { backgroundColor: palette.paperEdge },
  spacer: { height: 60 },
});
