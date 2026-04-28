import { useLocalSearchParams } from 'expo-router';

import { ResetPasswordScreen } from '@/components/auth/ResetPasswordScreen';

/**
 * Deep-linkable: `culinaire://auth/reset-password?token=xxx` from the
 * password-reset email opens this route with the token pre-filled.
 */
export default function ResetPasswordRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return <ResetPasswordScreen initialToken={typeof token === 'string' ? token : undefined} />;
}
