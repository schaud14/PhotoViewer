import { ipcMain, dialog, BrowserWindow } from 'electron'
import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'fs'
import { join, basename, extname } from 'path'
import { IPC_CHANNELS } from '../../shared/types'
import type { Album } from '../../shared/types'
import { getSettings } from './settings'
import { isHeic, convertHeicToJpeg } from '../services/heicConverter'

export function registerAlbumHandlers(db: Database.Database): void {
  // Create album
  ipcMain.handle(IPC_CHANNELS.CREATE_ALBUM, async (_event, data: { name: string; type: 'virtual' | 'physical'; basePath?: string }) => {
    const id = uuidv4()
    let folderPath: string | null = null

    if (data.type === 'physical') {
      // For physical albums, choose or use basePath
      if (data.basePath) {
        folderPath = join(data.basePath, data.name)
      } else {
        const window = BrowserWindow.getFocusedWindow()
        if (window) {
          const result = await dialog.showOpenDialog(window, {
            properties: ['openDirectory'],
            title: 'Select location for physical album folder'
          })
          if (result.canceled || result.filePaths.length === 0) {
            throw new Error('No folder selected for physical album')
          }
          folderPath = join(result.filePaths[0], data.name)
        }
      }

      // Create the physical folder on disk
      if (folderPath) {
        await fs.mkdir(folderPath, { recursive: true })
      }
    }

    const stmt = db.prepare(
      'INSERT INTO albums (id, name, type, folderPath) VALUES (?, ?, ?, ?)'
    )
    stmt.run(id, data.name, data.type, folderPath)

    const album: Album = {
      id,
      name: data.name,
      type: data.type,
      folderPath: folderPath || undefined,
      createdAt: new Date().toISOString()
    }

    return album
  })

  // Get all albums
  ipcMain.handle(IPC_CHANNELS.GET_ALBUMS, async () => {
    const albums = db.prepare(`
      SELECT a.*,
        CASE
          WHEN a.type = 'virtual' THEN (SELECT COUNT(*) FROM photo_albums pa WHERE pa.albumId = a.id)
          WHEN a.type = 'physical' THEN (SELECT COUNT(*) FROM photos p WHERE p.physicalAlbumId = a.id AND p.trashed = 0)
          ELSE 0
        END as photoCount
      FROM albums a
      ORDER BY a.createdAt DESC
    `).all()

    return albums
  })

  // Get single album
  ipcMain.handle(IPC_CHANNELS.GET_ALBUM, async (_event, id: string) => {
    return db.prepare('SELECT * FROM albums WHERE id = ?').get(id)
  })

  // Delete album
  ipcMain.handle(IPC_CHANNELS.DELETE_ALBUM, async (_event, id: string) => {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(id) as Album | undefined
    if (!album) throw new Error('Album not found')

    if (album.type === 'virtual') {
      // Just remove album and references
      db.prepare('DELETE FROM photo_albums WHERE albumId = ?').run(id)
    } else {
      // Physical album: unlink photos from album
      db.prepare('UPDATE photos SET physicalAlbumId = NULL WHERE physicalAlbumId = ?').run(id)
    }

    db.prepare('DELETE FROM albums WHERE id = ?').run(id)
  })

  // Add photos to album
  ipcMain.handle(IPC_CHANNELS.ADD_PHOTOS_TO_ALBUM, async (_event, albumId: string, photoIds: string[]) => {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(albumId) as Album | undefined
    if (!album) throw new Error('Album not found')

    if (album.type === 'virtual') {
      const insertStmt = db.prepare('INSERT OR IGNORE INTO photo_albums (photoId, albumId) VALUES (?, ?)')
      const insertMany = db.transaction((ids: string[]) => {
        for (const photoId of ids) {
          insertStmt.run(photoId, albumId)
        }
      })
      insertMany(photoIds)
    } else {
      // Physical album: move files to album folder
      if (!album.folderPath) throw new Error('Physical album has no folder path')

      const updateStmt = db.prepare('UPDATE photos SET absolutePath = ?, physicalAlbumId = ? WHERE id = ? AND physicalAlbumId IS NULL')

      for (const photoId of photoIds) {
        const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as { id: string; absolutePath: string; physicalAlbumId: string | null; fileName: string } | undefined
        if (!photo) continue

        // Check: photo can only be in ONE physical album
        if (photo.physicalAlbumId) {
          console.warn(`[Albums] Photo ${photoId} is already in physical album ${photo.physicalAlbumId}, skipping`)
          continue
        }

        const destPath = join(album.folderPath, photo.fileName)

        try {
          // Handle filename collision
          let finalPath = destPath
          let counter = 1
          while (true) {
            try {
              await fs.access(finalPath)
              // File exists, try with counter
              const ext = finalPath.lastIndexOf('.')
              const name = ext > 0 ? finalPath.substring(0, ext) : finalPath
              const extension = ext > 0 ? finalPath.substring(ext) : ''
              finalPath = join(album.folderPath, `${basename(name)}_${counter}${extension}`)
              counter++
            } catch {
              break // File doesn't exist, use this path
            }
          }

          const settings = getSettings()
          const needsConversion = settings.heicConversion && isHeic(photo.absolutePath)

          if (needsConversion) {
            // Convert to JPEG and save directly to physical album folder
            const jpegPath = await convertHeicToJpeg(photo.absolutePath, finalPath)
            
            // Delete original HEIC file since it's a move operation
            await fs.unlink(photo.absolutePath).catch(err => 
              console.error(`[Albums] Failed to delete original HEIC after conversion:`, err)
            )
            
            updateStmt.run(jpegPath, albumId, photoId)
          } else {
            // Standard move
            await fs.rename(photo.absolutePath, finalPath)
            updateStmt.run(finalPath, albumId, photoId)
          }
        } catch (err) {
          console.error(`[Albums] Error moving photo ${photoId} to album:`, err)
        }
      }
    }
  })

  // Remove photo from album
  ipcMain.handle(IPC_CHANNELS.REMOVE_PHOTO_FROM_ALBUM, async (_event, albumId: string, photoId: string) => {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(albumId) as Album | undefined
    if (!album) throw new Error('Album not found')

    if (album.type === 'virtual') {
      db.prepare('DELETE FROM photo_albums WHERE photoId = ? AND albumId = ?').run(photoId, albumId)
    } else {
      // Physical album: move file back to original location
      const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as { id: string; absolutePath: string; originalPath: string } | undefined
      if (!photo) return

      try {
        await fs.rename(photo.absolutePath, photo.originalPath)
        db.prepare('UPDATE photos SET absolutePath = ?, physicalAlbumId = NULL WHERE id = ?').run(photo.originalPath, photoId)
      } catch (err) {
        console.error(`[Albums] Error moving photo back:`, err)
      }
    }
  })
}
