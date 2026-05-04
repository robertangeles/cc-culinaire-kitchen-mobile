/**
 * FeedbackScreen — modal form for submitting in-app feedback / bug
 * reports. Reachable from Settings (auth path) and from the Login
 * screen (anon path; no Bearer header sent, server stores user_id=NULL).
 *
 * Per the 2026-05-04 plan reviews:
 *  - 3-chip inline selector for category (wraps to 2 rows on narrow)
 *  - Diagnostic toggle reveals a literal-JSON preview (single buildPayload
 *    source — preview cannot drift from POST body)
 *  - Photo attachment is optional, base64 inline (≤500 KB after downscale,
 *    encoding done natively by expo-image-picker `base64: true`)
 *  - 429 surfaces a Retry-After countdown that disables the submit button
 *  - 426 surfaces an Update-required alert; closes the modal
 *  - Success → soft haptic → Alert → router.back()
 *
 * Submit-disabled states (mirrored on the CopperButton):
 *  1. Validation: subject empty, body empty, or category not chosen
 *  2. In-flight: POST is mid-flight (LoadingDots inside button)
 *  3. Cooldown: 429 countdown timer is non-zero
 *  4. Upgrade required: a 426 occurred this session
 */
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiagnosticPreview } from '@/components/feedback/DiagnosticPreview';
import { CopperButton } from '@/components/ui/CopperButton';
import { GhostButton } from '@/components/ui/GhostButton';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { TextField } from '@/components/ui/TextField';
import { fonts, layout, palette, radii, spacing, theme, type } from '@/constants/theme';
import { isApiError, isNetworkError, isUpgradeRequiredError } from '@/services/__errors__';
import { incrementCount } from '@/services/feedbackCount';
import {
  buildPayload,
  type FeedbackCategory,
  type FeedbackPayload,
} from '@/services/feedbackPayload';
import { submit as submitFeedback } from '@/services/feedbackService';
import { useAuthStore } from '@/store/authStore';

const SUBJECT_MAX = 120;
const BODY_MAX = 4000;
const PHOTO_MAX_BYTES = 500 * 1024;

const CATEGORIES: readonly FeedbackCategory[] = ['bug', 'feature', 'feedback'] as const;

type FromContext = 'chat' | 'settings' | 'history' | 'language' | 'login' | null;

function parseFromContext(raw: string | string[] | undefined): FromContext {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    value === 'chat' ||
    value === 'settings' ||
    value === 'history' ||
    value === 'language' ||
    value === 'login'
  ) {
    return value;
  }
  return null;
}

export default function FeedbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ from?: string }>();
  const from = parseFromContext(params.from);
  const isAnon = from === 'login';

  const user = useAuthStore((s) => s.user);
  const ownerKey: string | number = user?.userId ?? 'anon';

  const initialSubject = useMemo(() => {
    if (!from) return '';
    return t(`feedback.subjectPrefill.${from}`, {
      defaultValue: '',
    });
  }, [from, t]);

  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreviewUri, setScreenshotPreviewUri] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [upgradeBlocked, setUpgradeBlocked] = useState(false);

  // Keyboard avoidance — same pattern as LoginScreen. KeyboardAvoidingView
  // is unreliable on Android edge-to-edge (adjustResize is a no-op when
  // edgeToEdgeEnabled), so we listen to imperative Keyboard events and
  // lift the ScrollView's bottom padding.
  const keyboardHeight = useSharedValue(0);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardHeight.value = withTiming(e.endCoordinates.height, { duration: 250 });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeight.value = withTiming(0, { duration: 250 });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);
  const animatedRootPad = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeight.value,
  }));

  // Cooldown countdown timer for 429 Retry-After. Tick once per second
  // until zero. Submit button stays disabled while non-zero.
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

  // Single buildPayload() call feeds both the diagnostic preview and the
  // eventual POST body. This is the source-of-truth contract from the
  // 2026-05-04 plan — preview cannot drift from what's actually sent.
  const payload: FeedbackPayload = useMemo(
    () =>
      buildPayload({
        subject,
        body,
        category: category ?? 'feedback',
        includeDiagnostics,
        screenshotBase64,
      }),
    [subject, body, category, includeDiagnostics, screenshotBase64],
  );

  const validationOk = subject.trim().length > 0 && body.trim().length > 0 && category !== null;
  const submitDisabled = !validationOk || submitting || cooldownSeconds > 0 || upgradeBlocked;

  const onClose = () => router.back();

  const onPickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(t('feedback.photoPermissionTitle'), t('feedback.photoPermissionBody'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        // base64: true → native side encodes; cheaper than JS-side base64
        // conversion (eng review finding 4.1).
        base64: true,
        quality: 0.7,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset || !asset.base64) {
        Alert.alert(t('feedback.genericErrorTitle'), t('feedback.genericErrorBody'));
        return;
      }
      // Approximate byte size from base64 length: 4 chars encode 3 bytes.
      const approxBytes = (asset.base64.length * 3) / 4;
      if (approxBytes > PHOTO_MAX_BYTES) {
        Alert.alert(t('feedback.imageTooLargeTitle'), t('feedback.imageTooLargeBody'));
        return;
      }
      setScreenshotBase64(asset.base64);
      setScreenshotPreviewUri(asset.uri);
    } catch {
      Alert.alert(t('feedback.genericErrorTitle'), t('feedback.genericErrorBody'));
    }
  };

  const onRemovePhoto = () => {
    setScreenshotBase64(null);
    setScreenshotPreviewUri(null);
  };

  const onSubmit = async () => {
    if (submitDisabled) return;
    setSubmitting(true);
    try {
      await submitFeedback(payload, { anon: isAnon });
      await incrementCount(ownerKey);
      // Soft success haptic, then alert, then back.
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics can be unavailable on emulator/older device — ignore.
      }
      Alert.alert(t('feedback.successAlertTitle'), t('feedback.successAlertBody'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      if (isUpgradeRequiredError(e)) {
        setUpgradeBlocked(true);
        Alert.alert(t('feedback.upgradeRequiredTitle'), t('feedback.upgradeRequiredBody'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else if (isApiError(e) && e.status === 429) {
        const wait = e.retryAfter && e.retryAfter > 0 ? e.retryAfter : 60;
        setCooldownSeconds(wait);
        Alert.alert(
          t('feedback.rateLimitTitle'),
          t('feedback.rateLimitCountdown', { seconds: wait }),
        );
      } else if (isNetworkError(e) || (e instanceof Error && e.name === 'AbortError')) {
        Alert.alert(t('feedback.networkErrorTitle'), t('feedback.networkErrorBody'));
      } else if (isApiError(e) && (e.status === 401 || e.status === 403)) {
        // 401 already handled by apiClient refresh-then-retry; if it
        // bubbled here it means refresh failed → user is signed out.
        // 403 means the server explicitly forbade. Either way, generic.
        Alert.alert(t('feedback.genericErrorTitle'), t('feedback.genericErrorBody'));
      } else {
        Alert.alert(t('feedback.genericErrorTitle'), t('feedback.genericErrorBody'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Animated.View style={[styles.root, { paddingTop: insets.top }, animatedRootPad]}>
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('feedback.headerTitle')}</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('feedback.cancelButton')}
          style={styles.closeBtn}
          hitSlop={12}
        >
          <Feather name="x" size={22} color={palette.copperDeep} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Anonymous indicator (anon path only) */}
        {isAnon ? (
          <Text style={styles.anonEyebrow}>{t('feedback.anonEyebrow')}</Text>
        ) : (
          <Text style={styles.openEyebrow}>{t('feedback.openEyebrow')}</Text>
        )}

        {/* Subject */}
        <TextField
          label={t('feedback.subjectPlaceholder')}
          value={subject}
          onChange={(next) => setSubject(next.slice(0, SUBJECT_MAX))}
          placeholder={t('feedback.subjectPlaceholder')}
          maxLength={SUBJECT_MAX}
        />

        {/* Body */}
        <TextField
          label={t('feedback.bodyPlaceholder')}
          value={body}
          onChange={(next) => setBody(next.slice(0, BODY_MAX))}
          placeholder={t('feedback.bodyPlaceholder')}
          maxLength={BODY_MAX}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <Text style={styles.helperText}>{t('feedback.pasteWarning')}</Text>

        {/* Category — inline 3-chip selector, wraps to 2 rows on narrow */}
        <Text style={styles.eyebrow}>{t('feedback.categoryEyebrow')}</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((cat) => {
            const selected = category === cat;
            const labelKey =
              cat === 'bug'
                ? 'feedback.categoryBug'
                : cat === 'feature'
                  ? 'feedback.categoryFeature'
                  : 'feedback.categoryFeedback';
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selected ? styles.chipLabelSelected : styles.chipLabelUnselected,
                  ]}
                >
                  {t(labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Diagnostic toggle */}
        <Pressable
          onPress={() => setIncludeDiagnostics((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: includeDiagnostics }}
          style={styles.toggleRow}
        >
          <View style={[styles.checkbox, includeDiagnostics && styles.checkboxChecked]}>
            {includeDiagnostics ? (
              <Feather name="check" size={14} color={palette.textOnCopper} />
            ) : null}
          </View>
          <View style={styles.toggleBody}>
            <Text style={styles.toggleLabel}>{t('feedback.diagnosticToggle')}</Text>
            <Text style={styles.toggleHelp}>{t('feedback.diagnosticToggleHelp')}</Text>
          </View>
        </Pressable>

        {includeDiagnostics ? <DiagnosticPreview payload={payload} /> : null}

        {/* Photo attachment */}
        {screenshotPreviewUri ? (
          <View style={styles.photoCard}>
            <Image source={{ uri: screenshotPreviewUri }} style={styles.photoThumb} />
            <Pressable
              onPress={onRemovePhoto}
              accessibilityRole="button"
              accessibilityLabel={t('feedback.attachPhotoRemove')}
              style={styles.photoRemove}
              hitSlop={10}
            >
              <Feather name="x" size={16} color={palette.textOnCopper} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onPickPhoto}
            accessibilityRole="button"
            accessibilityLabel={t('feedback.attachPhoto')}
            style={styles.photoButton}
          >
            <Feather name="camera" size={18} color={palette.copper} />
            <Text style={styles.photoButtonLabel}>{t('feedback.attachPhoto')}</Text>
          </Pressable>
        )}

        {/* Submit + Cancel */}
        <View style={styles.actions}>
          <CopperButton
            onPress={onSubmit}
            disabled={submitDisabled}
            accessibilityLabel={t('feedback.submitButton')}
            leading={submitting ? <LoadingDots color={palette.textOnCopper} size={5} /> : undefined}
          >
            {cooldownSeconds > 0
              ? t('feedback.rateLimitCountdown', { seconds: cooldownSeconds })
              : t('feedback.submitButton')}
          </CopperButton>
          <GhostButton onPress={onClose}>{t('feedback.cancelButton')}</GhostButton>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s5,
    paddingVertical: spacing.s4,
    borderBottomColor: palette.paperEdge,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { ...type.h3, color: palette.ink },
  closeBtn: {
    width: layout.tap,
    height: layout.tap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.s5,
    paddingTop: spacing.s4,
    paddingBottom: spacing.s10,
    gap: spacing.s4,
  },
  openEyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    letterSpacing: 1.62,
    textTransform: 'uppercase',
    color: palette.inkMuted,
  },
  anonEyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    letterSpacing: 1.62,
    textTransform: 'uppercase',
    color: palette.copperDeep,
  },
  helperText: {
    ...type.bodySm,
    color: palette.inkMuted,
    marginTop: -spacing.s2,
  },
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: palette.copperDeep,
    marginTop: spacing.s2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  chip: {
    minHeight: layout.tap,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s2,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: palette.copperTint,
    borderColor: palette.copper,
  },
  chipUnselected: {
    backgroundColor: palette.paperDeep,
    borderColor: palette.paperEdge,
  },
  chipLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  chipLabelSelected: { color: palette.copperDeep },
  chipLabelUnselected: { color: palette.ink },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s3,
    paddingVertical: spacing.s2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: palette.paperEdge,
    backgroundColor: palette.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: palette.copper,
    borderColor: palette.copperDeep,
  },
  toggleBody: { flex: 1 },
  toggleLabel: { ...type.body, color: palette.ink },
  toggleHelp: { ...type.bodySm, color: palette.inkMuted, marginTop: 2 },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s2,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s4,
    borderRadius: radii.sm + 4,
    borderWidth: 1.5,
    borderColor: palette.copper,
    backgroundColor: 'transparent',
    minHeight: layout.tap,
  },
  photoButtonLabel: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.copper },
  photoCard: {
    position: 'relative',
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: palette.paperDeep,
    borderWidth: 1,
    borderColor: palette.paperEdge,
  },
  photoThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: palette.paperEdge,
  },
  photoRemove: {
    position: 'absolute',
    top: spacing.s2,
    right: spacing.s2,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: palette.copperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: spacing.s2,
    marginTop: spacing.s4,
  },
});
