import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { CopperButton } from '@/components/ui/CopperButton';
import { GhostButton } from '@/components/ui/GhostButton';
import { TextField } from '@/components/ui/TextField';
import { fonts, palette, spacing, theme, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requestPasswordReset, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  // After submit: show the success state (anti-enumeration — always succeed
  // visually so an attacker can't probe whether the email is registered).
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = useMemo(() => email.includes('@'), [email]);

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch {
      // Network errors only — surface via `error`. Backend always returns 200
      // for valid emails (per anti-enumeration), so a thrown error here means
      // the request never landed.
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

        {submitted ? (
          <>
            <Text style={styles.tagline}>{t('auth.checkInboxTitle')}</Text>
            <Text style={styles.body}>
              <Trans
                i18nKey="auth.checkInboxBody"
                values={{ email }}
                components={{ emailEm: <Text style={styles.emailEm} /> }}
              />
            </Text>
            <View style={styles.spacer} />
            <View style={styles.ctaBlock}>
              <CopperButton onPress={() => router.replace('/(auth)/login')}>
                {t('auth.backToSignIn')}
              </CopperButton>
              <GhostButton
                onPress={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
              >
                {t('auth.tryDifferentEmail')}
              </GhostButton>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.tagline}>{t('auth.forgotPasswordTitle')}</Text>
            <Text style={styles.body}>{t('auth.forgotPasswordBody')}</Text>
            <View style={styles.fields}>
              <TextField
                label={t('auth.emailLabel')}
                value={email}
                onChange={setEmail}
                placeholder={t('auth.forgotPasswordPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.spacer} />
            <View style={styles.ctaBlock}>
              <CopperButton onPress={submit} disabled={!canSubmit || isLoading}>
                {t('auth.sendResetLink')}
              </CopperButton>
              <GhostButton onPress={() => router.replace('/(auth)/login')}>
                {t('auth.backToSignIn')}
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
  emailEm: { color: palette.ink, fontFamily: fonts.uiBold },
  fields: { gap: spacing.s3 + 2, marginTop: spacing.s6 },
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
