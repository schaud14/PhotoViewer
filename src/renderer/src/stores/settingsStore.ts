import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SettingsState {
  theme: 'light' | 'dark' | 'system'
  heicConversion: boolean
  enableFaceDetection: boolean
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setHeicConversion: (enabled: boolean) => void
  setEnableFaceDetection: (enabled: boolean) => void
  fetchSettings: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark', // Default to dark theme as requested
      heicConversion: false, // Default off to preserve original files
      enableFaceDetection: false,
      setTheme: (theme) => set({ theme }),
      setHeicConversion: (heicConversion) => set({ heicConversion }),
      setEnableFaceDetection: (enableFaceDetection) => {
        set({ enableFaceDetection })
        window.api?.updateSettings({ enableFaceDetection })
      },
      fetchSettings: async () => {
        if (window.api?.getSettings) {
          const mainSettings = await window.api.getSettings()
          set({ enableFaceDetection: mainSettings.enableFaceDetection })
        }
      }
    }),
    {
      name: 'photoviewer-settings', // saved in localStorage
    }
  )
)
