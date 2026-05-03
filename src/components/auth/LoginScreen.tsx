import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleMark } from '@/components/auth/GoogleMark';
import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { CopperButton } from '@/components/ui/CopperButton';
import { GhostButton } from '@/components/ui/GhostButton';
import { TextField } from '@/components/ui/TextField';
import { fonts, palette, radii, spacing, theme, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { isEmailNotVerifiedError, isMfaRequiredError } from '@/services/__errors__';
import { isGoogleSignInCancelled, signInWithGoogle } from '@/services/googleSignIn';

type Mode = 'signin' | 'register';

interface LoginScreenProps {
  onAuthed: () => void;
  /**
   * Pre-fill the email field. Used by the verify-email screen's
   * "I verified, continue" handler to route a user who has just
   * verified externally back into the sign-in flow without making
   * them re-type the email they just registered with.
   */
  initialEmail?: string;
}

export function LoginScreen({ onAuthed, initialEmail }: LoginScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const { login, register, googleSignIn, isLoading, error } = useAuth();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => email.includes('@') && password.length >= 6 && (mode === 'signin' || name.length > 0),
    [email, password, mode, name],
  );

  // Keyboard avoidance — same pattern as ChatScreen. KeyboardAvoidingView
  // is unreliable on Android edge-to-edge (adjustResize is a no-op when
  // edgeToEdgeEnabled), so we listen to imperative Keyboard events and
  // lift the ScrollView's bottom padding by the keyboard panel height.
  // ScrollView's built-in auto-scroll-to-focused-input handles the
  // visibility — we just need to reserve the space.
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
  // Animate the OUTER View's bottom padding (not contentContainerStyle).
  // Animated.ScrollView's `contentContainerStyle` doesn't accept reanimated
  // values directly — passing one yields a "set 'current' on a frozen
  // object" mutation error. Lifting padding on the root View shrinks the
  // ScrollView's available height, which makes the inner content scroll
  // up to keep the focused TextInput above the keyboard.
  const animatedRootPad = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeight.value,
  }));

  const submit = async () => {
    if (!canSubmit) return;
    try {
      if (mode === 'register') {
        // Backend register doesn't auto-log-in. Register, then log in
        // immediately. The login may throw EmailNotVerifiedError if the
        // server has email verification enabled — caught below.
        await register(name, email, password);
      }
      await login(email, password);
      onAuthed();
    } catch (e) {
      if (isMfaRequiredError(e)) {
        router.push({
          pathname: '/(auth)/mfa',
          params: { mfaSessionToken: e.mfaSessionToken },
        });
        return;
      }
      if (isEmailNotVerifiedError(e)) {
        router.push({
          pathname: '/(auth)/verify-email',
          params: { email: e.email },
        });
        return;
      }
      // Other errors (bad creds, network) surface via `error` from useAuth.
    }
  };

  const google = async () => {
    setGoogleError(null);
    try {
      const { idToken } = await signInWithGoogle();
      await googleSignIn(idToken);
      onAuthed();
    } catch (e) {
      if (isGoogleSignInCancelled(e)) {
        // Silent no-op — user backed out of the picker, no need for an error.
        return;
      }
      if (isEmailNotVerifiedError(e)) {
        // Theoretically possible if backend rejects unverified Google accounts —
        // unusual but we route the same way as email/password sign-in.
        router.push({
          pathname: '/(auth)/verify-email',
          params: { email: e.email },
        });
        return;
      }
      setGoogleError(e instanceof Error ? e.message : t('auth.googleError'));
    }
  };

  return (
    <Animated.View style={[styles.root, animatedRootPad]}>
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
          <BrandGlyph size={200} />
        </View>

        <Text style={styles.tagline}>
          {mode === 'signin' ? t('auth.signInTagline') : t('auth.registerTagline')}
        </Text>

        <View style={styles.segment}>
          {(['signin', 'register'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
              style={[styles.segmentItem, mode === m && styles.segmentItemActive]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  mode === m ? styles.segmentLabelActive : styles.segmentLabelInactive,
                ]}
              >
                {m === 'signin' ? t('auth.signInLabel') : t('auth.registerLabel')}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.fields}>
          {mode === 'register' ? (
            <TextField
              label={t('auth.nameLabel')}
              value={name}
              onChange={setName}
              placeholder={t('auth.namePlaceholder')}
              autoCapitalize="words"
              autoComplete="name"
            />
          ) : null}
          <TextField
            label={t('auth.emailLabel')}
            value={email}
            onChange={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextField
            label={t('auth.passwordLabel')}
            value={password}
            onChange={setPassword}
            placeholder={
              mode === 'register'
                ? t('auth.passwordRegisterPlaceholder')
                : t('auth.passwordSignInPlaceholder')
            }
            secureTextEntry={!showPw}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            trailing={
              <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                <Text style={styles.showHide}>
                  {showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                </Text>
              </Pressable>
            }
          />
          {mode === 'signin' ? (
            <Pressable
              style={styles.forgotRow}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgot}>{t('auth.forgotPassword')}</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {googleError ? <Text style={styles.error}>{googleError}</Text> : null}

        <View style={styles.spacer} />

        <View style={styles.ctaBlock}>
          <CopperButton onPress={submit} disabled={!canSubmit || isLoading}>
            {mode === 'signin' ? t('auth.signInButton') : t('auth.createAccountButton')}
          </CopperButton>

          <View style={styles.divider}>
            <View style={styles.dividerRule} />
            <Text style={styles.dividerLabel}>{t('auth.dividerLabel')}</Text>
            <View style={styles.dividerRule} />
          </View>

          <GhostButton onPress={google} leading={<GoogleMark />}>
            {t('auth.googleButton')}
          </GhostButton>

          <Text style={styles.terms}>
            <Trans
              i18nKey="auth.termsAndPrivacy"
              components={{
                termsLink: (
                  <Text
                    style={styles.termsLink}
                    onPress={() => router.push('/(legal)/terms' as never)}
                    accessibilityRole="link"
                  />
                ),
                privacyLink: (
                  <Text
                    style={styles.termsLink}
                    onPress={() => router.push('/(legal)/privacy' as never)}
                    accessibilityRole="link"
                  />
                ),
              }}
            />
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  // flexGrow:1 lets the spacer below push the CTA block to the bottom while
  // the ScrollView still kicks in if the keyboard makes the form taller than
  // the screen.
  scroll: { flexGrow: 1, paddingHorizontal: spacing.s6 },
  lockup: { alignItems: 'center', marginTop: spacing.s2 },
  // Mirrors the prototype's deliberate vertical rhythm: lockup → 22 → tagline
  // → 28 → segment → 24 → fields → flex spacer → 0 → CTA block.
  tagline: {
    ...type.body,
    textAlign: 'center',
    color: palette.inkSoft,
    paddingHorizontal: spacing.s4,
    marginTop: spacing.s5 + 2,
  },
  segment: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: palette.paperDeep,
    borderColor: palette.paperEdge,
    borderWidth: 1,
    borderRadius: radii.pill,
    padding: 3,
    gap: 2,
    marginTop: spacing.s6 + 4,
  },
  segmentItem: {
    paddingHorizontal: spacing.s5,
    paddingVertical: 9,
    borderRadius: radii.pill,
  },
  segmentItemActive: { backgroundColor: palette.ink },
  segmentLabel: { fontFamily: fonts.uiBold, fontSize: 13, letterSpacing: 0.26 },
  segmentLabelActive: { color: palette.textOnInk },
  segmentLabelInactive: { color: palette.inkSoft },
  fields: { gap: spacing.s3 + 2, marginTop: spacing.s6 },
  showHide: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    color: palette.inkMuted,
  },
  forgotRow: { alignSelf: 'flex-end', paddingVertical: spacing.s1 },
  forgot: { fontFamily: fonts.ui, fontSize: 13, color: palette.copperDeep },
  error: {
    ...type.bodySm,
    color: palette.ember,
    textAlign: 'center',
    paddingHorizontal: spacing.s4,
    marginTop: spacing.s3,
  },
  // Pushes the CTA block to the bottom on tall screens; collapses to 0 when
  // content overflows.
  spacer: { flexGrow: 1, minHeight: spacing.s6 },
  ctaBlock: { gap: spacing.s3 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.s3, marginVertical: 2 },
  dividerRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.paperEdge },
  dividerLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.76,
    color: palette.inkMuted,
  },
  terms: {
    ...type.caption,
    color: palette.inkMuted,
    textAlign: 'center',
    marginTop: spacing.s2,
  },
  termsLink: { color: palette.copperDeep, fontFamily: fonts.uiBold },
});
