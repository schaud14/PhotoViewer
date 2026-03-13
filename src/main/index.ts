import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './db/database'
import { registerLibraryHandlers } from './ipc/library'
import { registerAlbumHandlers } from './ipc/albums'
import { registerTagHandlers } from './ipc/tags'
import { registerTrashHandlers } from './ipc/trash'
import { registerSettingsHandlers } from './ipc/settings'
import { registerEditorHandlers } from './ipc/editor'
import { registerLightTableHandlers } from './ipc/lightTable'
import { registerFacesHandlers } from './ipc/faces'
import { startFileWatcher } from './services/scanner'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // Allow loading local file:// images
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev: load from vite dev server. Prod: load built file.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Set Dock icon on macOS
  if (process.platform === 'darwin') {
    const iconPath = join(__dirname, '../../resources/icon.png')
    const image = nativeImage.createFromPath(iconPath)
    app.dock.setIcon(image)
  }

  // Set app user model id for Windows
  electronApp.setAppUserModelId('com.photoviewer')

  // Initialize the database
  const db = initDatabase()

  // Register all IPC handlers
  registerLibraryHandlers(db)
  registerAlbumHandlers(db)
  registerTagHandlers(db)
  registerTrashHandlers(db)
  registerSettingsHandlers()
  registerEditorHandlers(db)
  registerLightTableHandlers(db)
  registerFacesHandlers()

  // Start file watcher
  startFileWatcher(db, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('library:updated')
    }
  })

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { mainWindow }
