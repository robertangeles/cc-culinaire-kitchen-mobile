import { useRouter } from 'expo-router';

import { WelcomeCarousel } from '@/components/welcome/WelcomeCarousel';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <WelcomeCarousel
      onGetStarted={() => router.push('/(auth)/login')}
      onSkip={() => router.push('/(auth)/login')}
    />
  );
}
