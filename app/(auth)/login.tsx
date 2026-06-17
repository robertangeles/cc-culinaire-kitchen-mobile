import { useLocalSearchParams, useRouter } from 'expo-router';

import { LoginScreen } from '@/components/auth/LoginScreen';

export default function LoginRoute() {
  const router = useRouter();
  // `email` is passed from VerifyEmailScreen's "I verified, continue"
  // handler when the user reaches the verify screen via the post-register
  // path (no tokens in the auth store). Pre-fills the sign-in email so
  // the user only has to retype their password to complete login.
  const { email } = useLocalSearchParams<{ email?: string }>();
  return (
    <LoginScreen
      initialEmail={email}
      onAuthed={() => {
        router.replace('/(tabs)/chat');
      }}
    />
  );
}
