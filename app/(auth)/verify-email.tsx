import { useLocalSearchParams } from 'expo-router';

import { VerifyEmailScreen } from '@/components/auth/VerifyEmailScreen';
import { useAuthStore } from '@/store/authStore';

/**
 * Email-verification gate. The route guard sends users here whenever they're
 * authenticated but `emailVerified === false`. Email is sourced from:
 *   1. URL param (when navigated from LoginScreen with EmailNotVerifiedError)
 *   2. The hydrated user in authStore (when the route guard puts them here)
 *   3. Fallback string if neither is available.
 */
export default function VerifyEmailRoute() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const userEmail = useAuthStore((s) => s.user?.userEmail);
  const display = (typeof email === 'string' && email) || userEmail || 'your email address';
  return <VerifyEmailScreen email={display} />;
}
