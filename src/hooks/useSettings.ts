import { create } from 'zustand';

interface SettingsState {
  language: 'en' | 'es';
  setLanguage: (lang: 'en' | 'es') => void;
}

const useSettingsStore = create<SettingsState>((set) => ({
  language: 'en',
  setLanguage: (language) => set({ language }),
}));

export function useSettings() {
  return useSettingsStore();
}
