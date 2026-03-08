import type { Photo } from '../../../shared/types'

/**
 * Generates a file:// URL for a photo or its thumbnail, 
 * appending a cache-busting timestamp based on the modifiedAt property.
 */
export function getImageUrl(photo: Photo, useThumbnail = false): string {
  const path = useThumbnail && photo.thumbnailPath 
    ? photo.thumbnailPath 
    : photo.absolutePath
    
  // Convert ISO string to numeric timestamp for cleaner URL
  const timestamp = photo.modifiedAt ? new Date(photo.modifiedAt).getTime() : Date.now()
  
  return `file://${path}?t=${timestamp}`
}
