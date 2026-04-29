import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { CopperButton } from '@/components/ui/CopperButton';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ASSISTANT_NAME } from '@/constants/config';
import { fonts, palette, radii, spacing, theme, type } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useModelStore } from '@/store/modelStore';

interface OnboardingScreenProps {
  onDownload: () => void;
}

interface PrivacyDotProps {
  on?: boolean;
  label: string;
  sub: string;
}

function PrivacyDot({ on = false, label, sub }: PrivacyDotProps) {
  return (
    <View style={styles.dotRow}>
      <View style={[styles.dotIcon, on ? styles.dotIconOn : styles.dotIconOff]}>
        {on ? (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 6L9 17l-5-5"
              stroke={palette.herb}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={9} stroke={palette.copperDeep} strokeWidth={2.2} />
            <Path
              d="M12 8v4M12 16h.01"
              stroke={palette.copperDeep}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          </Svg>
        )}
      </View>
      <View style={styles.dotText}>
        <Text style={styles.dotLabel}>{label}</Text>
        <Text style={styles.dotSub}>{sub}</Text>
      </View>
    </View>
  );
}

function DownloadIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v12M6 11l6 6 6-6M5 21h14"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function OnboardingScreen({ onDownload }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const wifiOnly = useModelStore((s) => s.wifiOnly);
  const setWifiOnly = useModelStore((s) => s.setWifiOnly);
  const firstName = (user?.userName ?? user?.userEmail ?? 'chef').split(/[ @]/)[0] ?? 'chef';

  // Same Alert pattern as Settings: enabling Wi-Fi-only is the safe
  // default and needs no prompt; opting in to cellular shows a
  // confirmation because Antoine is ~6 GB.
  const onToggleWifiOnly = (next: boolean) => {
    if (next) {
      void setWifiOnly(true);
      return;
    }
    Alert.alert(
      'Allow cellular downloads?',
      'Antoine is about 6 GB. Downloading on cellular may use significant data and could be slow.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Allow cellular',
          style: 'destructive',
          onPress: () => {
            void setWifiOnly(false);
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.s4 }]}>
      <View style={styles.glyphRow}>
        <BrandGlyph size={56} compact />
      </View>

      <View style={styles.heroBlock}>
        <Eyebrow>Welcome, {firstName}</Eyebrow>
        <Text style={styles.headline}>
          Your Chef runs <Text style={styles.headlineScript}>on this phone.</Text>
        </Text>
        <Text style={styles.lede}>
          Pick a model once. After that, recipes, conversions, and prep stay on the device — no
          cloud round-trips, no leaks.
        </Text>
      </View>

      <View style={styles.dots}>
        <PrivacyDot
          on
          label="Recipes & prep stay on device"
          sub="Your kitchen IP never leaves the phone."
        />
        <PrivacyDot
          on
          label="Works offline mid-service"
          sub="No signal in the walk-in? Still answers."
        />
        <PrivacyDot
          label="One-time download, ~5.9 GB"
          sub="Pause and resume any time. Download policy below."
        />
      </View>

      <View style={styles.spacer} />

      <ModelCard />

      <View style={styles.networkRow}>
        <View style={styles.networkLabel}>
          <Text style={styles.networkTitle}>Wi-Fi only</Text>
          <Text style={styles.networkSub}>
            {wifiOnly ? 'Recommended. Saves cellular data.' : 'Cellular allowed.'}
          </Text>
        </View>
        <Switch
          value={wifiOnly}
          onValueChange={onToggleWifiOnly}
          trackColor={{ false: palette.paperEdge, true: palette.copper }}
          thumbColor={palette.paper}
        />
      </View>

      <View style={[styles.ctas, { paddingBottom: insets.bottom + spacing.s5 }]}>
        <CopperButton onPress={onDownload} leading={<DownloadIcon color={palette.textOnCopper} />}>
          Get Antoine · 5.9 GB
        </CopperButton>
      </View>
    </View>
  );
}

function ModelCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardAvatar}>
          <BrandGlyph size={36} compact />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Antoine</Text>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeText}>Recommended</Text>
            </View>
          </View>
          <Text style={styles.cardMeta}>5.9 GB · runs locally on your phone</Text>
        </View>
      </View>
      <Text style={styles.cardCopy}>
        This is the AI brain that powers {ASSISTANT_NAME}. Downloading it once means every question
        — recipes, conversions, plating ideas — is answered on your phone, with no internet. Nothing
        you ask leaves the device.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: spacing.s5 },
  glyphRow: { alignItems: 'center', marginBottom: spacing.s5 },
  heroBlock: { alignItems: 'center', gap: spacing.s2, paddingHorizontal: spacing.s4 },
  headline: {
    ...type.h2,
    color: palette.ink,
    textAlign: 'center',
    letterSpacing: -0.14,
  },
  headlineScript: { fontFamily: fonts.script, color: palette.copper },
  lede: {
    ...type.body,
    color: palette.inkSoft,
    textAlign: 'center',
    marginTop: spacing.s2,
  },
  dots: { gap: spacing.s3 + 2, marginTop: spacing.s6 },
  dotRow: { flexDirection: 'row', gap: spacing.s3, alignItems: 'flex-start' },
  dotIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotIconOn: { backgroundColor: '#E8EDE6' },
  dotIconOff: { backgroundColor: palette.copperTint },
  dotText: { flex: 1 },
  dotLabel: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.ink },
  dotSub: { ...type.bodySm, color: palette.inkSoft, marginTop: 2 },
  spacer: { flex: 1 },
  card: {
    gap: spacing.s3,
    backgroundColor: palette.paperDeep,
    borderColor: palette.copper,
    borderWidth: 1,
    borderRadius: radii.lg - 6,
    padding: spacing.s4,
    shadowColor: palette.copper,
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    marginBottom: spacing.s3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s4 },
  cardCopy: {
    ...type.bodySm,
    color: palette.inkSoft,
    lineHeight: 19,
  },
  cardAvatar: {
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
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s2 },
  cardTitle: { ...type.h4, color: palette.ink, flexShrink: 1 },
  cardBadge: {
    backgroundColor: palette.copperTint,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  cardBadgeText: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    letterSpacing: 1.62,
    textTransform: 'uppercase',
    color: palette.copperDeep,
  },
  cardMeta: { ...type.caption, color: palette.inkMuted, marginTop: 2 },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s4,
    backgroundColor: palette.paperDeep,
    borderColor: palette.paperEdge,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
    marginBottom: spacing.s3,
  },
  networkLabel: { flex: 1, minWidth: 0 },
  networkTitle: { ...type.h4, color: palette.ink },
  networkSub: { ...type.bodySm, color: palette.inkMuted, marginTop: 2 },
  ctas: { gap: spacing.s2 + 2 },
  skipBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  skip: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.inkMuted },
});
