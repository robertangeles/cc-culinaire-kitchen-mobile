import { useRouter } from 'expo-router';

import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  const router = useRouter();
  return (
    <OnboardingScreen
      onDownload={() => router.replace('/(tabs)/settings')}
      onSkip={() => router.replace('/(tabs)/chat')}
    />
  );
}
