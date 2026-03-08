import { app } from 'electron'
import { join, basename, extname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import sharp from 'sharp'
import { createHash } from 'crypto'

const THUMBNAIL_WIDTH = 1080 // High resolution to support Large grid without pixelation
const THUMBNAIL_FORMAT = 'webp' as const
const THUMBNAIL_VERSION = 'v2' // Force re-generation for all photos

let thumbnailDir: string

function ensureThumbnailDir(): string {
  if (!thumbnailDir) {
    thumbnailDir = join(app.getPath('userData'), '.cache', 'thumbnails')
    mkdirSync(thumbnailDir, { recursive: true })
  }
  return thumbnailDir
}

/**
 * Generate a hash-based filename for the thumbnail to avoid collisions.
 * Include modifiedAt to force refresh when the file changes.
 */
function getThumbnailFileName(absolutePath: string, modifiedAt?: string): string {
  const seed = `${absolutePath}:${modifiedAt || ''}:${THUMBNAIL_VERSION}`
  const hash = createHash('md5').update(seed).digest('hex')
  const ext = `.${THUMBNAIL_FORMAT}`
  return `${hash}${ext}`
}

/**
 * Generate a thumbnail for the given image file.
 * Returns the path to the generated thumbnail, or null on failure.
 */
export async function generateThumbnail(absolutePath: string, modifiedAt?: string): Promise<string | null> {
  try {
    const dir = ensureThumbnailDir()
    const thumbFileName = getThumbnailFileName(absolutePath, modifiedAt)
    const thumbPath = join(dir, thumbFileName)

    // Skip if thumbnail already exists
    if (existsSync(thumbPath)) {
      return thumbPath
    }

    const ext = extname(absolutePath).toLowerCase()

    // RAW files - try sharp first (it handles some RAW formats via libvips)
    const rawExtensions = new Set(['.dng', '.nef', '.nrw', '.arw'])
    const isRaw = rawExtensions.has(ext)

    if (isRaw) {
      // For RAW files, try sharp which sometimes handles embedded previews
      try {
        await sharp(absolutePath, { failOnError: false })
          .resize(THUMBNAIL_WIDTH, null, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(thumbPath)

        return thumbPath
      } catch {
        console.warn(`[Thumbnails] sharp couldn't process RAW file: ${absolutePath}`)
        return null
      }
    }

    // Standard image formats
    await sharp(absolutePath, { failOnError: false })
      .resize(THUMBNAIL_WIDTH, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbPath)

    return thumbPath
  } catch (err) {
    console.error(`[Thumbnails] Failed to generate thumbnail for ${absolutePath}:`, err)
    return null
  }
}

/**
 * Generate thumbnails for a batch of files.
 * Returns a map of absolutePath -> thumbnailPath.
 */
export async function generateThumbnailBatch(
  filePaths: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  const total = filePaths.length

  // Process in batches of 5 to avoid overwhelming the system
  const batchSize = 5

  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize)
    const thumbnails = await Promise.allSettled(
      batch.map((fp) => generateThumbnail(fp))
    )

    thumbnails.forEach((result: any, idx: number) => {
      if (result.status === 'fulfilled' && result.value) {
        results.set(batch[idx], result.value)
      }
    })

    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total)
    }
  }

  return results
}
