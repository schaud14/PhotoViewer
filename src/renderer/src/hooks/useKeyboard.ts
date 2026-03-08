import { useEffect, useCallback } from 'react'
import { useLibraryStore } from '../stores/libraryStore'
import { useUIStore } from '../stores/uiStore'

/**
 * Global keyboard shortcuts for the app.
 * Active when the photo viewer is NOT open (viewer has its own key handling).
 */
export function useKeyboardShortcuts() {
  const photos = useLibraryStore((s) => s.photos)
  const currentPhotoId = useLibraryStore((s) => s.currentPhotoId)
  const selectPhoto = useLibraryStore((s) => s.selectPhoto)
  const setCurrentPhoto = useLibraryStore((s) => s.setCurrentPhoto)
  const clearSelection = useLibraryStore((s) => s.clearSelection)
  const fetchPhotos = useLibraryStore((s) => s.fetchPhotos)
  const photoViewerOpen = useUIStore((s) => s.photoViewerOpen)
  const setPhotoViewerOpen = useUIStore((s) => s.setPhotoViewerOpen)
  const toggleMetadataPanel = useUIStore((s) => s.toggleMetadataPanel)
  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)

  const currentIndex = photos.findIndex((p) => p.id === currentPhotoId)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't capture keys when typing in an input
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    // Don't handle when photo viewer is open (it has its own handlers)
    if (photoViewerOpen) return

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        e.preventDefault()
        if (currentIndex < photos.length - 1) {
          const nextPhoto = photos[currentIndex + 1]
          selectPhoto(nextPhoto.id, false)
        } else if (photos.length > 0 && currentIndex === -1) {
          selectPhoto(photos[0].id, false)
        }
        break
      }

      case 'ArrowLeft':
      case 'ArrowUp': {
        e.preventDefault()
        if (currentIndex > 0) {
          const prevPhoto = photos[currentIndex - 1]
          selectPhoto(prevPhoto.id, false)
        }
        break
      }

      case 'Enter':
      case ' ': {
        e.preventDefault()
        if (currentPhotoId) {
          setPhotoViewerOpen(true)
        }
        break
      }

      case 'Escape': {
        clearSelection()
        break
      }

      case 'Delete':
      case 'Backspace': {
        if (currentPhotoId && !e.metaKey) {
          e.preventDefault()
          window.api?.deletePhoto(currentPhotoId).then(() => fetchPhotos())
        }
        break
      }

      case 'a': {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          // Select all photos
          photos.forEach((p) => selectPhoto(p.id, true))
        }
        break
      }

      case 'i': {
        if (!e.metaKey && !e.ctrlKey) {
          toggleMetadataPanel()
        }
        break
      }

      case 'g': {
        if (!e.metaKey && !e.ctrlKey) {
          setViewMode('grid')
        }
        break
      }

      case 'l': {
        if (!e.metaKey && !e.ctrlKey) {
          setViewMode('list')
        }
        break
      }
    }
  }, [photos, currentIndex, currentPhotoId, photoViewerOpen, selectPhoto, setCurrentPhoto,
      clearSelection, setPhotoViewerOpen, toggleMetadataPanel, viewMode, setViewMode, fetchPhotos])


  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
