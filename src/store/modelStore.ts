import { create } from 'zustand';

export type ModelState = 'idle' | 'downloading' | 'ready' | 'error';

interface ModelStoreState {
  state: ModelState;
  progress: number;
  error: string | null;
  isActive: boolean;

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

  setDownloading: (progress) => set({ state: 'downloading', progress, error: null }),
  setReady: () => set({ state: 'ready', progress: 1, isActive: true, error: null }),
  setIdle: () => set({ state: 'idle', progress: 0, isActive: false, error: null }),
  setError: (message) => set({ state: 'error', error: message }),
  setActive: (active) => set({ isActive: active }),
}));
