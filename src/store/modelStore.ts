import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { STORAGE_KEYS } from '@/constants/config';
import { verifyModelFiles } from '@/services/modelLocator';

export type ModelState = 'idle' | 'downloading' | 'ready' | 'error';

/**
 * Default to Wi-Fi-only downloads. Antoine is ~6 GB; surprising a user
 * with that much cellular data is a bad first experience. They can opt
 * in via Settings → "Allow cellular downloads" with a confirmation.
 */
const DEFAULT_WIFI_ONLY = true;

interface ModelStoreState {
  state: ModelState;
  progress: number;
  error: string | null;
  isActive: boolean;
  /** When true, the native worker waits for an unmetered network. */
  wifiOnly: boolean;
  /** True once the persisted preference has been read from SecureStore. */
  isPrefsHydrated: boolean;

  hydratePrefs: () => Promise<void>;
  setWifiOnly: (value: boolean) => Promise<void>;

  setDownloading: (progress: number) => void;
  setReady: () => void;
  setIdle: () => void;
  setError: (message: string) => void;
  setActive: (active: boolean) => void;
}

export const useModelStore = create<ModelStoreState>((set) => ({
  state: 'idle',
  progress: 0,
  error: null,
  isActive: false,
  wifiOnly: DEFAULT_WIFI_ONLY,
  isPrefsHydrated: false,

  hydratePrefs: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEYS.downloadWifiOnly);
      // Stored as "1" / "0" so a missing key is unambiguous and falls
      // through to the Wi-Fi-only default.
      if (stored === '0') {
        set({ wifiOnly: false });
      } else if (stored === '1') {
        set({ wifiOnly: true });
      }
    } catch {
      // SecureStore can fail on devices where the secure element is
      // unavailable (rare, but real on rooted devices and some emulators).
      // Fall back to the safe default rather than crashing app startup.
    }

    // Check if the model files are already on disk from a previous run.
    // `isActive` is in-memory only and would otherwise default to false on
    // every app launch, forcing the user back through the download flow
    // even when their 6 GB model is right there. Reads BackgroundDownloadModule
    // for the path, expo-file-system for existence — pure fs reads, no
    // network calls.
    try {
      const result = await verifyModelFiles();
      console.info(
        `[modelStore] verifyModelFiles ok=${result.ok} missing=${JSON.stringify(result.missing)}`,
      );
      if (result.ok) {
        set({ state: 'ready', progress: 1, isActive: true, error: null });
      }
    } catch (e) {
      console.warn('[modelStore] verifyModelFiles threw:', e);
    }

    set({ isPrefsHydrated: true });
  },

  setWifiOnly: async (value) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.downloadWifiOnly, value ? '1' : '0');
    set({ wifiOnly: value });
  },

  setDownloading: (progress) => set({ state: 'downloading', progress, error: null }),
  setReady: () => set({ state: 'ready', progress: 1, isActive: true, error: null }),
  setIdle: () => set({ state: 'idle', progress: 0, isActive: false, error: null }),
  setError: (message) => set({ state: 'error', error: message }),
  setActive: (active) => set({ isActive: active }),
}));
