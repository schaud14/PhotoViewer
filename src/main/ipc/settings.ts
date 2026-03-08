import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'

// Simple in-memory cache for settings in the main process
// The source of truth is the React localStorage (zustand persist),
// but we push updates here so main services (like HEIC converter) can read them synchronously.
let currentSettings = {
  theme: 'dark',
  heicConversion: false,
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return currentSettings
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, async (_event, newSettings: any) => {
    currentSettings = { ...currentSettings, ...newSettings }
    console.log('[Settings] Updated in main process:', currentSettings)
  })
}

export function getSettings() {
  return currentSettings
}
