import { ipcMain, app } from 'electron'
import { Worker } from 'worker_threads'
import { join } from 'path'
import { Database } from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/types'

let aiWorker: Worker | null = null

export function registerAIHandlers(db: Database) {
  // Trigger full AI scan
  ipcMain.handle(IPC_CHANNELS.SCAN_LIBRARY + ':ai', async () => {
    if (aiWorker) return { status: 'already-running' }

    // Get all photos that haven't been scanned by AI yet
    const photos = db.prepare(`
      SELECT id, absolutePath FROM photos 
      WHERE id NOT IN (SELECT photoId FROM embeddings) 
      AND trashed = 0
    `).all() as { id: string; absolutePath: string }[]

    if (photos.length === 0) return { status: 'no-new-photos' }

    // Path to the native Swift binary
    // In production, this would be in the App Contents, but for dev we'll check the source dir
    const binPath = app.isPackaged 
      ? join(process.resourcesPath, 'bin', 'visionHelper')
      : join(app.getAppPath(), 'src/main/native/visionHelper')

    aiWorker = new Worker(join(__dirname, 'aiWorker.js'), {
      workerData: { photos, binPath }
    })

    aiWorker.on('message', (msg) => {
      if (msg.type === 'progress') {
        const { current, total } = msg.data
        // Notify renderer of progress
        const window = require('electron').BrowserWindow.getAllWindows()[0]
        window?.webContents.send('library:ai-progress', { current, total })
      } else if (msg.type === 'done') {
        saveAIResults(db, msg.data)
        aiWorker = null
      }
    })

    aiWorker.on('error', (err) => {
      console.error('[AI IPC] Worker Error:', err)
      aiWorker = null
    })

    return { status: 'started', count: photos.length }
  })

  // Get top AI-generated tags
  ipcMain.handle('ai:get-tags', async () => {
    return db.prepare(`
      SELECT tag, COUNT(*) as count, AVG(confidence) as avgConfidence
      FROM ai_tags
      GROUP BY tag
      HAVING count > 1
      ORDER BY count DESC
      LIMIT 15
    `).all()
  })

  // Get high-aesthetic photos (Best Shots)
  ipcMain.handle('ai:get-best-shots', async (_, limit = 50) => {
    return db.prepare(`
      SELECT * FROM photos 
      WHERE aestheticScore > 0.7 
      AND trashed = 0
      ORDER BY aestheticScore DESC 
      LIMIT ?
    `).all(limit)
  })

  // Semantic search query
  // This is a placeholder for after the core integration is stable
  ipcMain.handle('ai:search', async (_, query: string) => {
    // 1. Generate embedding for text query (requires CLIP or similar, or 
    // we use a Swift command if Apple supports text featureprints)
    // For now, we'll return an empty list or mock until we have the text model
    return []
  })
}

function saveAIResults(db: Database, results: any[]) {
  const insertEmbedding = db.prepare('INSERT OR REPLACE INTO embeddings (photoId, vector) VALUES (?, ?)')
  const insertTag = db.prepare('INSERT OR REPLACE INTO ai_tags (photoId, tag, confidence) VALUES (?, ?, ?)')
  const updateAesthetic = db.prepare('UPDATE photos SET aestheticScore = ? WHERE id = ?')

  const transaction = db.transaction((data) => {
    for (const res of data) {
      // 1. Save Embedding (Float32Array to Buffer)
      if (res.embedding) {
        const buffer = Buffer.from(new Float32Array(res.embedding).buffer)
        insertEmbedding.run(res.id, buffer)
      }

      // 2. Save Tags
      if (res.tags) {
        for (const [tag, confidence] of Object.entries(res.tags)) {
          insertTag.run(res.id, tag, confidence)
        }
      }

      // 3. Save Aesthetic Score
      if (res.aestheticScore !== undefined) {
        updateAesthetic.run(res.aestheticScore, res.id)
      }
    }
  })

  transaction(results)
  console.log(`[AI IPC] Saved results for ${results.length} photos`)
}
