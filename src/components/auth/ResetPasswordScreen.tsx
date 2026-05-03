import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { CopperButton } from '@/components/ui/CopperButton';
import { GhostButton } from '@/components/ui/GhostButton';
import { TextField } from '@/components/ui/TextField';
import { fonts, palette, spacing, theme, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

interface ResetPasswordScreenProps {
  /**
   * Reset token from the email deep link (e.g. `culinaire://auth/reset?token=xxx`).
   * Pre-filled when the user lands here from the email; left blank if they
   * navigated directly (then they'll need to paste the code from the email).
   */
  initialToken?: string;
}

export function ResetPasswordScreen({ initialToken }: ResetPasswordScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { submitPasswordReset, isLoading, error } = useAuth();
  const [token, setToken] = useState(initialToken ?? '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  // Backend requires password >= 8. Match here so the button enables only when
  // the request will pass server-side validation.
  const canSubmit = useMemo(() => token.length > 0 && password.length >= 8, [token, password]);

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await submitPasswordReset(token, password);
      setDone(true);
    } catch {
      // Surfaced via `error`. Most common cause: token expired or already used —
      // user must request a new reset link.
    }
  };

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

        {done ? (
          <>
            <Text style={styles.tagline}>{t('auth.resetPasswordSuccess')}</Text>
            <Text style={styles.body}>{t('auth.resetPasswordSuccessBody')}</Text>
            <View style={styles.spacer} />
            <View style={styles.ctaBlock}>
              <CopperButton onPress={() => router.replace('/(auth)/login')}>
                {t('auth.signInButton')}
              </CopperButton>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.tagline}>{t('auth.resetPasswordTitle')}</Text>
            <Text style={styles.body}>{t('auth.resetPasswordBody')}</Text>
            <View style={styles.fields}>
              <TextField
                label={t('auth.resetCodeLabel')}
                value={token}
                onChange={setToken}
                placeholder={t('auth.resetCodePlaceholder')}
                autoCapitalize="none"
                autoComplete="one-time-code"
              />
              <TextField
                label={t('auth.newPasswordLabel')}
                value={password}
                onChange={setPassword}
                placeholder={t('auth.newPasswordPlaceholder')}
                secureTextEntry={!showPw}
                autoComplete="new-password"
                trailing={
                  <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                    <Text style={styles.showHide}>
                      {showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                    </Text>
                  </Pressable>
                }
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.spacer} />
            <View style={styles.ctaBlock}>
              <CopperButton onPress={submit} disabled={!canSubmit || isLoading}>
                {t('auth.resetPasswordButton')}
              </CopperButton>
              <GhostButton onPress={() => router.replace('/(auth)/login')}>
                {t('actions.cancel')}
              </GhostButton>
            </View>
          </>
        )}
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
  fields: { gap: spacing.s3 + 2, marginTop: spacing.s6 },
  showHide: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    color: palette.inkMuted,
  },
  error: {
    ...type.bodySm,
    color: palette.ember,
    textAlign: 'center',
    paddingHorizontal: spacing.s4,
    marginTop: spacing.s3,
  },
  spacer: { flexGrow: 1, minHeight: spacing.s6 },
  ctaBlock: { gap: spacing.s3 },
});
