import exifr from 'exifr'
import { promises as fs } from 'fs'
import { extname } from 'path'

export interface PhotoMetadata {
  dateTaken?: string
  camera?: string
  lens?: string
  exposure?: string
  iso?: string
  width?: number
  height?: number
  gpsLatitude?: number
  gpsLongitude?: number
}

/**
 * Extract EXIF metadata from an image file using exifr.
 * Returns structured metadata or empty object on failure.
 */
export async function extractMetadata(absolutePath: string): Promise<PhotoMetadata> {
  try {
    const ext = extname(absolutePath).toLowerCase()

    // exifr options — parse relevant tags
    const data = await exifr.parse(absolutePath, {
      tiff: true,
      exif: true,
      gps: true,
      translateValues: true,
      reviveValues: true,
      mergeOutput: true,
    })

    if (!data) return {}

    const metadata: PhotoMetadata = {}

    // Date taken
    if (data.DateTimeOriginal) {
      metadata.dateTaken = data.DateTimeOriginal instanceof Date
        ? data.DateTimeOriginal.toISOString()
        : String(data.DateTimeOriginal)
    } else if (data.CreateDate) {
      metadata.dateTaken = data.CreateDate instanceof Date
        ? data.CreateDate.toISOString()
        : String(data.CreateDate)
    }

    // Camera
    const make = data.Make || ''
    const model = data.Model || ''
    if (make || model) {
      // Avoid duplicating make in model (e.g. "Nikon" + "Nikon D850" → "Nikon D850")
      if (model.toLowerCase().startsWith(make.toLowerCase())) {
        metadata.camera = model
      } else {
        metadata.camera = `${make} ${model}`.trim()
      }
    }

    // Lens
    if (data.LensModel) {
      metadata.lens = data.LensModel
    } else if (data.LensMake) {
      metadata.lens = data.LensMake
    }

    // Exposure
    const parts: string[] = []
    if (data.ExposureTime) {
      if (data.ExposureTime < 1) {
        parts.push(`1/${Math.round(1 / data.ExposureTime)}s`)
      } else {
        parts.push(`${data.ExposureTime}s`)
      }
    }
    if (data.FNumber) {
      parts.push(`f/${data.FNumber}`)
    }
    if (data.FocalLength) {
      parts.push(`${Math.round(data.FocalLength)}mm`)
    }
    if (parts.length > 0) {
      metadata.exposure = parts.join('  ')
    }

    // ISO
    if (data.ISO) {
      metadata.iso = String(data.ISO)
    }

    // Dimensions
    if (data.ImageWidth && data.ImageHeight) {
      metadata.width = data.ImageWidth
      metadata.height = data.ImageHeight
    } else if (data.ExifImageWidth && data.ExifImageHeight) {
      metadata.width = data.ExifImageWidth
      metadata.height = data.ExifImageHeight
    }

    // GPS
    if (data.latitude && data.longitude) {
      metadata.gpsLatitude = data.latitude
      metadata.gpsLongitude = data.longitude
    }

    return metadata
  } catch (err) {
    // Many files don't have EXIF data — this is expected
    return {}
  }
}
