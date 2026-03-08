import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/types'

export function registerTagHandlers(db: Database.Database): void {
  // Add tags to a photo
  ipcMain.handle(IPC_CHANNELS.ADD_TAGS, async (_event, photoId: string, tags: string[]) => {
    const stmt = db.prepare('INSERT OR IGNORE INTO photo_tags (photoId, tag) VALUES (?, ?)')
    const insertMany = db.transaction((tagList: string[]) => {
      for (const tag of tagList) {
        const normalizedTag = tag.trim().toLowerCase()
        if (normalizedTag) {
          stmt.run(photoId, normalizedTag)
        }
      }
    })
    insertMany(tags)
  })

  // Remove tags from a photo
  ipcMain.handle(IPC_CHANNELS.REMOVE_TAGS, async (_event, photoId: string, tags: string[]) => {
    const stmt = db.prepare('DELETE FROM photo_tags WHERE photoId = ? AND tag = ?')
    const removeMany = db.transaction((tagList: string[]) => {
      for (const tag of tagList) {
        stmt.run(photoId, tag.trim().toLowerCase())
      }
    })
    removeMany(tags)
  })

  // Get all unique tags for autocomplete
  ipcMain.handle(IPC_CHANNELS.GET_ALL_TAGS, async () => {
    const rows = db.prepare(
      'SELECT DISTINCT tag FROM photo_tags ORDER BY tag ASC'
    ).all() as { tag: string }[]

    return rows.map(r => r.tag)
  })
}
