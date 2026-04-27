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
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';

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

    if (!user && !inAuthFlow) {
      router.replace('/(welcome)');
    } else if (user && (segments[0] === '(welcome)' || segments[0] === '(auth)')) {
      router.replace('/(tabs)/chat');
    }
  }, [user, isHydrated, segments, router]);

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
