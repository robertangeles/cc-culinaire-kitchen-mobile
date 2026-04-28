import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { CopperButton } from '@/components/ui/CopperButton';
import { GhostButton } from '@/components/ui/GhostButton';
import { fonts, palette, spacing, theme, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

interface VerifyEmailScreenProps {
  /** Email to display in the message. Pre-filled from registration or the
   * EmailNotVerifiedError thrown by login. */
  email: string;
}

/**
 * Two CTAs:
 *   - Copper "I verified, continue" — re-fetches /auth/me; if emailVerified
 *     flipped to true, the route guard will route the user out of (auth).
 *     If still false, shows a toast-style hint.
 *   - Ghost "Resend email" — calls authService.resendEmailVerification.
 *     Always succeeds (anti-enumeration on the backend).
 */
export function VerifyEmailScreen({ email }: VerifyEmailScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshUser, resendEmailVerification, signOut, isLoading, error } = useAuth();
  const [hint, setHint] = useState<string | null>(null);

  const continueClick = async () => {
    setHint(null);
    try {
      const fresh = await refreshUser();
      if (fresh.emailVerified) {
        // Route guard will see emailVerified=true and route to /(tabs)/chat
        // automatically on the next render. No explicit navigation needed.
        return;
      }
      setHint('Still not verified — check your inbox and tap the link first.');
    } catch {
      // surfaced via `error`
    }
  };

  const resend = async () => {
    setHint(null);
    try {
      await resendEmailVerification(email);
      setHint(`Sent another link to ${email}.`);
    } catch {
      // surfaced via `error`
    }
  };

  const useDifferentAccount = async () => {
    // Sign out wipes local + revokes server-side. Returns the user to welcome
    // via the route guard.
    await signOut();
    router.replace('/(welcome)');
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.s4,
            paddingBottom: insets.bottom + spacing.s5 + spacing.s2,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.lockup}>
          <BrandGlyph size={140} />
        </View>

        <Text style={styles.tagline}>Verify your email.</Text>
        <Text style={styles.body}>
          We sent a verification link to <Text style={styles.emailEm}>{email}</Text>. Open it from
          your inbox to activate your account.
        </Text>

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.spacer} />

        <View style={styles.ctaBlock}>
          <CopperButton onPress={continueClick} disabled={isLoading}>
            I verified, continue
          </CopperButton>
          <GhostButton onPress={resend} disabled={isLoading}>
            Resend email
          </GhostButton>
          <GhostButton onPress={useDifferentAccount} disabled={isLoading}>
            Use a different account
          </GhostButton>
        </View>
      </ScrollView>
    </View>
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
  hint: {
    ...type.bodySm,
    color: palette.copperDeep,
    textAlign: 'center',
    paddingHorizontal: spacing.s4,
    marginTop: spacing.s4,
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
