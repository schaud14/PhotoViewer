import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, PhotoFilters } from '../shared/types'
import type { Photo, Album, SourceFolder, ScanProgress, TrashRestoreResult, LightTable, LightTablePhoto, Person } from '../shared/types'

// Expose protected APIs to the renderer process via contextBridge
const api = {
  // Library
  selectSourceFolders: (): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_SOURCE_FOLDERS),

  addSourceFolder: (folderPath: string): Promise<SourceFolder> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_SOURCE_FOLDER, folderPath),

  getSourceFolders: (): Promise<SourceFolder[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SOURCE_FOLDERS),

  removeSourceFolder: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_SOURCE_FOLDER, id),

  scanSources: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SCAN_SOURCES),

  onScanProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ScanProgress) => callback(progress)
    ipcRenderer.on(IPC_CHANNELS.SCAN_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SCAN_PROGRESS, handler)
  },

  onLibraryUpdated: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('library:updated', handler)
    return () => ipcRenderer.removeListener('library:updated', handler)
  },

  getPhotos: (filters?: PhotoFilters): Promise<Photo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PHOTOS, filters),

  getPhoto: (id: string): Promise<Photo | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PHOTO, id),

  getDuplicates: (): Promise<Photo[][]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_DUPLICATES),

  // Albums
  createAlbum: (data: { name: string; type: 'virtual' | 'physical'; basePath?: string }): Promise<Album> =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_ALBUM, data),

  getAlbums: (): Promise<Album[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ALBUMS),

  getAlbum: (id: string): Promise<Album | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ALBUM, id),

  deleteAlbum: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_ALBUM, id),

  addPhotosToAlbum: (albumId: string, photoIds: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_PHOTOS_TO_ALBUM, albumId, photoIds),

  removePhotoFromAlbum: (albumId: string, photoId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_PHOTO_FROM_ALBUM, albumId, photoId),

  // Tags
  addTags: (photoId: string, tags: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_TAGS, photoId, tags),

  removeTags: (photoId: string, tags: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_TAGS, photoId, tags),

  getAllTags: (): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_TAGS),

  // Trash
  deletePhoto: (photoId: string, context?: { albumId?: string; albumType?: string }): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_PHOTO, photoId, context),

  restorePhoto: (photoId: string): Promise<TrashRestoreResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.RESTORE_PHOTO, photoId),

  permanentlyDelete: (photoId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.PERMANENTLY_DELETE, photoId),

  emptyTrash: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.EMPTY_TRASH),

  getTrash: (): Promise<Photo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TRASH),

  // Metadata
  getMetadata: (photoId: string): Promise<Photo> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_METADATA, photoId),

  // Settings
  getSettings: (): Promise<any> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  updateSettings: (settings: any): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, settings),

  // Thumbnails
  getThumbnail: (photoId: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_THUMBNAIL, photoId),

  // Editor
  rotatePhoto: (photoId: string, direction: 'left' | 'right'): Promise<Photo> =>
    ipcRenderer.invoke(IPC_CHANNELS.ROTATE_PHOTO, photoId, direction),

  renamePhoto: (photoId: string, newName: string): Promise<Photo> =>
    ipcRenderer.invoke(IPC_CHANNELS.RENAME_PHOTO, photoId, newName),

  toggleFavorite: (photoId: string): Promise<{ isFavorite: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_FAVORITE, photoId),

  setRating: (photoId: string, rating: number): Promise<{ rating: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_RATING, photoId, rating),

  setColorLabel: (photoId: string, colorLabel: string | null): Promise<{ colorLabel: string | null }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_COLOR_LABEL, photoId, colorLabel),

  exportPhotos: (options: { photoIds: string[], format?: string, quality?: number, maxSize?: number }): Promise<{ success: boolean, exported?: number, total?: number, message?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_PHOTOS, options),

  applyEdits: (photoId: string, edits: { brightness: number, saturation: number, contrast: number }): Promise<{ success: boolean, message?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.APPLY_EDITS, photoId, edits),

  // Light Tables
  createLightTable: (name: string): Promise<LightTable> =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_LIGHT_TABLE, name),

  getLightTables: (): Promise<LightTable[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_LIGHT_TABLES),

  getLightTable: (id: string): Promise<{ table: LightTable, photos: LightTablePhoto[] } | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_LIGHT_TABLE, id),

  addPhotosToLightTable: (tableId: string, photoIds: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_PHOTOS_TO_LIGHT_TABLE, tableId, photoIds),

  updateLightTablePhoto: (tableId: string, photoId: string, changes: Partial<LightTablePhoto>): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_LIGHT_TABLE_PHOTO, tableId, photoId, changes),

  removePhotoFromLightTable: (tableId: string, photoId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_PHOTO_FROM_LIGHT_TABLE, tableId, photoId),

  deleteLightTable: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_LIGHT_TABLE, id),

  // Faces
  getPeople: (): Promise<Person[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PEOPLE),

  getFacesForPerson: (personId: string): Promise<any[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_FACES_FOR_PERSON, personId),

  renamePerson: (personId: string, name: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.RENAME_PERSON, personId, name),

  setCoverPhoto: (personId: string, photoId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_COVER_PHOTO, personId, photoId),

  resetFaces: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.RESET_FACES),
}

contextBridge.exposeInMainWorld('api', api)

// Type declaration for the renderer
export type ElectronAPI = typeof api
