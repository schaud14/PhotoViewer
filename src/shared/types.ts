// Shared type definitions used by both main and renderer processes

export interface Photo {
  id: string
  absolutePath: string
  originalPath: string
  fileName: string
  fileSize: number
  createdAt: string
  modifiedAt: string
  dateTaken?: string
  camera?: string
  lens?: string
  exposure?: string
  iso?: string
  width?: number
  height?: number
  thumbnailPath?: string
  physicalAlbumId?: string | null
  trashed: boolean
  rating: number
  colorLabel?: string
  phash?: string
  tags: string[]
  albumIds: string[]
}

export interface Album {
  id: string
  name: string
  type: 'virtual' | 'physical'
  basePath?: string
  createdAt: string
  photoCount?: number
  // For Smart Albums (virtual)
  rules?: any
}

export interface LightTable {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface LightTablePhoto {
  tableId: string
  photoId: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  // Joined photo data for convenience when returning from the DB
  photo?: Photo
}

export interface SourceFolder {
  id: string
  path: string
  addedAt: string
}

export interface PhotoFilters {
  albumId?: string
  tags?: string[]
  searchText?: string
  trashed?: boolean
  sourceFolderPath?: string
  sortBy?: 'dateTaken' | 'fileName' | 'fileSize' | 'createdAt' | 'rating'
  sortOrder?: 'asc' | 'desc'
  minRating?: number
  colorLabel?: string
}

export interface ScanProgress {
  total: number
  processed: number
  currentFile: string
  status: 'scanning' | 'indexing' | 'thumbnailing' | 'complete' | 'error'
}

export interface ExifData {
  dateTaken?: string
  camera?: string
  lens?: string
  exposure?: string
  iso?: string
  focalLength?: string
  aperture?: string
  gpsLatitude?: number
  gpsLongitude?: number
  width?: number
  height?: number
}

export interface TrashRestoreResult {
  success: boolean
  conflict?: boolean
  message?: string
}

// IPC channel names
export const IPC_CHANNELS = {
  // Library
  SELECT_SOURCE_FOLDERS: 'library:select-source-folders',
  ADD_SOURCE_FOLDER: 'library:add-source-folder',
  GET_SOURCE_FOLDERS: 'library:get-source-folders',
  REMOVE_SOURCE_FOLDER: 'library:remove-source-folder',
  SCAN_SOURCES: 'library:scan-sources',
  SCAN_LIBRARY: 'library:scan',
  SCAN_PROGRESS: 'library:scan-progress',
  GET_PHOTOS: 'library:get-photos',
  GET_PHOTO: 'library:get-photo',
  GET_DUPLICATES: 'library:get-duplicates',

  // Albums
  CREATE_ALBUM: 'albums:create',
  GET_ALBUMS: 'albums:get-all',
  GET_ALBUM: 'albums:get',
  DELETE_ALBUM: 'albums:delete',
  ADD_PHOTOS_TO_ALBUM: 'albums:add-photos',
  REMOVE_PHOTO_FROM_ALBUM: 'albums:remove-photo',

  // Tags
  ADD_TAGS: 'tags:add',
  REMOVE_TAGS: 'tags:remove',
  GET_ALL_TAGS: 'tags:get-all',

  // Trash
  DELETE_PHOTO: 'trash:delete',
  RESTORE_PHOTO: 'trash:restore',
  PERMANENTLY_DELETE: 'trash:permanent-delete',
  EMPTY_TRASH: 'trash:empty',
  GET_TRASH: 'trash:get-all',

  // Metadata
  GET_METADATA: 'metadata:get',

  // Settings
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',

  // Thumbnails
  GET_THUMBNAIL: 'thumbnails:get',

  // Editor
  ROTATE_PHOTO: 'editor:rotate',
  RENAME_PHOTO: 'editor:rename',
  TOGGLE_FAVORITE: 'editor:toggle-favorite',
  SET_RATING: 'editor:set-rating',
  SET_COLOR_LABEL: 'editor:set-color-label',
  EXPORT_PHOTOS: 'editor:export-photos',
  APPLY_EDITS: 'editor:apply-edits',

  // Light Table
  CREATE_LIGHT_TABLE: 'lightTable:create',
  GET_LIGHT_TABLES: 'lightTable:get-all',
  GET_LIGHT_TABLE: 'lightTable:get-one',
  ADD_PHOTOS_TO_LIGHT_TABLE: 'lightTable:add-photos',
  UPDATE_LIGHT_TABLE_PHOTO: 'lightTable:update-photo',
  REMOVE_PHOTO_FROM_LIGHT_TABLE: 'lightTable:remove-photo',
  DELETE_LIGHT_TABLE: 'lightTable:delete',
} as const
