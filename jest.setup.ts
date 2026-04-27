import '@testing-library/jest-native/extend-expect';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true })),
}));

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    useSegments: () => [],
  };
});
