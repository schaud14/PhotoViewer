import { ipcMain, dialog, BrowserWindow } from 'electron'
import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs, statSync } from 'fs'
import { join, basename, extname } from 'path'
import { IPC_CHANNELS } from '../../shared/types'
import type { Photo, SourceFolder, PhotoFilters } from '../../shared/types'
import { generateThumbnail } from '../services/thumbnails'
import { extractMetadata } from '../services/metadata'

const SUPPORTED_EXTENSIONS = new Set([
  // Standard formats
  '.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tiff', '.tif', '.bmp', '.gif',
  // RAW formats: iOS ProRAW, Nikon, Sony Alpha
  '.dng', '.nef', '.nrw', '.arw'
])

function isImageFile(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}

async function scanDirectory(dirPath: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.name.startsWith('.')) continue // Skip hidden files/folders
      if (entry.isDirectory()) {
        const subResults = await scanDirectory(fullPath)
        results.push(...subResults)
      } else if (entry.isFile() && isImageFile(entry.name)) {
        results.push(fullPath)
      }
    }
  } catch (err) {
    console.error(`[Scanner] Error scanning ${dirPath}:`, err)
  }
  return results
}

export function registerLibraryHandlers(db: Database.Database): void {
  // Select source folders via native dialog
  ipcMain.handle(IPC_CHANNELS.SELECT_SOURCE_FOLDERS, async () => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return []

    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory', 'multiSelections'],
      title: 'Select Photo Source Folders'
    })

    return result.canceled ? [] : result.filePaths
  })

  // Add a source folder
  ipcMain.handle(IPC_CHANNELS.ADD_SOURCE_FOLDER, async (_event, folderPath: string) => {
    const id = uuidv4()
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO source_folders (id, path) VALUES (?, ?)'
    )
    stmt.run(id, folderPath)

    return { id, path: folderPath, addedAt: new Date().toISOString() } as SourceFolder
  })

  // Get all source folders
  ipcMain.handle(IPC_CHANNELS.GET_SOURCE_FOLDERS, async () => {
    return db.prepare('SELECT * FROM source_folders ORDER BY addedAt DESC').all()
  })

  // Remove a source folder
  ipcMain.handle(IPC_CHANNELS.REMOVE_SOURCE_FOLDER, async (_event, id: string) => {
    db.prepare('DELETE FROM source_folders WHERE id = ?').run(id)
  })

  // Scan all source folders and index photos
  ipcMain.handle(IPC_CHANNELS.SCAN_SOURCES, async (event) => {
    const folders = db.prepare('SELECT * FROM source_folders').all() as SourceFolder[]
    const window = BrowserWindow.getFocusedWindow()

    let totalProcessed = 0
    const allNewFiles: string[] = []

    // --- Phase 1: Index files into DB ---
    for (const folder of folders) {
      window?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
        status: 'scanning',
        currentFile: folder.path,
        processed: totalProcessed,
        total: 0
      })

      const filePaths = await scanDirectory(folder.path)

      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO photos (id, absolutePath, originalPath, fileName, fileSize, createdAt, modifiedAt, trashed)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `)

      const insertMany = db.transaction((files: string[]) => {
        for (const filePath of files) {
          try {
            const stats = statSync(filePath)
            const fileName = basename(filePath)
            const id = uuidv4()

            const result = insertStmt.run(
              id, filePath, filePath, fileName,
              stats.size, stats.birthtime.toISOString(), stats.mtime.toISOString()
            )

            // Track newly inserted files (changes > 0 means it was a new insert, not ignored)
            if (result.changes > 0) {
              allNewFiles.push(filePath)
            }

            totalProcessed++
            if (totalProcessed % 50 === 0) {
              window?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
                status: 'indexing',
                currentFile: filePath,
                processed: totalProcessed,
                total: filePaths.length
              })
            }
          } catch (err) {
            console.error(`[Scanner] Error processing ${filePath}:`, err)
          }
        }
      })

      insertMany(filePaths)
    }

    // --- Phase 2: Generate thumbnails & extract EXIF for new files ---
    // Also pick up any existing files that are missing thumbnails/EXIF/pHash
    const photosNeedingWork = db.prepare(
      `SELECT id, absolutePath FROM photos WHERE (thumbnailPath IS NULL OR dateTaken IS NULL OR phash IS NULL) AND trashed = 0`
    ).all() as { id: string; absolutePath: string }[]

    if (photosNeedingWork.length > 0) {
      const updateStmt = db.prepare(`
        UPDATE photos
        SET thumbnailPath = ?, dateTaken = ?, camera = ?, lens = ?,
            exposure = ?, iso = ?, width = ?, height = ?, phash = ?
        WHERE id = ?
      `)

      let metaProcessed = 0
      const total = photosNeedingWork.length
      const { generatePHash } = await import('../services/duplicates')

      for (const photo of photosNeedingWork) {
        try {
          // Generate thumbnail
          const thumbnailPath = await generateThumbnail(photo.absolutePath)

          // Extract EXIF metadata
          const meta = await extractMetadata(photo.absolutePath)
          
          // Generate Perceptual Hash
          const phash = await generatePHash(photo.absolutePath)

          updateStmt.run(
            thumbnailPath,
            meta.dateTaken || null,
            meta.camera || null,
            meta.lens || null,
            meta.exposure || null,
            meta.iso || null,
            meta.width || null,
            meta.height || null,
            phash,
            photo.id
          )
        } catch (err) {
          console.error(`[Scanner] Metadata/thumbnail error for ${photo.absolutePath}:`, err)
        }

        metaProcessed++
        if (metaProcessed % 10 === 0 || metaProcessed === total) {
          window?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
            status: 'thumbnails',
            currentFile: photo.absolutePath,
            processed: metaProcessed,
            total
          })
        }
      }
    }

    // Send completion
    window?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
      status: 'complete',
      currentFile: '',
      processed: totalProcessed,
      total: totalProcessed
    })
  })

  // Get photos with optional filters
  ipcMain.handle(IPC_CHANNELS.GET_PHOTOS, async (_event, filters?: PhotoFilters) => {
    let query = `
      SELECT p.*,
        GROUP_CONCAT(DISTINCT pt.tag) as tagList,
        GROUP_CONCAT(DISTINCT pa.albumId) as albumIdList
      FROM photos p
      LEFT JOIN photo_tags pt ON p.id = pt.photoId
      LEFT JOIN photo_albums pa ON p.id = pa.photoId
    `
    const conditions: string[] = []
    const params: unknown[] = []

    // Default: don't show trashed
    if (filters?.trashed) {
      conditions.push('p.trashed = 1')
    } else {
      conditions.push('p.trashed = 0')
    }

    if (filters?.albumId) {
      query = `
        SELECT p.*,
          GROUP_CONCAT(DISTINCT pt.tag) as tagList,
          GROUP_CONCAT(DISTINCT pa2.albumId) as albumIdList
        FROM photos p
        LEFT JOIN photo_tags pt ON p.id = pt.photoId
        LEFT JOIN photo_albums pa2 ON p.id = pa2.photoId
        LEFT JOIN photo_albums pa ON p.id = pa.photoId
        WHERE pa.albumId = ? OR p.physicalAlbumId = ?
      `
      params.push(filters.albumId, filters.albumId)
      if (!filters?.trashed) {
        conditions.push('p.trashed = 0')
      }
    }

    if (filters?.searchText) {
      const searchTerm = `%${filters.searchText}%`
      conditions.push(`(
        p.fileName LIKE ? 
        OR pt.tag LIKE ? 
        OR p.camera LIKE ? 
        OR p.lens LIKE ? 
        OR p.dateTaken LIKE ? 
        OR p.absolutePath LIKE ?
      )`)
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm)
    }

    if (filters?.tags && filters.tags.length > 0) {
      const placeholders = filters.tags.map(() => '?').join(',')
      conditions.push(`pt.tag IN (${placeholders})`)
      params.push(...filters.tags)
    }

    if (filters?.sourceFolderPath) {
      conditions.push('p.absolutePath LIKE ?')
      params.push(`${filters.sourceFolderPath}%`)
    }

    if (filters?.minRating && filters.minRating > 0) {
      conditions.push('p.rating >= ?')
      params.push(filters.minRating)
    }

    if (filters?.colorLabel) {
      conditions.push('p.colorLabel = ?')
      params.push(filters.colorLabel)
    }

    if (conditions.length > 0) {
      if (filters?.albumId) {
        query += ' AND ' + conditions.join(' AND ')
      } else {
        query += ' WHERE ' + conditions.join(' AND ')
      }
    }
    // Dynamic sort
    const sortCol = filters?.sortBy || 'dateTaken'
    const sortDir = filters?.sortOrder === 'asc' ? 'ASC' : 'DESC'
    const sortMapping: Record<string, string> = {
      dateTaken: `p.dateTaken ${sortDir}, p.createdAt ${sortDir}`,
      fileName: `p.fileName ${sortDir}`,
      fileSize: `p.fileSize ${sortDir}`,
      createdAt: `p.createdAt ${sortDir}`,
      rating: `p.rating ${sortDir}, p.dateTaken DESC`,
    }
    query += ` GROUP BY p.id ORDER BY ${sortMapping[sortCol] || sortMapping.dateTaken}`

    const rows = db.prepare(query).all(...params) as (Photo & { tagList: string | null; albumIdList: string | null })[]

    return rows.map(row => ({
      ...row,
      trashed: Boolean(row.trashed),
      rating: row.rating || 0,
      tags: row.tagList ? row.tagList.split(',') : [],
      albumIds: row.albumIdList ? row.albumIdList.split(',') : []
    }))
  })

  // Get single photo
  ipcMain.handle(IPC_CHANNELS.GET_PHOTO, async (_event, id: string) => {
    const row = db.prepare(`
      SELECT p.*,
        GROUP_CONCAT(DISTINCT pt.tag) as tagList,
        GROUP_CONCAT(DISTINCT pa.albumId) as albumIdList
      FROM photos p
      LEFT JOIN photo_tags pt ON p.id = pt.photoId
      LEFT JOIN photo_albums pa ON p.id = pa.photoId
      WHERE p.id = ?
      GROUP BY p.id
    `).get(id) as (Photo & { tagList: string | null; albumIdList: string | null }) | undefined

    if (!row) return null

    return {
      ...row,
      trashed: Boolean(row.trashed),
      tags: row.tagList ? row.tagList.split(',') : [],
      albumIds: row.albumIdList ? row.albumIdList.split(',') : []
    }
  })

  // Get Duplicates
  ipcMain.handle(IPC_CHANNELS.GET_DUPLICATES, async () => {
    // 1. Fetch all photos with their phash
    const photos = db.prepare(`
      SELECT p.*,
        GROUP_CONCAT(DISTINCT pt.tag) as tagList,
        GROUP_CONCAT(DISTINCT pa.albumId) as albumIdList
      FROM photos p
      LEFT JOIN photo_tags pt ON p.id = pt.photoId
      LEFT JOIN photo_albums pa ON p.id = pa.photoId
      WHERE p.trashed = 0 AND p.phash IS NOT NULL
      GROUP BY p.id
    `).all() as (Photo & { tagList: string | null; albumIdList: string | null; phash: string })[]

    const formattedPhotos = photos.map(row => ({
      ...row,
      trashed: Boolean(row.trashed),
      rating: row.rating || 0,
      tags: row.tagList ? row.tagList.split(',') : [],
      albumIds: row.albumIdList ? row.albumIdList.split(',') : []
    }))

    // 2. Group by visual similarity
    const exactDuplicates = new Map<string, Photo[]>()
    const groups: Photo[][] = []
    const processed = new Set<string>()

    const { calculateHammingDistance } = await import('../services/duplicates')

    // Find groups of duplicates (distance <= 5 usually means visually similar, but let's be strict: <= 2)
    const THRESHOLD = 2

    for (let i = 0; i < formattedPhotos.length; i++) {
      const p1 = formattedPhotos[i]
      if (processed.has(p1.id)) continue

      const group = [p1]
      processed.add(p1.id)

      for (let j = i + 1; j < formattedPhotos.length; j++) {
        const p2 = formattedPhotos[j]
        if (processed.has(p2.id)) continue

        const dist = calculateHammingDistance(p1.phash, p2.phash)
        if (dist <= THRESHOLD) {
          group.push(p2)
          processed.add(p2.id)
        }
      }

      if (group.length > 1) {
        // Sort group by file size descending (keep highest quality usually)
        group.sort((a, b) => b.fileSize - a.fileSize)
        groups.push(group)
      }
    }

    return groups // Array of Photo arrays, each inner array is a duplicate group
  })
}
