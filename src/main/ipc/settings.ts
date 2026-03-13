import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { getDatabase } from '../db/database'

// Simple in-memory cache for settings in the main process
let currentSettings = {
  theme: 'dark',
  heicConversion: false,
  enableFaceDetection: false,
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    try {
      const db = getDatabase()
      const row = db.prepare('SELECT enableFaceDetection FROM app_settings WHERE id = 1').get() as { enableFaceDetection: number } | undefined
      if (row) {
        currentSettings.enableFaceDetection = Boolean(row.enableFaceDetection)
      }
    } catch (e) {
      console.error('[Settings] db error reading settings', e)
    }
    return currentSettings
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, async (_event, newSettings: any) => {
    currentSettings = { ...currentSettings, ...newSettings }
    
    // Persist backend-owned settings
    if (newSettings.enableFaceDetection !== undefined) {
      try {
        const db = getDatabase()
        db.prepare('UPDATE app_settings SET enableFaceDetection = ? WHERE id = 1')
          .run(newSettings.enableFaceDetection ? 1 : 0)
      } catch (e) {
        console.error('[Settings] db error writing settings', e)
      }
    }
    console.log('[Settings] Updated in main process:', currentSettings)
  })
}

export function getSettings() {
  return currentSettings
}
