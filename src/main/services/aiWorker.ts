import { parentPort, workerData } from 'worker_threads'
import { spawn } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'

// We receive { photos: [{id, absolutePath}], binPath: string }
const { photos, binPath } = workerData as {
  photos: { id: string; absolutePath: string }[]
  binPath: string
}

async function main() {
  console.log('[aiWorker] Worker started. Photos to process:', photos.length)
  console.log('[aiWorker] Binary Path:', binPath)

  if (photos.length === 0) {
    parentPort?.postMessage({ type: 'done', data: [] })
    return
  }

  if (!existsSync(binPath)) {
    console.error('[aiWorker] Native binary not found at:', binPath)
    parentPort?.postMessage({ type: 'error', error: 'Native binary not found' })
    return
  }

  // Process in batches to avoid overwhelming memory/shell limits
  const BATCH_SIZE = 10
  const results: any[] = []

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE)
    const paths = batch.map(p => p.absolutePath)

    parentPort?.postMessage({
      type: 'progress',
      data: { current: i, total: photos.length, status: 'processing' }
    })

    try {
      const output = await runNativeVision(paths)
      const batchResults = JSON.parse(output)
      
      // Match back to IDs
      batchResults.forEach((res: any) => {
        const photo = batch.find(p => p.absolutePath === res.path)
        if (photo) {
          results.push({
            ...res,
            id: photo.id
          })
        }
      })
    } catch (err: any) {
      console.error(`[aiWorker] Error processing batch starting at ${i}:`, err.message)
    }
  }

  parentPort?.postMessage({ type: 'done', data: results })
}

function runNativeVision(paths: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(binPath)
    let stdout = ''
    let stderr = ''

    process.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    process.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || `Process exited with code ${code}`))
      }
    })

    // Write paths as JSON to stdin
    process.stdin.write(JSON.stringify(paths))
    process.stdin.end()
  })
}

main().catch((err) => {
  console.error('[aiWorker] Fatal Error:', err)
  parentPort?.postMessage({ type: 'error', error: err.message })
})
