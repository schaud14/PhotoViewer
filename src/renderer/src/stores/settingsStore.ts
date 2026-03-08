import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SettingsState {
  theme: 'light' | 'dark' | 'system'
  heicConversion: boolean
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setHeicConversion: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark', // Default to dark theme as requested
      heicConversion: false, // Default off to preserve original files
      setTheme: (theme) => set({ theme }),
      setHeicConversion: (heicConversion) => set({ heicConversion }),
    }),
    {
      name: 'photoviewer-settings', // saved in localStorage
    }
  )
)
