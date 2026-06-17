import { Caveat_500Medium, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import {
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Fraunces_800ExtraBold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
// Side-effect import: initializes i18next synchronously at module load,
// so any `useTranslation()` consumer in the tree below has a ready
// instance. The boot effect (applyDeviceLocaleIfStoreEmpty) runs after
// to layer on persisted/device-detected language.
import { applyDeviceLocaleIfStoreEmpty } from '@/i18n';
import { configureGoogleSignIn } from '@/services/googleSignIn';
import { refreshFeatureFlags } from '@/services/featureFlagsService';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import { isFoodSafetyAckRequired, useFoodSafetyStore } from '@/store/foodSafetyStore';

// Configure Google Sign-In at module load (idempotent, safe to call before
// any Google API call). Reads EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID from config.
configureGoogleSignIn();

SplashScreen.preventAutoHideAsync();

function RouteGuard() {
  // useSegments' default generic infers a literal 1-tuple in newer
  // expo-router types, which makes the segments[1] read on the
  // verify-email path fail strict tsc. Cast to string[] so length-1+
  // access is a normal `string | undefined` (handled by the equality).
  const segments = useSegments() as string[];
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  // Food-safety acknowledgement gate. Per-session, in-memory only —
  // resets on cold launch + sign-out. Reinforces what Antoine is (and
  // isn't) at every entry to chat. See foodSafetyStore for rationale.
  const ackedThisSession = useFoodSafetyStore((s) => s.ackedThisSession);

  useEffect(() => {
    if (!isHydrated) return;
    // (legal) is reachable in every auth state — Terms + Privacy must be
    // readable before sign-up (ToS acceptance) AND after. Short-circuit
    // before any of the auth/onboarding/food-safety redirects kick in.
    if (segments[0] === '(legal)') return;
    // (feedback) is also reachable in every auth state — entry points exist
    // on Login (anon path: server stores user_id=NULL, is_anonymous=true)
    // AND on Settings (auth path). Per outside-voice #7 + 2026-05-04 plan:
    // the demo APK population is exactly the people hitting signup/billing
    // bugs, so gating to post-auth would lose the highest-value pre-launch
    // signal.
    if (segments[0] === '(feedback)') return;
    const inAuthFlow =
      segments[0] === '(welcome)' || segments[0] === '(auth)' || segments[0] === '(onboarding)';
    const onFoodSafety = segments[0] === '(food-safety)';
    const onVerifyEmail = segments[0] === '(auth)' && segments[1] === 'verify-email';

    if (!user) {
      // Logged out: only welcome + (auth)/* + (onboarding) are accessible.
      // Also kick out of (food-safety) — that gate is post-auth only.
      if (!inAuthFlow) router.replace('/(welcome)');
      return;
    }

    // Logged in but unverified: force the verify-email screen until they
    // confirm. They can sign out from there to switch accounts.
    if (!user.emailVerified) {
      if (!onVerifyEmail) router.replace('/(auth)/verify-email');
      return;
    }

    // Verified but not yet acked food-safety this session: force the
    // ack screen. Skip when already on it to avoid a redirect loop.
    const ackRequired = isFoodSafetyAckRequired({ ackedThisSession });
    if (ackRequired) {
      // expo-router's typed-routes cache doesn't pick up new route groups
      // until the dev server regenerates types — cast as never until then.
      if (!onFoodSafety) router.replace('/(food-safety)' as never);
      return;
    }

    // Fully verified + acked: kick out of welcome + (auth) + (food-safety)
    // + (onboarding) screens — chat is the destination once we're past
    // the auth/safety gates. Onboarding existed to host the on-device
    // model download; with the backend-chat pivot it's a passthrough.
    if (
      segments[0] === '(welcome)' ||
      segments[0] === '(auth)' ||
      segments[0] === '(food-safety)' ||
      segments[0] === '(onboarding)' ||
      segments[0] === '(downloading)'
    ) {
      router.replace('/(tabs)/chat');
    }
  }, [user, isHydrated, segments, router, ackedThisSession]);

  return null;
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setDbReady = useConversationStore((s) => s.setDbReady);
  const { success: migrationsRan, error: migrationError } = useMigrations(db, migrations);

  const [fontsLoaded] = useFonts({
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Caveat_500Medium,
    Caveat_600SemiBold,
    Caveat_700Bold,
  });

  useEffect(() => {
    void hydrate();
    // Boot-time feature-flag refresh. Best-effort — picker reads the
    // cached value, so a transient failure here just delays new-language
    // visibility by one cold launch.
    void refreshFeatureFlags().catch(() => undefined);
    // i18n boot effect: hydrate the language store from SecureStore, then
    // (only if no persisted language) attempt to detect from device locale.
    void applyDeviceLocaleIfStoreEmpty().catch(() => undefined);
  }, [hydrate]);

  useEffect(() => {
    if (migrationsRan) setDbReady(true);
  }, [migrationsRan, setDbReady]);

  useEffect(() => {
    if (fontsLoaded && isHydrated && (migrationsRan || migrationError)) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isHydrated, migrationsRan, migrationError]);

  if (!fontsLoaded || !isHydrated || (!migrationsRan && !migrationError)) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar style="dark" />
          <RouteGuard />
          <Stack screenOptions={{ headerShown: false }} />
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
