import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow } from '@/components/ui/Eyebrow';
import { GhostButton } from '@/components/ui/GhostButton';
import { fonts, palette, radii, spacing, theme, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { getCount } from '@/services/feedbackCount';

export function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const onSignOut = async () => {
    await signOut();
    router.replace('/(welcome)');
  };

  // Feedback submission counter — local AsyncStorage cache, namespaced
  // per user_id (cleared on sign-out by authStore). Re-read on focus so
  // the badge updates immediately after the user submits and returns.
  const [feedbackCount, setFeedbackCount] = useState(0);
  const userId = user?.userId;
  useFocusEffect(
    useCallback(() => {
      if (userId === undefined) return;
      let cancelled = false;
      void (async () => {
        const n = await getCount(userId);
        if (!cancelled) setFeedbackCount(n);
      })();
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const onOpenFeedback = () => {
    router.push('/(feedback)?from=settings' as never);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.s4, paddingBottom: insets.bottom + spacing.s10 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Eyebrow>{t('settings.title')}</Eyebrow>
      <Text style={styles.h1}>{t('settings.kitchen')}</Text>

      <View style={styles.sectionGap} />

      <Eyebrow>{t('settings.account')}</Eyebrow>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {(user?.userName ?? user?.userEmail ?? 'C')[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {user?.userName ?? t('settings.defaultChef')}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {user?.userEmail ?? '—'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionGap} />

      <Eyebrow>{t('settings.feedbackSection')}</Eyebrow>
      <Pressable
        onPress={onOpenFeedback}
        accessibilityRole="button"
        accessibilityLabel={t('settings.feedbackRowTitle')}
        style={styles.card}
      >
        <View style={styles.row}>
          <View style={styles.rowBody}>
            <View style={styles.feedbackTitleRow}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {t('settings.feedbackRowTitle')}
              </Text>
              {feedbackCount > 0 ? (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>
                    {feedbackCount >= 100
                      ? t('settings.feedbackCountBadgeMany')
                      : t('settings.feedbackCountBadge', { count: feedbackCount })}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.rowMeta}>{t('settings.feedbackRowSubtitle')}</Text>
          </View>
          <Feather name="chevron-right" size={20} color={palette.inkMuted} />
        </View>
      </Pressable>

      <View style={styles.sectionGap} />

      <Eyebrow>{t('settings.signOutSection')}</Eyebrow>
      <GhostButton onPress={onSignOut}>{t('settings.signOutButton')}</GhostButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: spacing.s5, gap: spacing.s2 },
  h1: { ...type.h1, color: palette.ink, marginTop: spacing.s2 },
  sectionGap: { height: spacing.s5 },
  card: {
    backgroundColor: palette.paperDeep,
    borderColor: palette.paperEdge,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.s4,
    gap: spacing.s4,
  },
  row: { flexDirection: 'row', gap: spacing.s3, alignItems: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { ...type.h4, color: palette.ink, flexShrink: 1 },
  rowMeta: { ...type.bodySm, color: palette.inkMuted, marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: palette.copperTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontFamily: fonts.displayBold, fontSize: 18, color: palette.copperDeep },
  feedbackTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s2 },
  activeBadge: {
    backgroundColor: palette.copperTint,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  activeBadgeText: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    letterSpacing: 1.62,
    textTransform: 'uppercase',
    color: palette.copperDeep,
  },
});
