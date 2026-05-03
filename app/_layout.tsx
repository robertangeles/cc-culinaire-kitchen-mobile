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
import { ensureContext } from '@/services/inferenceService';
import { loadSystemPromptKV, markKvHandled } from '@/services/kvSessionService';
import {
  getActivePrompt,
  refreshAndCache as refreshAntoinePrompt,
  slugForLanguage,
} from '@/services/promptCacheService';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import { isFoodSafetyAckRequired, useFoodSafetyStore } from '@/store/foodSafetyStore';
import { useModelStore } from '@/store/modelStore';

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
  // Watch isActive so that when hydratePrefs() flips it true (after
  // verifyModelFiles confirms the GGUFs are on disk), users who landed
  // on (onboarding) before the check completed get bounced to chat.
  // Login routes unconditionally to (onboarding); without this guard a
  // returning user with the model already downloaded would see the
  // "Get Antoine · 5.9 GB" CTA every launch.
  const isModelActive = useModelStore((s) => s.isActive);
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
    // screens (these only make sense earlier in the flow).
    if (
      segments[0] === '(welcome)' ||
      segments[0] === '(auth)' ||
      segments[0] === '(food-safety)'
    ) {
      router.replace('/(tabs)/chat');
      return;
    }

    // And kick out of (onboarding) once the model is on disk — covers the
    // post-auth race where login routes here before hydratePrefs flips
    // isActive. If the model is genuinely missing, isActive stays false
    // and the user remains on (onboarding) to download.
    if (segments[0] === '(onboarding)' && isModelActive) {
      router.replace('/(tabs)/chat');
    }
  }, [user, isHydrated, segments, router, isModelActive, ackedThisSession]);

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
    //
    // v1.2: refresh both the EN base slug AND the user's currently
    // selected language (read from i18nStore once it's hydrated). If the
    // selected language hasn't been authored on the web side, the fetch
    // 404s and promptCacheService marks it `not_found` so the next chat
    // read falls back to EN with a partial-language flag.
    void (async () => {
      await refreshAntoinePrompt().catch(() => undefined);
      // Wait briefly for i18nStore hydration (synchronous in tests, ~ms
      // on device). If not hydrated by the time we kick off, we still
      // refresh the default-language slug, which is fine.
      const { useI18nStore } = await import('@/store/i18nStore');
      const lang = useI18nStore.getState().language;
      const langSlug = slugForLanguage(lang);
      if (langSlug !== slugForLanguage('en')) {
        await refreshAntoinePrompt(langSlug).catch(() => undefined);
      }
    })();
    // Boot-time feature-flag refresh. Best-effort — picker reads the
    // cached value, so a transient failure here just delays new-language
    // visibility by one cold launch.
    void refreshFeatureFlags().catch(() => undefined);
    // i18n boot effect: hydrate the language store from SecureStore, then
    // (only if no persisted language) attempt to detect from device locale.
    // Per Eng review D2 Option B: i18next initialized with EN at module
    // load; this effect upgrades to the persisted/device language with a
    // single re-render. Brief EN flash on cold launch for non-EN users is
    // accepted as the trade-off for defensive boot ordering. Best-effort.
    void applyDeviceLocaleIfStoreEmpty().catch(() => undefined);
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
        const { body: prompt } = await getActivePrompt();
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
