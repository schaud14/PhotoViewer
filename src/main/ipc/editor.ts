import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { promises as fs } from 'fs'
import { join, dirname, extname, basename } from 'path'
import sharp from 'sharp'
import { IPC_CHANNELS } from '../../shared/types'
import type { Photo } from '../../shared/types'
import { isHeic } from '../services/heicConverter'
import { generateThumbnail } from '../services/thumbnails'

export function registerEditorHandlers(db: Database.Database): void {
  // Rename Photo
  ipcMain.handle(IPC_CHANNELS.RENAME_PHOTO, async (_event, photoId: string, newName: string) => {
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as Photo | undefined
    if (!photo) throw new Error('Photo not found')

    // Ensure extension remains
    let newFileName = newName.trim()
    const oldExt = extname(photo.fileName)
    if (!newFileName.toLowerCase().endsWith(oldExt.toLowerCase())) {
      newFileName += oldExt
    }

    if (newFileName === photo.fileName) return photo // No change

    const dir = dirname(photo.absolutePath)
    let newPath = join(dir, newFileName)
    let counter = 1

    // Handle collision
    while (true) {
      if (newPath === photo.absolutePath) break // same file case handled above
      try {
        await fs.access(newPath)
        const nameWithoutExt = basename(newFileName, oldExt)
        newPath = join(dir, `${nameWithoutExt}_${counter}${oldExt}`)
        counter++
      } catch {
        break // path is clear
      }
    }

    const finalFileName = basename(newPath)

    try {
      await fs.rename(photo.absolutePath, newPath)

      // If trashed, originalPath should technically not change for rename (or maybe it should)
      // Usually you rename active files. Let's assume it's an active file for now.
      
      const now = new Date().toISOString()
      db.prepare(`
        UPDATE photos 
        SET absolutePath = ?, originalPath = ?, fileName = ?, modifiedAt = ?
        WHERE id = ?
      `).run(newPath, newPath, finalFileName, now, photo.id)

      return db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as Photo
    } catch (err) {
      console.error(`[Editor] Failed to rename photo ${photoId}:`, err)
      throw new Error(`Rename failed: ${(err as Error).message}`)
    }
  })

  // Rotate Photo
  ipcMain.handle(IPC_CHANNELS.ROTATE_PHOTO, async (_event, photoId: string, direction: 'left' | 'right') => {
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as Photo | undefined
    if (!photo) throw new Error('Photo not found')

    if (isHeic(photo.absolutePath)) {
      throw new Error('Rotation is not currently supported for HEIC files directly. Convert to JPEG first.')
    }

    const angle = direction === 'right' ? 90 : -90
    const tmpPath = `${photo.absolutePath}.tmp`

    try {
      console.log(`[Editor] Starting rotation for ${photoId} (direction: ${direction}, angle: ${angle})`)
      console.log(`[Editor] Rotating ${photoId} by ${angle}deg...`)
      
      // Physically rotate the image using sharp and strip EXIF orientation to prevent double-rotation
      await sharp(photo.absolutePath)
        .rotate(angle)
        .withMetadata({ orientation: 1 }) // force standard orientation
        .toFile(tmpPath)
      
      console.log(`[Editor] Sharp rotation complete. Updating files...`)

      // Replace original with rotated
      await fs.rm(photo.absolutePath)
      await fs.rename(tmpPath, photo.absolutePath)

      // Update db dimension roughly by swapping if 90deg (Sharp will auto-rotate true pixels)
      const now = new Date().toISOString()
      
      if (photo.width && photo.height) {
        db.prepare('UPDATE photos SET width = ?, height = ?, modifiedAt = ? WHERE id = ?')
          .run(photo.height, photo.width, now, photoId)
      } else {
        db.prepare('UPDATE photos SET modifiedAt = ? WHERE id = ?')
          .run(now, photoId)
      }

      console.log(`[Editor] Successfully rotated ${photoId}. New dimensions: ${photo.height}x${photo.width}`)

      // Automatically re-generate the thumbnail so the UI picks up the change immediately
      // Pass 'now' (modifiedAt) to ensure a unique thumbnail hash is generated
      const newThumbnailPath = await generateThumbnail(photo.absolutePath, now)
      if (newThumbnailPath) {
        db.prepare('UPDATE photos SET thumbnailPath = ? WHERE id = ?').run(newThumbnailPath, photoId)
        console.log(`[Editor] New thumbnail generated: ${newThumbnailPath}`)
      }

      return db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as Photo
    } catch (err) {
      console.error(`[Editor] FATAL ERROR rotating photo ${photoId}:`, err)
      
      // Clean up tmp file if it failed midway
      try {
        const tmpPath = `${photo.absolutePath}.tmp`
        await fs.access(tmpPath)
        await fs.rm(tmpPath)
        console.log(`[Editor] Cleaned up temporary file: ${tmpPath}`)
      } catch (e) {
        // ignore
      }
      
      throw new Error(`Rotation failed: ${(err as Error).message}`)
    }
  })

  // Toggle Favorite
  ipcMain.handle(IPC_CHANNELS.TOGGLE_FAVORITE, async (_event, photoId: string) => {
    const favoritesAlbumId = 'favorites-album'
    const exists = db.prepare('SELECT 1 FROM photo_albums WHERE photoId = ? AND albumId = ?')
      .get(photoId, favoritesAlbumId)

    if (exists) {
      db.prepare('DELETE FROM photo_albums WHERE photoId = ? AND albumId = ?')
        .run(photoId, favoritesAlbumId)
      return { isFavorite: false }
    } else {
      db.prepare('INSERT INTO photo_albums (photoId, albumId) VALUES (?, ?)')
        .run(photoId, favoritesAlbumId)
      return { isFavorite: true }
    }
  })

  // Set Rating (0-5 stars)
  ipcMain.handle(IPC_CHANNELS.SET_RATING, async (_event, photoId: string, rating: number) => {
    const clampedRating = Math.max(0, Math.min(5, Math.round(rating)))
    db.prepare('UPDATE photos SET rating = ? WHERE id = ?').run(clampedRating, photoId)
    return { rating: clampedRating }
  })

  // Set Color Label
  ipcMain.handle(IPC_CHANNELS.SET_COLOR_LABEL, async (_event, photoId: string, colorLabel: string | null) => {
    db.prepare('UPDATE photos SET colorLabel = ? WHERE id = ?').run(colorLabel, photoId)
    return { colorLabel }
  })

  // Export Photos
  ipcMain.handle(IPC_CHANNELS.EXPORT_PHOTOS, async (_event, options: {
    photoIds: string[],
    format?: 'jpeg' | 'png' | 'webp' | 'original',
    quality?: number,
    maxSize?: number,
  }) => {
    const sharp = (await import('sharp')).default
    const { dialog } = await import('electron')
    const { BrowserWindow } = await import('electron')
    const fs = await import('fs/promises')
    const path = await import('path')

    const window = BrowserWindow.getFocusedWindow()
    if (!window) return { success: false, message: 'No window' }

    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Export Photos To...',
    })
    if (result.canceled || !result.filePaths[0]) return { success: false, message: 'Cancelled' }

    const destFolder = result.filePaths[0]
    let exported = 0

    for (const photoId of options.photoIds) {
      const photo = db.prepare('SELECT absolutePath, fileName FROM photos WHERE id = ?').get(photoId) as { absolutePath: string, fileName: string } | undefined
      if (!photo) continue

      try {
        const ext = path.extname(photo.fileName).toLowerCase()
        const baseName = path.basename(photo.fileName, ext)

        if (options.format === 'original' || !options.format) {
          // Copy original
          const destPath = path.join(destFolder, photo.fileName)
          await fs.copyFile(photo.absolutePath, destPath)
        } else {
          // Convert with sharp
          let pipeline = sharp(photo.absolutePath)
          if (options.maxSize) {
            pipeline = pipeline.resize(options.maxSize, options.maxSize, { fit: 'inside', withoutEnlargement: true })
          }
          const formatExt = options.format === 'jpeg' ? 'jpg' : options.format
          const destPath = path.join(destFolder, `${baseName}.${formatExt}`)

          if (options.format === 'jpeg') {
            await pipeline.jpeg({ quality: options.quality || 90 }).toFile(destPath)
          } else if (options.format === 'png') {
            await pipeline.png().toFile(destPath)
          } else if (options.format === 'webp') {
            await pipeline.webp({ quality: options.quality || 85 }).toFile(destPath)
          }
        }
        exported++
      } catch (err) {
        console.error(`[Export] Failed to export ${photo.fileName}:`, err)
      }
    }

    return { success: true, exported, total: options.photoIds.length }
  })

  // Apply Edits (Brightness, Contrast, Saturation)
  ipcMain.handle(IPC_CHANNELS.APPLY_EDITS, async (_event, photoId: string, edits: { brightness: number, saturation: number, contrast: number }) => {
    const sharp = (await import('sharp')).default
    const fs = await import('fs/promises')
    
    const photo = db.prepare('SELECT absolutePath FROM photos WHERE id = ?').get(photoId) as { absolutePath: string } | undefined
    if (!photo) return { success: false, message: 'Photo not found' }

    try {
      const tempPath = `${photo.absolutePath}.tmp.jpg`
      
      // Calculate sharp modifiers based on 0-200 UI range where 100 is default
      // Sharp modulate: brightness (multiplier), saturation (multiplier)
      const bMult = edits.brightness / 100
      const sMult = edits.saturation / 100
      
      // Sharp doesn't have a direct contrast modifier in modulate, but linear does
      // C = contrast (1 = default)
      const cMult = edits.contrast / 100

      let pipeline = sharp(photo.absolutePath)
        .modulate({
          brightness: bMult,
          saturation: sMult,
        })
        .linear(cMult, -(128 * cMult) + 128) // Basic contrast approximation
        
      await pipeline.toFile(tempPath)
      
      // Replace original
      await fs.rename(tempPath, photo.absolutePath)
      
      // Update DB modified time to break cache
      db.prepare('UPDATE photos SET modifiedAt = CURRENT_TIMESTAMP WHERE id = ?').run(photoId)
      
      // Regenerate thumbnail and phash
      const { generateThumbnail } = await import('../services/thumbnails')
      const { generatePHash } = await import('../services/duplicates')
      
      const thumbPath = await generateThumbnail(photo.absolutePath)
      const phash = await generatePHash(photo.absolutePath)
      
      db.prepare('UPDATE photos SET thumbnailPath = ?, phash = ? WHERE id = ?').run(thumbPath, phash, photoId)

      return { success: true }
    } catch (err: any) {
      console.error(`[Edit] Failed to edit photo:`, err)
      return { success: false, message: err.message }
    }
  })
}
