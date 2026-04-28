import { useRouter } from 'expo-router';

import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  const router = useRouter();
  return (
    <OnboardingScreen
      // Download CTA now routes to the dedicated downloading screen which
      // auto-starts the model download. Old behaviour pushed users to the
      // Settings tab where they had to find ANOTHER button to actually
      // start downloading — friction-heavy for non-tech-savvy chefs.
      // Skip option removed: model is required to use the app, no escape hatch.
      // TypeScript's typed-routes generator currently emits `/(downloading)/index`
      // for this group, but the runtime canonical form (matching every other
      // group route in this app: `/(welcome)`, `/(onboarding)`, etc.) is
      // `/(downloading)`. The /index variant produces an "Unmatched route"
      // page on Android. Cast to satisfy TS until typed routes catches up.
      onDownload={() => router.replace('/(downloading)' as never)}
    />
  );
}
