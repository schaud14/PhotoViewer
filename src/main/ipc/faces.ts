import { ipcMain } from 'electron'
import { IPC_CHANNELS, Person, FaceBox } from '../../shared/types'
import { getDatabase } from '../db/database'

export function registerFacesHandlers(): void {
  // Get all people with at least one face, including their cover photo ID
  ipcMain.handle(IPC_CHANNELS.GET_PEOPLE, async () => {
    const db = getDatabase()
    
    // Count faces per person
    const people = db.prepare(`
      SELECT p.id, p.name, p.coverPhotoId, COUNT(f.id) as faceCount
      FROM people p
      LEFT JOIN faces f ON p.id = f.personId
      GROUP BY p.id
      HAVING faceCount > 0
    `).all() as Person[]
    
    return people
  })

  // Get all faces (and associated photo info) for a specific person
  ipcMain.handle(IPC_CHANNELS.GET_FACES_FOR_PERSON, async (_event, personId: string) => {
    const db = getDatabase()
    
    // Fetch face boxes linked to photo details
    const result = db.prepare(`
      SELECT f.*, p.absolutePath, p.fileName
      FROM faces f
      JOIN photos p ON f.photoId = p.id
      WHERE f.personId = ? AND p.trashed = 0
    `).all(personId) as any[]
    
    return result
  })

  // Rename a person
  ipcMain.handle(IPC_CHANNELS.RENAME_PERSON, async (_event, personId: string, name: string) => {
    const db = getDatabase()
    db.prepare('UPDATE people SET name = ? WHERE id = ?').run(name, personId)
  })

  // Set the cover photo for a person to a specific face's photo
  ipcMain.handle(IPC_CHANNELS.SET_COVER_PHOTO, async (_event, personId: string, photoId: string) => {
    const db = getDatabase()
    db.prepare('UPDATE people SET coverPhotoId = ? WHERE id = ?').run(photoId, personId)
  })

  // Clear all face detection data and reset scan status for all photos
  ipcMain.handle(IPC_CHANNELS.RESET_FACES, async () => {
    console.log('[FacesIPC] RESET_FACES requested')
    const db = getDatabase()
    try {
      db.transaction(() => {
        const faceCount = db.prepare('DELETE FROM faces').run().changes
        const personCount = db.prepare('DELETE FROM people').run().changes
        const photoCount = db.prepare('UPDATE photos SET facesScanned = 0').run().changes
        console.log(`[FacesIPC] Reset complete. Deleted ${faceCount} faces, ${personCount} people. Reset ${photoCount} photos.`)
      })()
    } catch (err) {
      console.error('[FacesIPC] Reset failed:', err)
      throw err
    }
  })
}
