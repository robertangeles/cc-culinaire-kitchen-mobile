import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { CopperButton } from '@/components/ui/CopperButton';
import { GhostButton } from '@/components/ui/GhostButton';
import { fonts, palette, radii, spacing, theme, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

interface MfaScreenProps {
  /** mfaSessionToken from /auth/login response when requiresMfa: true. */
  mfaSessionToken: string;
}

const CODE_LENGTH = 6;

/**
 * 6-digit TOTP entry. Single TextInput styled as 6 boxes — that's the
 * standard React Native pattern for OTP because per-digit inputs cause
 * keyboard flicker (especially on Android, see the elevation lesson).
 *
 * Auto-submits when the user finishes typing 6 digits.
 */
export function MfaScreen({ mfaSessionToken }: MfaScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifyMfa, isLoading, error } = useAuth();
  const [code, setCode] = useState('');
  const inputRef = useRef<TextInput>(null);

  const canSubmit = useMemo(() => code.length === CODE_LENGTH, [code]);

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await verifyMfa(mfaSessionToken, code);
      // Session set by useAuth.verifyMfa — route guard takes it from here.
    } catch {
      // Surfaced via `error`. Most common: INVALID_MFA_CODE (wrong code) or
      // INVALID_MFA_SESSION (session expired — user must re-login).
      setCode('');
      inputRef.current?.focus();
    }
  };

  // Auto-submit when the user types 6 digits.
  useEffect(() => {
    if (code.length === CODE_LENGTH) {
      void submit();
    }
    // submit is intentionally not in deps — we only want this to fire on
    // code length change, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const onCodeChange = (text: string) => {
    // Strip non-digits, cap at CODE_LENGTH.
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
  };

  const digits = code.padEnd(CODE_LENGTH, ' ').split('');

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.s4,
            paddingBottom: insets.bottom + spacing.s5 + spacing.s2,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.lockup}>
          <BrandGlyph size={140} />
        </View>

        <Text style={styles.tagline}>{t('auth.mfaTitle')}</Text>
        <Text style={styles.body}>{t('auth.mfaBody')}</Text>

        <View
          style={styles.codeRow}
          onStartShouldSetResponder={() => true}
          onResponderGrant={() => inputRef.current?.focus()}
        >
          {digits.map((d, i) => (
            <View key={i} style={[styles.codeBox, i === code.length && styles.codeBoxActive]}>
              <Text style={styles.codeDigit}>{d.trim()}</Text>
            </View>
          ))}
          {/* Hidden input that drives the visible boxes. */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={onCodeChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            // Hide the actual TextInput offscreen but keep it focusable.
            style={styles.hiddenInput}
            // No autofill on a one-time code — same Android keyboard-flicker
            // pattern we hit with regular fields.
            importantForAutofill="no"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.spacer} />

        <View style={styles.ctaBlock}>
          <CopperButton onPress={submit} disabled={!canSubmit || isLoading}>
            {t('auth.mfaVerify')}
          </CopperButton>
          <GhostButton onPress={() => router.replace('/(auth)/login')}>
            {t('auth.mfaBackToSignIn')}
          </GhostButton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.s6 },
  lockup: { alignItems: 'center', marginTop: spacing.s2 },
  tagline: {
    ...type.h2,
    textAlign: 'center',
    color: palette.ink,
    paddingHorizontal: spacing.s4,
    marginTop: spacing.s5,
  },
  body: {
    ...type.body,
    textAlign: 'center',
    color: palette.inkSoft,
    paddingHorizontal: spacing.s4,
    marginTop: spacing.s3,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.s2,
    marginTop: spacing.s6,
    position: 'relative',
  },
  codeBox: {
    width: 44,
    height: 56,
    borderRadius: radii.sm + 2,
    borderWidth: 1,
    borderColor: palette.paperEdge,
    backgroundColor: palette.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxActive: {
    borderColor: palette.copper,
    // No elevation — keep layout-neutral on Android (see lessons.md).
  },
  codeDigit: {
    fontFamily: fonts.uiBold,
    fontSize: 22,
    color: palette.ink,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  error: {
    ...type.bodySm,
    color: palette.ember,
    textAlign: 'center',
    paddingHorizontal: spacing.s4,
    marginTop: spacing.s4,
  },
  spacer: { flexGrow: 1, minHeight: spacing.s6 },
  ctaBlock: { gap: spacing.s3 },
});
