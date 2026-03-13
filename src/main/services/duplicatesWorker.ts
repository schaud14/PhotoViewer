import { parentPort, workerData } from 'worker_threads'

interface PhotoData {
  id: string
  phash: string
  fileSize: number
}

interface WorkerData {
  photos: PhotoData[]
  threshold: number
}

// Ensure the worker is receiving data
if (parentPort) {
  const { photos, threshold } = workerData as WorkerData

  /**
   * Calculates the Hamming distance between two hex hashes.
   * Returns the number of differing bits (0 to 64).
   */
  function calculateHammingDistance(hex1: string, hex2: string): number {
    if (!hex1 || !hex2 || hex1.length !== 16 || hex2.length !== 16) return 64

    let distance = 0
    for (let i = 0; i < 16; i++) {
      const n1 = parseInt(hex1[i], 16)
      const n2 = parseInt(hex2[i], 16)
      const xor = n1 ^ n2
      let count = 0
      let n = xor
      while (n > 0) {
        count += n & 1
        n >>= 1
      }
      distance += count
    }
    return distance
  }

  // 1. Group by visual similarity
  const groups: string[][] = [] // Return array of arrays of IDs
  const processed = new Set<string>()

  for (let i = 0; i < photos.length; i++) {
    const p1 = photos[i]
    if (processed.has(p1.id)) continue

    const group = [p1]
    processed.add(p1.id)

    for (let j = i + 1; j < photos.length; j++) {
      const p2 = photos[j]
      if (processed.has(p2.id)) continue

      const dist = calculateHammingDistance(p1.phash, p2.phash)
      if (dist <= threshold) {
        group.push(p2)
        processed.add(p2.id)
      }
    }

    if (group.length > 1) {
      // Sort group by file size descending natively inside the worker
      group.sort((a, b) => b.fileSize - a.fileSize)
      // Only send back the IDs to save memory bandwidth over IPC
      groups.push(group.map(p => p.id))
    }
    
    // Optional: send progress updates if N > 5000
    if (i % 500 === 0) {
      parentPort.postMessage({ type: 'progress', data: Math.floor((i / photos.length) * 100) })
    }
  }

  parentPort.postMessage({ type: 'done', data: groups })
}
