import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { CopperButton } from '@/components/ui/CopperButton';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { GhostButton } from '@/components/ui/GhostButton';
import { fonts, palette, radii, spacing, theme, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useModelDownload } from '@/hooks/useModelDownload';
import { useModelStore } from '@/store/modelStore';

export function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { state, progress, error, isActive, start, cancel } = useModelDownload();
  const wifiOnly = useModelStore((s) => s.wifiOnly);
  const setWifiOnly = useModelStore((s) => s.setWifiOnly);

  // When the user kicks off a download from Settings, jump them to the
  // dedicated DownloadingScreen — same UX as the first-launch flow
  // (rotating tips, big progress, network badge). Avoids two divergent
  // download UIs. Only fires when state transitions into 'downloading';
  // routing back to chat happens naturally in the downloading route's
  // onComplete handler when both files finish.
  useEffect(() => {
    if (state === 'downloading') {
      // Cast: typed routes is strict about the (group) syntax even
      // though it's a valid Expo Router URL.
      router.push('/(downloading)' as never);
    }
  }, [state, router]);

  // Tap to enable cellular: confirm first. Tap to switch back to
  // Wi-Fi-only: no confirmation (the safer choice doesn't need a gate).
  const onToggleWifiOnly = (next: boolean) => {
    if (next) {
      void setWifiOnly(true);
      return;
    }
    Alert.alert(t('settings.cellularWarning'), t('settings.cellularWarningBody'), [
      { text: t('settings.cellularCancel'), style: 'cancel' },
      {
        text: t('settings.cellularAllow'),
        style: 'destructive',
        onPress: () => {
          void setWifiOnly(false);
        },
      },
    ]);
  };

  const onSignOut = async () => {
    await signOut();
    router.replace('/(welcome)');
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

      <Eyebrow>{t('settings.onDeviceChef')}</Eyebrow>
      <ModelCard
        state={state}
        progress={progress}
        error={error}
        isActive={isActive}
        onStart={start}
        onCancel={cancel}
      />
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{t('settings.wifiOnly')}</Text>
            <Text style={styles.rowMeta}>
              {wifiOnly ? t('settings.wifiOnlyEnabled') : t('settings.cellularAllowed')}
            </Text>
          </View>
          <Switch
            value={wifiOnly}
            onValueChange={onToggleWifiOnly}
            trackColor={{ false: palette.paperEdge, true: palette.copper }}
            thumbColor={palette.paper}
          />
        </View>
      </View>
      <Text style={styles.privacyNote}>{t('settings.privacyNote')}</Text>

      <View style={styles.sectionGap} />

      <Eyebrow>{t('settings.signOutSection')}</Eyebrow>
      <GhostButton onPress={onSignOut}>{t('settings.signOutButton')}</GhostButton>
    </ScrollView>
  );
}

interface ModelCardProps {
  state: 'idle' | 'downloading' | 'ready' | 'error';
  progress: number;
  error: string | null;
  isActive: boolean;
  onStart: () => void;
  onCancel: () => void;
}

function ProgressBar({ value }: { value: number }) {
  const fill = useAnimatedStyle(() => ({
    width: withTiming(`${Math.round(value * 100)}%`, { duration: 200 }),
  }));
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fill]} />
    </View>
  );
}

function ModelCard({ state, progress, error, isActive, onStart, onCancel }: ModelCardProps) {
  const { t } = useTranslation();
  const status =
    state === 'ready'
      ? t('settings.modelLoaded')
      : state === 'downloading'
        ? t('settings.modelDownloading', { percent: Math.round(progress * 100) })
        : state === 'error'
          ? t('settings.modelFailed')
          : t('settings.modelNotDownloaded');

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      <View style={styles.row}>
        <View style={styles.modelAvatar}>
          <BrandGlyph size={36} compact />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.modelTitleRow}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              Antoine
            </Text>
            {isActive ? (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>{t('settings.modelActiveBadge')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rowMeta}>{status}</Text>
        </View>
      </View>

      {state === 'downloading' ? (
        <View style={styles.progressBlock}>
          <ProgressBar value={progress} />
          <Pressable onPress={onCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{t('settings.cancelDownload')}</Text>
          </Pressable>
        </View>
      ) : null}

      {state === 'error' && error ? <Text style={styles.errorText}>{error}</Text> : null}

      {state === 'idle' || state === 'error' ? (
        <View style={styles.cta}>
          <CopperButton onPress={onStart}>
            {state === 'error' ? t('settings.retryDownload') : t('settings.downloadAntoine')}
          </CopperButton>
        </View>
      ) : null}
    </View>
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
  cardActive: {
    borderColor: palette.copper,
    shadowColor: palette.copper,
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
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
  modelAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: palette.paperSoft,
    borderColor: palette.paperEdge,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s2 },
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
  progressBlock: { gap: spacing.s2 },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.paperEdge,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: palette.copper, borderRadius: 999 },
  cancelBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  cancelText: { fontFamily: fonts.uiBold, fontSize: 12, color: palette.inkMuted },
  errorText: { ...type.bodySm, color: palette.ember },
  cta: {},
  privacyNote: {
    ...type.caption,
    color: palette.inkMuted,
    paddingHorizontal: spacing.s2,
    marginTop: spacing.s2,
  },
});
