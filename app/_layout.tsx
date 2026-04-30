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
import { ensureContext } from '@/services/inferenceService';
import { loadSystemPromptKV, markKvHandled } from '@/services/kvSessionService';
import {
  getActivePrompt,
  refreshAndCache as refreshAntoinePrompt,
} from '@/services/promptCacheService';
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
    const inAuthFlow =
      segments[0] === '(welcome)' || segments[0] === '(auth)' || segments[0] === '(onboarding)';
    const onVerifyEmail = segments[0] === '(auth)' && segments[1] === 'verify-email';

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
    if (segments[0] === '(welcome)' || segments[0] === '(auth)') {
      router.replace('/(tabs)/chat');
    }
  }, [user, isHydrated, segments, router]);

  return null;
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const hydrateModelPrefs = useModelStore((s) => s.hydratePrefs);
  const isModelActive = useModelStore((s) => s.isActive);
  const isPrefsHydrated = useModelStore((s) => s.isPrefsHydrated);
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
    // Boot-time prompt refresh. Best-effort — if the user is offline the
    // cached prompt (or the baked-in fallback) is used by the next chat
    // message via getActivePrompt(). Never blocks app launch.
    void refreshAntoinePrompt().catch(() => undefined);
  }, [hydrate, hydrateModelPrefs]);

  useEffect(() => {
    if (migrationsRan) setDbReady(true);
  }, [migrationsRan, setDbReady]);

  // KV-state warmup. Once model files are confirmed present (isActive
  // flips true after hydratePrefs verifies them on disk), pre-warm the
  // llama context AND restore the saved system-prompt KV state. This
  // happens in the background while the user is on the chat tab UI;
  // the first send() then skips both the cold model load (~10-30s) AND
  // the system-prompt prefill (~45s), dropping turn 1 to ~37s on every
  // launch after the first ever.
  //
  // All best-effort. Any failure is caught + warned and falls back to
  // today's behaviour (full cold prefill). Never blocks app launch.
  useEffect(() => {
    if (!isPrefsHydrated || !isModelActive) return;
    void (async () => {
      try {
        const ctx = await ensureContext();
        const prompt = await getActivePrompt();
        const warmed = await loadSystemPromptKV(ctx, prompt);
        if (warmed) {
          markKvHandled();
          console.info('[boot] KV warmed — turn 1 skips system-prompt prefill');
        } else {
          console.info('[boot] KV cold — turn 1 will fully prefill, save after');
        }
      } catch (e) {
        console.warn('[boot] kvSession warmup failed:', e);
      }
    })();
  }, [isPrefsHydrated, isModelActive]);

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
