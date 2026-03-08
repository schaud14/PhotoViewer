import sharp from 'sharp'

/**
 * Generates an 8x8 Average Hash (aHash) for an image.
 * 1. Resizes image to 8x8 (ignoring aspect ratio)
 * 2. Converts to grayscale
 * 3. Calculates average pixel value
 * 4. Compares each pixel to average, yielding a 64-bit binary string
 * 5. Returns string of 64 '0's and '1's
 */
export async function generatePHash(imagePath: string): Promise<string | null> {
  try {
    const { data } = await sharp(imagePath)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    if (data.length !== 64) {
      throw new Error('Invalid buffer size for 8x8 grayscale image')
    }

    // Calculate average
    let sum = 0
    for (let i = 0; i < 64; i++) {
      sum += data[i]
    }
    const avg = sum / 64

    // Generate 64-bit binary string
    let hashStr = ''
    for (let i = 0; i < 64; i++) {
      hashStr += data[i] >= avg ? '1' : '0'
    }

    // Convert binary string to Hex for shorter storage (16 chars)
    let hexHash = ''
    for (let i = 0; i < 64; i += 4) {
      const nibble = hashStr.slice(i, i + 4)
      hexHash += parseInt(nibble, 2).toString(16)
    }

    return hexHash
  } catch (err) {
    console.error(`[pHash] Error generating hash for ${imagePath}:`, err)
    return null
  }
}

/**
 * Calculates the Hamming distance between two hex hashes.
 * Returns the number of differing bits (0 to 64).
 * A distance <= 5 usually indicates visually similar images.
 */
export function calculateHammingDistance(hex1: string, hex2: string): number {
  if (!hex1 || !hex2 || hex1.length !== 16 || hex2.length !== 16) return 64

  let distance = 0
  for (let i = 0; i < 16; i++) {
    const n1 = parseInt(hex1[i], 16)
    const n2 = parseInt(hex2[i], 16)
    const xor = n1 ^ n2
    // Count set bits (Brian Kernighan's algorithm)
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
