import { useRouter } from 'expo-router';

import { LoginScreen } from '@/components/auth/LoginScreen';

export default function LoginRoute() {
  const router = useRouter();
  return <LoginScreen onAuthed={() => router.replace('/(onboarding)')} />;
}
