module.exports = {
  preset: 'jest-expo',
  // Load .env BEFORE any test/setup code so process.env.CONTRACT_TEST_*
  // and other dotenv-style vars are visible (jest does not auto-load .env;
  // expo CLI does, but `pnpm test:contract` invokes jest directly).
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@app/(.*)$': '<rootDir>/app/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-clone-referenced-element|@react-native-community|expo(nent)?|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@gorhom/bottom-sheet|react-native-reanimated|react-native-worklets))',
  ],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts?(x)'],
  // Contract tests hit the live backend over the network. Excluded from the
  // default `pnpm test` (unit-only). Run explicitly via `pnpm test:contract`.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/__tests__/contract/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/db/migrations/**'],
};
