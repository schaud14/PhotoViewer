import { app } from 'electron'
import { watch, FSWatcher } from 'chokidar'
import { extname } from 'path'
import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { statSync } from 'fs'
import { basename } from 'path'
import { generateThumbnail } from './thumbnails'
import { extractMetadata } from './metadata'

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tiff', '.tif', '.bmp', '.gif',
  '.dng', '.nef', '.nrw', '.arw'
])

let watcherInstance: FSWatcher | null = null

function isImageFile(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}

/**
 * Start watching all source folders for file changes.
 * Automatically adds new images and removes deleted ones from the database.
 */
export function startFileWatcher(
  db: Database.Database,
  onNewPhoto?: () => void
): void {
  // Stop existing watcher if any
  stopFileWatcher()

  const folders = db.prepare('SELECT path FROM source_folders').all() as { path: string }[]
  const paths = folders.map((f) => f.path)

  if (paths.length === 0) return

  watcherInstance = watch(paths, {
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../, // Ignore dotfiles
    persistent: true,
    depth: 10,
  })

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO photos (id, absolutePath, originalPath, fileName, fileSize, createdAt, modifiedAt, trashed)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `)

  const updateMetaStmt = db.prepare(`
    UPDATE photos
    SET thumbnailPath = ?, dateTaken = ?, camera = ?, lens = ?,
        exposure = ?, iso = ?, width = ?, height = ?
    WHERE absolutePath = ?
  `)

  // New file detected
  watcherInstance.on('add', async (filePath: string) => {
    if (!isImageFile(filePath)) return

    try {
      const stats = statSync(filePath)
      const fileName = basename(filePath)
      const id = uuidv4()

      insertStmt.run(
        id, filePath, filePath, fileName,
        stats.size, stats.birthtime.toISOString(), stats.mtime.toISOString()
      )

      // Generate thumbnail and extract EXIF asynchronously
      const [thumbnailPath, meta] = await Promise.all([
        generateThumbnail(filePath),
        extractMetadata(filePath)
      ])

      updateMetaStmt.run(
        thumbnailPath,
        meta.dateTaken || null,
        meta.camera || null,
        meta.lens || null,
        meta.exposure || null,
        meta.iso || null,
        meta.width || null,
        meta.height || null,
        filePath
      )

      console.log(`[FileWatcher] Added: ${fileName}`)
      onNewPhoto?.()
    } catch (err) {
      console.error(`[FileWatcher] Error adding ${filePath}:`, err)
    }
  })

  // File deleted
  watcherInstance.on('unlink', (filePath: string) => {
    if (!isImageFile(filePath)) return

    try {
      db.prepare('DELETE FROM photos WHERE absolutePath = ? AND trashed = 0').run(filePath)
      console.log(`[FileWatcher] Removed: ${basename(filePath)}`)
      onNewPhoto?.()
    } catch (err) {
      console.error(`[FileWatcher] Error removing ${filePath}:`, err)
    }
  })

  console.log(`[FileWatcher] Watching ${paths.length} folder(s)`)
}

/**
 * Stop the file watcher.
 */
export function stopFileWatcher(): void {
  if (watcherInstance) {
    watcherInstance.close()
    watcherInstance = null
    console.log('[FileWatcher] Stopped')
  }
}
