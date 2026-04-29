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
import { configureGoogleSignIn } from '@/services/googleSignIn';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import { useModelStore } from '@/store/modelStore';

// Configure Google Sign-In at module load (idempotent, safe to call before
// any Google API call). Reads EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID from config.
configureGoogleSignIn();

SplashScreen.preventAutoHideAsync();

function RouteGuard() {
  const segments = useSegments();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    if (!isHydrated) return;
    // Treat segments as a plain string array. Expo's typed-routes narrowing
    // depends on `.expo/types/router.d.ts` being present, which is generated
    // by the Expo CLI but NOT committed (`.expo/` is gitignored). CI does a
    // fresh install + tsc with no generated types, which makes `useSegments()`
    // fall back to a restrictive default tuple type that errors on `segments[1]`.
    const segs = segments as readonly string[];
    const inAuthFlow =
      segs[0] === '(welcome)' || segs[0] === '(auth)' || segs[0] === '(onboarding)';
    const onVerifyEmail = segs[0] === '(auth)' && segs[1] === 'verify-email';

    if (!user) {
      // Logged out: only welcome + (auth)/* + (onboarding) are accessible.
      if (!inAuthFlow) router.replace('/(welcome)');
      return;
    }

    // Logged in but unverified: force the verify-email screen until they
    // confirm. They can sign out from there to switch accounts.
    if (!user.emailVerified) {
      if (!onVerifyEmail) router.replace('/(auth)/verify-email');
      return;
    }

    // Fully verified: kick out of welcome + (auth) screens (these only make
    // sense when logged out or unverified).
    if (segs[0] === '(welcome)' || segs[0] === '(auth)') {
      router.replace('/(tabs)/chat');
    }
  }, [user, isHydrated, segments, router]);

  return null;
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const hydrateModelPrefs = useModelStore((s) => s.hydratePrefs);
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
    void hydrateModelPrefs();
  }, [hydrate, hydrateModelPrefs]);

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
