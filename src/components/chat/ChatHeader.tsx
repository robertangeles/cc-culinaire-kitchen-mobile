import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { fonts, palette, radii, spacing, theme } from '@/constants/theme';
import { useI18nStore } from '@/store/i18nStore';

import { DownloadIcon, MoreIcon } from './icons';

interface ChatHeaderProps {
  modelReady: boolean;
  onPressDownload: () => void;
  onPressMore: () => void;
}

export function ChatHeader({ modelReady, onPressDownload, onPressMore }: ChatHeaderProps) {
  const { t } = useTranslation();
  // Show a small language badge to the right of "Antoine" only when the
  // active language is NOT EN. EN users get no extra chrome (the 99%
  // case); FR/IT/etc. users get an at-a-glance signal of which language
  // Antoine is currently responding in. Asked for by a French speaker
  // testing v1.2 — without the badge, language state was only visible
  // by opening the kebab menu.
  const language = useI18nStore((s) => s.language);
  const showLanguageBadge = language !== 'en';
  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <BrandGlyph compact size={28} />
        <View style={styles.brandText}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Antoine</Text>
            {showLanguageBadge ? (
              <View style={styles.langBadge} accessibilityLabel={`Language ${language}`}>
                <Text style={styles.langBadgeText}>{language.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={modelReady ? undefined : onPressDownload}
            style={[styles.pill, modelReady ? styles.pillReady : styles.pillNeedsModel]}
            accessibilityRole={modelReady ? undefined : 'button'}
            accessibilityLabel={
              modelReady ? t('chat.headerModelReady') : t('chat.headerDownloadModel')
            }
          >
            {!modelReady ? <DownloadIcon size={11} color={palette.copperDeep} /> : null}
            <Text
              style={[styles.pillText, modelReady ? styles.pillTextReady : styles.pillTextNeed]}
            >
              {modelReady ? t('chat.headerLoaded') : t('chat.headerNoModel')}
            </Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={onPressMore}
        style={styles.more}
        accessibilityRole="button"
        accessibilityLabel={t('chat.moreActions')}
        hitSlop={10}
      >
        <MoreIcon size={22} color={palette.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
    backgroundColor: theme.bg,
    borderBottomColor: theme.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.s3,
  },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.s3 },
  brandText: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 18, color: palette.ink },
  langBadge: {
    backgroundColor: palette.copperTint,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  langBadgeText: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: palette.copperDeep,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  pillReady: { backgroundColor: '#E8EDE6' },
  pillNeedsModel: { backgroundColor: palette.copperTint },
  pillText: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 0.6 },
  pillTextReady: { color: palette.herb },
  pillTextNeed: { color: palette.copperDeep },
  more: { padding: spacing.s2 },
});
