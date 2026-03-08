import { promises as fs } from 'fs'
import { extname } from 'path'
import heicConvert from 'heic-convert'

export const isHeic = (filePath: string) => {
  const ext = extname(filePath).toLowerCase()
  return ext === '.heic' || ext === '.heif'
}

/**
 * Converts a HEIC/HEIF file to JPEG format and saves it to disk.
 * Returns the destination path on success.
 */
export async function convertHeicToJpeg(sourcePath: string, destPath: string): Promise<string> {
  try {
    const inputBuffer = await fs.readFile(sourcePath)
    
    // convert HEIC to JPEG buffer
    const outputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.9, 
    })
    
    // Ensure the destination ends with .jpg
    const finalDestPath = destPath.replace(/\.(heic|heif)$/i, '.jpg')
    
    await fs.writeFile(finalDestPath, outputBuffer as Uint8Array)
    return finalDestPath
  } catch (error) {
    console.error(`[HEIC Converter] Failed to convert ${sourcePath} to JPEG:`, error)
    throw error
  }
}
