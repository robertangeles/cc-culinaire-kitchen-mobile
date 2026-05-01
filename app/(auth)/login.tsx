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
        const isActive = useModelStore.getState().isActive;
        router.replace(isActive ? '/(tabs)/chat' : '/(onboarding)');
      }}
    />
  );
}
