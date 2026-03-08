import { ipcMain, app } from 'electron'
import Database from 'better-sqlite3'
import { promises as fs } from 'fs'
import { join, basename } from 'path'
import { IPC_CHANNELS } from '../../shared/types'
import type { TrashRestoreResult } from '../../shared/types'

function getTrashDir(): string {
  return join(app.getPath('userData'), 'trash')
}

export function registerTrashHandlers(db: Database.Database): void {
  // Delete a photo
  ipcMain.handle(IPC_CHANNELS.DELETE_PHOTO, async (_event, photoId: string, context?: { albumId?: string; albumType?: string }) => {
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as { id: string; absolutePath: string; originalPath: string } | undefined
    if (!photo) throw new Error('Photo not found')

    // If deleting from a virtual album, just remove the reference
    if (context?.albumType === 'virtual' && context.albumId) {
      db.prepare('DELETE FROM photo_albums WHERE photoId = ? AND albumId = ?').run(photoId, context.albumId)
      return
    }

    // Physical delete: move file to trash folder
    const trashDir = getTrashDir()
    await fs.mkdir(trashDir, { recursive: true })

    const trashPath = join(trashDir, `${photoId}_${basename(photo.absolutePath)}`)

    try {
      await fs.rename(photo.absolutePath, trashPath)
      db.prepare('UPDATE photos SET absolutePath = ?, trashed = 1 WHERE id = ?').run(trashPath, photoId)
    } catch (err) {
      console.error(`[Trash] Error moving file to trash:`, err)
      throw err
    }
  })

  // Restore a photo from trash
  ipcMain.handle(IPC_CHANNELS.RESTORE_PHOTO, async (_event, photoId: string): Promise<TrashRestoreResult> => {
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as { id: string; absolutePath: string; originalPath: string; physicalAlbumId: string | null } | undefined
    if (!photo) return { success: false, message: 'Photo not found' }

    const restorePath = photo.originalPath

    // Check for conflict
    try {
      await fs.access(restorePath)
      // File exists at original location — conflict
      return { success: false, conflict: true, message: `A file already exists at ${restorePath}` }
    } catch {
      // No conflict, proceed
    }

    // Ensure the parent directory exists
    const parentDir = restorePath.substring(0, restorePath.lastIndexOf('/'))
    await fs.mkdir(parentDir, { recursive: true })

    try {
      await fs.rename(photo.absolutePath, restorePath)
      db.prepare('UPDATE photos SET absolutePath = ?, trashed = 0 WHERE id = ?').run(restorePath, photoId)
      return { success: true }
    } catch (err) {
      console.error(`[Trash] Error restoring file:`, err)
      return { success: false, message: String(err) }
    }
  })

  // Permanently delete a photo
  ipcMain.handle(IPC_CHANNELS.PERMANENTLY_DELETE, async (_event, photoId: string) => {
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as { id: string; absolutePath: string } | undefined
    if (!photo) return

    try {
      await fs.unlink(photo.absolutePath)
    } catch (err) {
      console.warn(`[Trash] Could not delete file ${photo.absolutePath}:`, err)
    }

    // Remove from all tables
    db.prepare('DELETE FROM photo_tags WHERE photoId = ?').run(photoId)
    db.prepare('DELETE FROM photo_albums WHERE photoId = ?').run(photoId)
    db.prepare('DELETE FROM photos WHERE id = ?').run(photoId)
  })

  // Empty trash
  ipcMain.handle(IPC_CHANNELS.EMPTY_TRASH, async () => {
    const trashedPhotos = db.prepare('SELECT * FROM photos WHERE trashed = 1').all() as { id: string; absolutePath: string }[]

    for (const photo of trashedPhotos) {
      try {
        await fs.unlink(photo.absolutePath)
      } catch (err) {
        console.warn(`[Trash] Could not delete ${photo.absolutePath}:`, err)
      }

      db.prepare('DELETE FROM photo_tags WHERE photoId = ?').run(photo.id)
      db.prepare('DELETE FROM photo_albums WHERE photoId = ?').run(photo.id)
      db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id)
    }
  })

  // Get all trashed photos
  ipcMain.handle(IPC_CHANNELS.GET_TRASH, async () => {
    const rows = db.prepare(`
      SELECT p.*,
        GROUP_CONCAT(DISTINCT pt.tag) as tagList,
        GROUP_CONCAT(DISTINCT pa.albumId) as albumIdList
      FROM photos p
      LEFT JOIN photo_tags pt ON p.id = pt.photoId
      LEFT JOIN photo_albums pa ON p.id = pa.photoId
      WHERE p.trashed = 1
      GROUP BY p.id
      ORDER BY p.modifiedAt DESC
    `).all() as Array<{ tagList: string | null; albumIdList: string | null; trashed: number }>

    return rows.map(row => ({
      ...row,
      trashed: true,
      tags: row.tagList ? row.tagList.split(',') : [],
      albumIds: row.albumIdList ? row.albumIdList.split(',') : []
    }))
  })
}
