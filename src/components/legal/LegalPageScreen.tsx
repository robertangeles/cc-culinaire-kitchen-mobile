/**
 * LegalPageScreen — renders a `site_page` (Terms, Privacy, etc.) from
 * the web-side mobile-surface API. Markdown body is rendered natively
 * via react-native-markdown-display, themed with the editorial-design
 * palette (paper background, ink body, copper accents).
 *
 * Render strategy:
 *   1. Show cached body immediately if any (so users can re-read
 *      offline after one online fetch).
 *   2. Fire a fresh fetch in parallel; on success, swap to the new
 *      copy and persist to SecureStore for future offline reads.
 *   3. On 404 (page is unpublished/missing on the mobile surface),
 *      show a friendly placeholder + "Try again" rather than empty.
 *   4. On network/server error with no cache: same placeholder UX,
 *      with retry. With cache: render cached body silently.
 *
 * Privacy: the endpoint is public, no Bearer token, no conversation
 * content ever sent. The fetch carries only the slug.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CopperButton } from '@/components/ui/CopperButton';
import { GhostButton } from '@/components/ui/GhostButton';
import { fonts, palette, spacing, theme } from '@/constants/theme';
import { getCachedSitePage, loadSitePage, type SitePageResolution } from '@/services/siteService';

interface LegalPageScreenProps {
  /** Slug to fetch from `/api/site-pages/:slug?surface=mobile`. */
  slug: string;
  /**
   * Fallback title shown while the network fetch is in flight and no
   * cache exists. The API's `title` field overrides this once the
   * response lands. Localised via i18n by the caller.
   */
  fallbackTitle: string;
}

export function LegalPageScreen({ slug, fallbackTitle }: LegalPageScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [resolution, setResolution] = useState<SitePageResolution | null>(null);
  const [refreshing, setRefreshing] = useState(true);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    // Read cache first for an instant render. The fresh fetch overrides.
    const cached = await getCachedSitePage(slug);
    if (cached) setResolution(cached);
    const fresh = await loadSitePage(slug);
    setResolution(fresh);
    setRefreshing(false);
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(welcome)');
  };

  const title = resolution?.status === 'ok' ? resolution.title : fallbackTitle;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <GhostButton onPress={onClose}>{t('legal.closeButton')}</GhostButton>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.s8 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>

        {resolution?.status === 'ok' ? (
          <Markdown style={markdownStyles}>{resolution.bodyMd}</Markdown>
        ) : null}

        {resolution?.status === 'unavailable' ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderTitle}>{t('legal.unavailableTitle')}</Text>
            <Text style={styles.placeholderBody}>{t('legal.unavailableBody')}</Text>
            <CopperButton onPress={() => void refresh()}>{t('legal.tryAgain')}</CopperButton>
          </View>
        ) : null}

        {resolution?.status === 'error' && resolution.cached ? (
          <Markdown style={markdownStyles}>{resolution.cached.bodyMd}</Markdown>
        ) : null}

        {resolution?.status === 'error' && !resolution.cached ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderTitle}>{t('legal.errorTitle')}</Text>
            <Text style={styles.placeholderBody}>{t('legal.errorBody')}</Text>
            <CopperButton onPress={() => void refresh()}>{t('legal.tryAgain')}</CopperButton>
          </View>
        ) : null}

        {refreshing && resolution === null ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.copper} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s2,
    paddingBottom: spacing.s2,
  },
  body: { paddingHorizontal: spacing.s5 },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 32,
    color: palette.ink,
    marginBottom: spacing.s4,
  },
  placeholder: { gap: spacing.s3, paddingTop: spacing.s5 },
  placeholderTitle: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.ink },
  placeholderBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: palette.inkMuted,
  },
  loading: { paddingTop: spacing.s8, alignItems: 'center' },
});

/**
 * Markdown style overrides that thread the editorial palette through
 * react-native-markdown-display's default style sheet. Keys match the
 * library's internal style map.
 */
const markdownStyles = StyleSheet.create({
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    color: palette.ink,
  },
  heading1: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: palette.ink,
    marginTop: spacing.s5,
    marginBottom: spacing.s2,
  },
  heading2: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 24,
    color: palette.ink,
    marginTop: spacing.s4,
    marginBottom: spacing.s2,
  },
  heading3: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    lineHeight: 22,
    color: palette.ink,
    marginTop: spacing.s3,
    marginBottom: spacing.s1,
  },
  paragraph: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    color: palette.ink,
    marginBottom: spacing.s3,
  },
  list_item: {
    marginBottom: spacing.s1,
  },
  bullet_list: { marginBottom: spacing.s3 },
  ordered_list: { marginBottom: spacing.s3 },
  link: { color: palette.copperDeep, textDecorationLine: 'underline' },
  strong: { fontFamily: fonts.bodyMedium },
  em: { fontStyle: 'italic' },
  hr: {
    backgroundColor: palette.paperEdge,
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.s4,
  },
});
