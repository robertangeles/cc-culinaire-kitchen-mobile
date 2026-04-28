import { useLocalSearchParams } from 'expo-router';

import { MfaScreen } from '@/components/auth/MfaScreen';

/**
 * MFA challenge step. LoginScreen routes here with the `mfaSessionToken`
 * extracted from a `MfaRequiredError`. If the user lands here without a
 * token (e.g. backed into the route directly), the screen will show but
 * verify will fail with INVALID_MFA_SESSION — that's the right UX (they
 * need to re-login).
 */
export default function MfaRoute() {
  const { mfaSessionToken } = useLocalSearchParams<{ mfaSessionToken?: string }>();
  return <MfaScreen mfaSessionToken={typeof mfaSessionToken === 'string' ? mfaSessionToken : ''} />;
}
