import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from '@/constants/config';
import { useModelStore } from '@/store/modelStore';

describe('modelStore — wifiOnly preference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useModelStore.setState({
      wifiOnly: true,
      isPrefsHydrated: false,
    });
  });

  it('defaults to wifiOnly=true before hydration', () => {
    expect(useModelStore.getState().wifiOnly).toBe(true);
    expect(useModelStore.getState().isPrefsHydrated).toBe(false);
  });

  it('hydrates wifiOnly=false from SecureStore when stored as "0"', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('0');
    await useModelStore.getState().hydratePrefs();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.downloadWifiOnly);
    expect(useModelStore.getState().wifiOnly).toBe(false);
    expect(useModelStore.getState().isPrefsHydrated).toBe(true);
  });

  it('keeps the wifiOnly=true default when SecureStore returns null', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    await useModelStore.getState().hydratePrefs();
    expect(useModelStore.getState().wifiOnly).toBe(true);
    expect(useModelStore.getState().isPrefsHydrated).toBe(true);
  });

  it('marks prefs hydrated even when SecureStore throws', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('secure store dead'));
    await expect(useModelStore.getState().hydratePrefs()).resolves.toBeUndefined();
    expect(useModelStore.getState().isPrefsHydrated).toBe(true);
  });

  it('persists wifiOnly=false as "0" via setWifiOnly', async () => {
    await useModelStore.getState().setWifiOnly(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.downloadWifiOnly, '0');
    expect(useModelStore.getState().wifiOnly).toBe(false);
  });

  it('persists wifiOnly=true as "1" via setWifiOnly', async () => {
    await useModelStore.getState().setWifiOnly(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.downloadWifiOnly, '1');
    expect(useModelStore.getState().wifiOnly).toBe(true);
  });
});
