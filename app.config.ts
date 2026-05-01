import type { ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config (replaces the static `app.json`).
 *
 * Lets us read environment variables at build time so secrets and
 * environment-specific URLs (`EXPO_PUBLIC_API_BASE_URL`,
 * `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) flow into the app from the local
 * `.env` file (or EAS build secrets in production).
 *
 * The `extra` block is read at runtime via:
 *   `Constants.expoConfig?.extra?.apiBaseUrl`
 * (see `src/constants/config.ts`).
 */
const config: ExpoConfig = {
  // Display name shown under the app icon on the device home screen.
  // Flows into android/app/src/main/res/values/strings.xml's `app_name`
  // on prebuild — that file is gitignored and regenerated, so this is
  // the source of truth.
  //
  // "CulinAIre" capitalisation matches the in-app wordmark style
  // (the "AI" caps reinforce the on-device-AI nature of the product).
  // "Lite" disambiguates this build from the future Full fork; the
  // bundle id (`package` below) still uses the dev namespace until
  // Play Store distribution is set up.
  name: 'CulinAIre Kitchen Lite',
  slug: 'cc-culinaire-kitchen-mob',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'ccculinairekitchenmob',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: 'com.anonymous.ccculinairekitchenmob',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
    'expo-secure-store',
    'expo-sqlite',
    // Native Google Sign-In. Auto-configures Android (build.gradle hooks
    // for Google Play Services). The runtime SDK reads `webClientId` from
    // `GoogleSignin.configure()` — see src/services/googleSignIn.ts.
    '@react-native-google-signin/google-signin',
    // Custom Android background download module. Injects Kotlin sources,
    // manifest permissions, gradle deps, and MainApplication.kt
    // registration on every prebuild. Required because android/ is
    // gitignored — see plugins/withBackgroundDownload/README.md.
    './plugins/withBackgroundDownload',
    // Adds the ProGuard keep rule for llama.rn's native classes
    // (`com.rnllama.**`) so they survive R8 minification on release
    // builds. Idempotent across prebuilds.
    './plugins/withLlamaRn',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    // www host required: apex 301-redirects, fetch strips Authorization on
    // cross-origin redirect AND drops POST body on POST -> GET conversion.
    // See lessons.md "apex strips Bearer auth on GETs".
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://www.culinaire.kitchen',
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  },
};

export default config;
