import { useRouter } from 'expo-router';

import { LoginScreen } from '@/components/auth/LoginScreen';
import { useModelStore } from '@/store/modelStore';

export default function LoginRoute() {
  const router = useRouter();
  return (
    <LoginScreen
      onAuthed={() => {
        // If the model is already on disk (returning user), go straight
        // to chat — no onboarding flash. The route guard's
        // (onboarding) → (tabs)/chat fallback covers the race where
        // hydratePrefs hasn't finished by the time onAuthed fires.
        const { isActive, isPrefsHydrated } = useModelStore.getState();
        const target = isActive ? '/(tabs)/chat' : '/(onboarding)';
        // Diagnostic — observable nav decision at the auth boundary.
        // Cheap (fires once per login), high-signal when reasoning
        // about flash / no-flash UX issues across launches.
        console.info(
          `[login] onAuthed → isActive=${isActive} isPrefsHydrated=${isPrefsHydrated} target=${target}`,
        );
        router.replace(target);
      }}
    />
  );
}
