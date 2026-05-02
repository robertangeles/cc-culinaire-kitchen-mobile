/* eslint-disable import/first */
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { NativeModules } from 'react-native';

import { MODEL, STORAGE_KEYS } from '@/constants/config';
import { getMainModelPath, verifyModelFiles } from '@/services/modelLocator';
/* eslint-enable import/first */

const getInfoMock = FileSystem.getInfoAsync as jest.MockedFunction<typeof FileSystem.getInfoAsync>;

describe('modelLocator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NativeModules as Record<string, unknown>).BackgroundDownloadModule = {
      getDocumentDirectory: jest.fn(async () => '/data/user/0/app/files'),
    };
  });

  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).BackgroundDownloadModule;
  });

  it('falls back to the native document directory when no override is set', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    const path = await getMainModelPath();
    expect(path).toBe(`/data/user/0/app/files/models/${MODEL.id}/v1/${MODEL.files.main.filename}`);
  });

  it('honors the STORAGE_KEYS.modelDir override when set', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('/sdcard/Downloads/antoine');
    const path = await getMainModelPath();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.modelDir);
    expect(path).toBe(`/sdcard/Downloads/antoine/${MODEL.files.main.filename}`);
  });

  it('verifyModelFiles returns ok when the main model file is present', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    getInfoMock.mockResolvedValue({ exists: true } as Awaited<
      ReturnType<typeof FileSystem.getInfoAsync>
    >);
    const result = await verifyModelFiles();
    expect(result).toEqual({ ok: true, missing: [] });
  });

  it('verifyModelFiles reports the missing filename when the main model is absent', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    getInfoMock.mockResolvedValue({ exists: false } as Awaited<
      ReturnType<typeof FileSystem.getInfoAsync>
    >);
    const result = await verifyModelFiles();
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([MODEL.files.main.filename]);
  });

  it('throws when neither override nor native module is available', async () => {
    delete (NativeModules as Record<string, unknown>).BackgroundDownloadModule;
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    await expect(getMainModelPath()).rejects.toThrow(/BackgroundDownloadModule is not registered/);
  });
});
