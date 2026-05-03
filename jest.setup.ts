import '@testing-library/jest-native/extend-expect';

// expo-sqlite's native module isn't available in jest. db/client.ts calls
// openDatabaseSync at import time, which transitively breaks every test
// file that imports a store/hook touching the db. Stub the open call;
// query modules are mocked per-test where needed.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    closeAsync: jest.fn(),
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    prepareAsync: jest.fn(),
    transactionAsync: jest.fn(),
    withTransactionAsync: jest.fn(),
  })),
  deserializeDatabaseSync: jest.fn(),
}));

// llama.rn ships its own jest mock that registers `NativeModules.RNLlama`
// and JSI globals. Without this, importing the package in tests crashes
// with "RNLlama not found". The mock fires a few stub tokens to onToken
// callbacks and returns a fixed completion result — useful for asserting
// streaming + completion plumbing without a real model.
require('llama.rn/jest/mock');

// Install JSI globals up front + override `llamaGetFormattedChat` so that
// passing `messages` (instead of `prompt`) doesn't trigger the JS-side
// "Prompt is required" guard in llama.rn's completion path. The default
// mock returns an empty prompt; we substitute a non-empty stub so the
// completion call succeeds end-to-end in tests.
beforeAll(async () => {
  const { NativeModules } = require('react-native');
  if (NativeModules.RNLlama?.install) {
    await NativeModules.RNLlama.install();
  }
  (globalThis as unknown as Record<string, unknown>).llamaGetFormattedChat = jest.fn(async () => ({
    type: 'llama-chat',
    prompt: '<mock-prompt>',
    has_media: false,
    media_paths: [],
  }));
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

// Initialize i18next + react-i18next for tests with the real EN bundle
// so component tests render actual EN strings (not the fallback key).
// This mirrors production boot. Loaded once at jest setup time; shared
// across all test files.
require('@/i18n');

// Mock the hooks our screens use directly. We deliberately do NOT call
// `requireActual('expo-router')` — that loads expo-router/src/index which
// transitively loads StackClient and react-native-screens, neither of which
// transform cleanly under jest. Tests don't render route layouts; they only
// need the hooks.
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
}));

// Screens read safe-area insets via useSafeAreaInsets — jest tests don't
// wrap with SafeAreaProvider, so return zero insets directly.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// @react-native-google-signin/google-signin is a native module — calling it
// in jest crashes ("RNGoogleSignin is not a registered module"). Mock the
// surface our code uses so tests can run pure-JS.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'success', data: { idToken: 'mock-id-token' } })),
    signOut: jest.fn(async () => undefined),
  },
  isErrorWithCode: () => false,
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));
