/**
 * DiagnosticPreview — paper card revealing the literal JSON payload that
 * will be sent when the user toggles "Include diagnostic info" ON in
 * the feedback form.
 *
 * Built from the SAME `buildPayload()` function that `feedbackService.submit()`
 * uses for the POST body — single-source so the preview cannot drift
 * from what's actually sent (privacy invariant).
 *
 * Per the 2026-05-04 design review: monospace renders the JSON as code;
 * paper-deep card with paper-edge border matches the existing settings
 * card pattern; FadeInDown reveals on toggle ON.
 */
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { fonts, palette, radii, spacing } from '@/constants/theme';
import type { FeedbackPayload } from '@/services/feedbackPayload';

interface DiagnosticPreviewProps {
  payload: FeedbackPayload;
}

const MONO_FAMILY = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const MAX_HEIGHT = 240;

export function DiagnosticPreview({ payload }: DiagnosticPreviewProps) {
  const { t } = useTranslation();
  const json = JSON.stringify(payload, null, 2);
  return (
    <Animated.View entering={FadeInDown.duration(240)} style={styles.card}>
      <Text style={styles.heading}>{t('feedback.diagnosticPreviewHeading')}</Text>
      <ScrollView style={styles.scroll} nestedScrollEnabled>
        <View style={styles.codeWrap}>
          <Text style={styles.code} selectable>
            {json}
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.paperDeep,
    borderColor: palette.paperEdge,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.s4,
    gap: spacing.s2,
  },
  heading: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: palette.copperDeep,
  },
  scroll: {
    maxHeight: MAX_HEIGHT,
  },
  codeWrap: {
    paddingVertical: spacing.s1,
  },
  code: {
    fontFamily: MONO_FAMILY,
    fontSize: 12,
    lineHeight: 16,
    color: palette.ink,
  },
});
