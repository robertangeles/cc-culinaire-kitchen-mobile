import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

interface WelcomeCarouselProps {
  onGetStarted: () => void;
  onSkip?: () => void;
}

export function WelcomeCarousel({ onGetStarted, onSkip }: WelcomeCarouselProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  // Built inside the component so translations stay reactive to language
  // changes (i18next re-renders consumers on switch).
  const slides: readonly Slide[] = useMemo(
    () => [
      {
        title: t('welcome.slide1Title'),
        body: t('welcome.slide1Body'),
        showLockup: true,
      },
      {
        eyebrow: t('welcome.slide2Eyebrow'),
        title: t('welcome.slide2Title'),
        body: t('welcome.slide2Body'),
      },
      {
        eyebrow: t('welcome.slide3Eyebrow'),
        title: t('welcome.slide3Title'),
        body: t('welcome.slide3Body'),
      },
    ],
    [t],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const isLast = index === slides.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {onSkip ? (
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={t('welcome.skipButton')}
          style={[styles.skip, { top: insets.top + spacing.s4 }]}
          hitSlop={12}
        >
          <Text style={styles.skipText}>{t('welcome.skipButton')}</Text>
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
        {slides.map((slide, i) => (
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
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
        {isLast ? (
          <CopperButton onPress={onGetStarted}>{t('welcome.getStarted')}</CopperButton>
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
