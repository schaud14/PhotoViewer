import { parentPort, workerData } from 'worker_threads'
import '@tensorflow/tfjs-backend-wasm'
import * as tf from '@tensorflow/tfjs-core'
import * as faceapi from '@vladmandic/face-api/dist/face-api.node-wasm.js'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import Database from 'better-sqlite3'

// We receive { photos: [{id, absolutePath}], dbPath: string, modelsPath: string }
const { photos, dbPath, modelsPath } = workerData as {
  photos: { id: string; absolutePath: string }[]
  dbPath: string
  modelsPath: string
}

const DISTANCE_THRESHOLD = 0.6
const MAX_DESCRIPTORS_PER_PERSON = 5

async function main() {
  console.log('[facesWorker] Worker started. Photos:', photos.length)
  console.log('[facesWorker] Models Path:', modelsPath)
  console.log('[facesWorker] DB Path:', dbPath)

  if (photos.length === 0) {
    parentPort?.postMessage({ type: 'done', data: { faces: [], newPeople: [] } })
    return
  }

  // 1. Initialize WASM Backend
  await tf.setBackend('wasm')
  await tf.ready()

  // 2. Load Models
  parentPort?.postMessage({ type: 'progress', data: { status: 'loading-models' } })
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath)
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath)
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)

  // 3. Connect to DB to load existing known faces for clustering
  const db = new Database(dbPath, { readonly: true })
  const knownFacesRows = db.prepare('SELECT personId, descriptor FROM faces WHERE descriptor IS NOT NULL').all() as { personId: string; descriptor: string }[]
  db.close()

  // Re-hydrate known descriptors into Float32Arrays for fast comparison
  // Optimization: Group descriptors by personId for multi-descriptor matching
  const knownFaceMemory = new Map<string, Float32Array[]>()
  
  for (const row of knownFacesRows) {
    const descriptors = knownFaceMemory.get(row.personId) || []
    if (descriptors.length < MAX_DESCRIPTORS_PER_PERSON) {
      descriptors.push(new Float32Array(JSON.parse(row.descriptor)))
      knownFaceMemory.set(row.personId, descriptors)
    }
  }

  const results: any[] = []
  const newPeopleCreated: { id: string; coverPhotoId: string }[] = []

  // 4. Process each photo
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    parentPort?.postMessage({
      type: 'progress',
      data: { status: 'scanning', current: i + 1, total: photos.length, file: photo.absolutePath }
    })

    try {
      // Fast nearest-neighbor downsample using sharp to prevent OOM on 50MB RAWs
      const { data, info } = await sharp(photo.absolutePath, { failOnError: false })
        .resize({ width: 1024, withoutEnlargement: true, fit: 'inside' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      // Create Tensor directly as 3-channel RGB
      const tensor = faceapi.tf.tensor3d(Uint8Array.from(data), [info.height, info.width, 3], 'int32')

      // Detect Faces + Landmarks + Descriptors
      const detections = await faceapi.detectAllFaces(tensor).withFaceLandmarks().withFaceDescriptors()
      tensor.dispose()

      const photoFaces: any[] = []

      for (const detection of detections) {
        const descriptor = detection.descriptor
        const box = detection.detection.box

        // Clustering: Calculate euclidean distance against all known faces
        let bestMatchPersonId: string | null = null
        let bestDistance = Number.MAX_VALUE

        for (const [personId, descriptors] of knownFaceMemory.entries()) {
          for (const knownDescriptor of descriptors) {
            const distance = faceapi.euclideanDistance(descriptor, knownDescriptor)
            if (distance < bestDistance && distance < DISTANCE_THRESHOLD) {
              bestDistance = distance
              bestMatchPersonId = personId
            }
          }
        }

        // If no match was found, create a new Person
        if (!bestMatchPersonId) {
          bestMatchPersonId = uuidv4()
          newPeopleCreated.push({ id: bestMatchPersonId, coverPhotoId: photo.id })
          knownFaceMemory.set(bestMatchPersonId, [descriptor])
        } else {
          // If match found, optionally add this descriptor as another representative if we have space
          const currentDescriptors = knownFaceMemory.get(bestMatchPersonId)!
          if (currentDescriptors.length < MAX_DESCRIPTORS_PER_PERSON) {
            // Only add if it's significantly different from existing ones to keep variety
            let minDiff = Number.MAX_VALUE
            for (const d of currentDescriptors) {
              minDiff = Math.min(minDiff, faceapi.euclideanDistance(descriptor, d))
            }
            if (minDiff > 0.1) {
              currentDescriptors.push(descriptor)
            }
          }
        }

        photoFaces.push({
          id: uuidv4(),
          photoId: photo.id,
          personId: bestMatchPersonId,
          boxX: box.x,
          boxY: box.y,
          boxW: box.width,
          boxH: box.height,
          descriptor: JSON.stringify(Array.from(descriptor)) // Stringify for SQLite
        })
      }

      if (photoFaces.length > 0) {
        results.push(...photoFaces)
      }

    } catch (err: any) {
      console.error(`[facesWorker] Error processing ${photo.absolutePath}:`, err.message)
    }
  }

  // Done!
  parentPort?.postMessage({ type: 'done', data: { faces: results, newPeople: newPeopleCreated } })
}

main().catch((err) => {
  console.error('[facesWorker] Fatal Error:', err)
  parentPort?.postMessage({ type: 'error', error: err.message })
})
