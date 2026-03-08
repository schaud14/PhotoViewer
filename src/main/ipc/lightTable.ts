import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { IPC_CHANNELS, LightTable, LightTablePhoto, Photo } from '../../shared/types'

export function registerLightTableHandlers(db: Database.Database): void {
  // Create a new Light Table
  ipcMain.handle(IPC_CHANNELS.CREATE_LIGHT_TABLE, async (_event, name: string): Promise<LightTable> => {
    const id = uuidv4()
    const now = new Date().toISOString()
    db.prepare('INSERT INTO light_tables (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run(id, name, now, now)
    return { id, name, createdAt: now, updatedAt: now }
  })

  // Get all Light Tables
  ipcMain.handle(IPC_CHANNELS.GET_LIGHT_TABLES, async (): Promise<LightTable[]> => {
    return db.prepare('SELECT * FROM light_tables ORDER BY updatedAt DESC').all() as LightTable[]
  })

  // Get a single Light Table with its photos joined
  ipcMain.handle(IPC_CHANNELS.GET_LIGHT_TABLE, async (_event, id: string): Promise<{ table: LightTable, photos: LightTablePhoto[] } | null> => {
    const table = db.prepare('SELECT * FROM light_tables WHERE id = ?').get(id) as LightTable | undefined
    if (!table) return null

    const ltpRows = db.prepare(`
      SELECT ltp.*, p.*,
        GROUP_CONCAT(DISTINCT pt.tag) as tagList,
        GROUP_CONCAT(DISTINCT pa.albumId) as albumIdList
      FROM light_table_photos ltp
      JOIN photos p ON ltp.photoId = p.id
      LEFT JOIN photo_tags pt ON p.id = pt.photoId
      LEFT JOIN photo_albums pa ON p.id = pa.photoId
      WHERE ltp.tableId = ?
      GROUP BY p.id
      ORDER BY ltp.zIndex ASC
    `).all(id) as Array<any>

    const photos: LightTablePhoto[] = ltpRows.map(row => {
      const { tableId, photoId, x, y, width, height, zIndex, tagList, albumIdList, ...photoData } = row
      
      const photo: Photo = {
        ...photoData,
        tags: tagList ? tagList.split(',') : [],
        albumIds: albumIdList ? albumIdList.split(',') : []
      }

      return { tableId, photoId, x, y, width, height, zIndex, photo }
    })

    return { table, photos }
  })

  // Add photos to a Light Table
  ipcMain.handle(IPC_CHANNELS.ADD_PHOTOS_TO_LIGHT_TABLE, async (_event, tableId: string, photoIds: string[]) => {
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO light_table_photos 
      (tableId, photoId, x, y, width, height, zIndex) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    // Get max zIndex to place new photos on top
    const maxZRow = db.prepare('SELECT MAX(zIndex) as maxZ FROM light_table_photos WHERE tableId = ?').get(tableId) as { maxZ: number | null }
    let nextZIndex = (maxZRow.maxZ || 0) + 1

    const transaction = db.transaction((ids: string[]) => {
      // Offset starting positions so they cascade visually
      let offset = 0
      for (const id of ids) {
        insertStmt.run(tableId, id, 50 + offset, 50 + offset, 250, 250, nextZIndex++)
        offset += 40
      }
    })

    transaction(photoIds)
    db.prepare("UPDATE light_tables SET updatedAt = datetime('now') WHERE id = ?").run(tableId)
  })

  // Update a single photo's position/size/z-index
  ipcMain.handle(IPC_CHANNELS.UPDATE_LIGHT_TABLE_PHOTO, async (_event, tableId: string, photoId: string, changes: Partial<LightTablePhoto>) => {
    const keys = Object.keys(changes).filter(k => ['x', 'y', 'width', 'height', 'zIndex'].includes(k))
    if (keys.length === 0) return

    const sets = keys.map(k => `${k} = ?`).join(', ')
    const values = keys.map(k => (changes as any)[k])
    
    db.prepare(`UPDATE light_table_photos SET ${sets} WHERE tableId = ? AND photoId = ?`).run(...values, tableId, photoId)
    db.prepare("UPDATE light_tables SET updatedAt = datetime('now') WHERE id = ?").run(tableId)
  })

  // Remove photo from Light Table
  ipcMain.handle(IPC_CHANNELS.REMOVE_PHOTO_FROM_LIGHT_TABLE, async (_event, tableId: string, photoId: string) => {
    db.prepare('DELETE FROM light_table_photos WHERE tableId = ? AND photoId = ?').run(tableId, photoId)
    db.prepare("UPDATE light_tables SET updatedAt = datetime('now') WHERE id = ?").run(tableId)
  })

  // Delete entire Light Table
  ipcMain.handle(IPC_CHANNELS.DELETE_LIGHT_TABLE, async (_event, id: string) => {
    // Casading deletes will handle light_table_photos entries
    db.prepare('DELETE FROM light_tables WHERE id = ?').run(id)
  })
}
