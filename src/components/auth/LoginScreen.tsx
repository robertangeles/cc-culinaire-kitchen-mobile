import { useMemo, useState } from 'react';
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

import { GoogleMark } from '@/components/auth/GoogleMark';
import { BrandGlyph } from '@/components/ui/BrandGlyph';
import { CopperButton } from '@/components/ui/CopperButton';
import { GhostButton } from '@/components/ui/GhostButton';
import { TextField } from '@/components/ui/TextField';
import { fonts, palette, radii, spacing, theme, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

type Mode = 'signin' | 'register';

interface LoginScreenProps {
  onAuthed: () => void;
}

export function LoginScreen({ onAuthed }: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const { login, googleSignIn, isLoading, error } = useAuth();

  const canSubmit = useMemo(
    () => email.includes('@') && password.length >= 6 && (mode === 'signin' || name.length > 0),
    [email, password, mode, name],
  );

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await login(email, password);
      onAuthed();
    } catch {
      // error surfaced via `error` from useAuth
    }
  };

  const google = async () => {
    try {
      await googleSignIn();
      onAuthed();
    } catch {
      // surfaced via `error`
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
          <BrandGlyph size={200} />
        </View>

        <Text style={styles.tagline}>
          {mode === 'signin'
            ? 'Welcome back to the line.'
            : 'A line that runs itself once you let it.'}
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
                {m === 'signin' ? 'Sign in' : 'Register'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.fields}>
          {mode === 'register' ? (
            <TextField
              label="Name"
              value={name}
              onChange={setName}
              placeholder="Marco Reyes"
              autoCapitalize="words"
              autoComplete="name"
            />
          ) : null}
          <TextField
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="chef@kitchen.co"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextField
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
            secureTextEntry={!showPw}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            trailing={
              <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                <Text style={styles.showHide}>{showPw ? 'Hide' : 'Show'}</Text>
              </Pressable>
            }
          />
          {mode === 'signin' ? (
            <Pressable style={styles.forgotRow}>
              <Text style={styles.forgot}>Forgot password</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.spacer} />

        <View style={styles.ctaBlock}>
          <CopperButton onPress={submit} disabled={!canSubmit || isLoading}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </CopperButton>

          <View style={styles.divider}>
            <View style={styles.dividerRule} />
            <Text style={styles.dividerLabel}>OR</Text>
            <View style={styles.dividerRule} />
          </View>

          <GhostButton onPress={google} leading={<GoogleMark />}>
            Continue with Google
          </GhostButton>

          <Text style={styles.terms}>
            By continuing you agree to the <Text style={styles.termsLink}>Terms</Text> and{' '}
            <Text style={styles.termsLink}>Kitchen privacy notice</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
