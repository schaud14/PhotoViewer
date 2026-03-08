import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { FixedSizeGrid as Grid } from 'react-window'
import { Box, Typography } from '@mui/material'
import { useLibraryStore } from '../../stores/libraryStore'
import { useUIStore, THUMBNAIL_SIZES } from '../../stores/uiStore'
import { getImageUrl } from '../../utils/imageUrl'
import BatchActionBar from './BatchActionBar'

interface PhotoGridProps {
  width: number
  height: number
}

// Separate component for the marquee visual to isolate re-renders
function SelectionMarquee({ selection, scrollOffset, gridPadding }: { selection: { startX: number; startY: number; currentX: number; currentY: number } | null, scrollOffset: { scrollLeft: number, scrollTop: number }, gridPadding: number }) {
  if (!selection) return null
  
  return (
    <Box
      sx={{
        position: 'absolute',
        border: '1px solid #7C4DFF',
        bgcolor: 'rgba(124, 77, 255, 0.2)',
        boxShadow: '0 0 5px rgba(0,0,0,0.2)',
        pointerEvents: 'none',
        zIndex: 1000,
        left: Math.min(selection.startX, selection.currentX) - scrollOffset.scrollLeft + gridPadding,
        top: Math.min(selection.startY, selection.currentY) - scrollOffset.scrollTop,
        width: Math.abs(selection.currentX - selection.startX),
        height: Math.abs(selection.currentY - selection.startY),
      }}
    />
  )
}

export default function PhotoGrid({ width, height }: PhotoGridProps) {
  const photos = useLibraryStore((s) => s.photos)
  const selectedPhotoIds = useLibraryStore((s) => s.selectedPhotoIds)
  const selectPhoto = useLibraryStore((s) => s.selectPhoto)
  const selectPhotos = useLibraryStore((s) => s.selectPhotos)
  const clearSelection = useLibraryStore((s) => s.clearSelection)
  const setCurrentPhoto = useLibraryStore((s) => s.setCurrentPhoto)
  const thumbnailSize = useUIStore((s) => s.thumbnailSize)
  const setPhotoViewerOpen = useUIStore((s) => s.setPhotoViewerOpen)
  const deletingIds = useLibraryStore((s) => s.deletingIds)

  const targetCellSize = THUMBNAIL_SIZES[thumbnailSize]
  const gap = 4 
  const availableWidth = width 

  // Justified Grid Logic:
  // Restore distinct column counts while keeping the 5-column preference for medium.
  const getPreferredColumnCount = () => {
    if (thumbnailSize === 'xl') return 3
    if (thumbnailSize === 'large') return 4
    if (thumbnailSize === 'medium') return 5
    return Math.max(7, Math.floor(availableWidth / 130))
  }

  const columnCount = getPreferredColumnCount()

  // Calculate the exact effectiveCellSize to perfectly fill 100% of availableWidth
  const effectiveCellSize = availableWidth / columnCount
  const rowCount = Math.ceil(photos.length / columnCount)
  const gridPadding = 0

  const currentPhotoId = useLibraryStore((s) => s.currentPhotoId)
  const photoViewerOpen = useUIStore((s) => s.photoViewerOpen)
  const fetchPhotos = useLibraryStore((s) => s.fetchPhotos)

  // Keyboard navigation in grid
  useEffect(() => {
    if (photoViewerOpen) return // Don't handle when viewer is open

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if input is focused
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (photos.length === 0) return

      const currentIndex = currentPhotoId ? photos.findIndex(p => p.id === currentPhotoId) : -1
      let nextIndex = currentIndex

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          nextIndex = Math.min(currentIndex + 1, photos.length - 1)
          break
        case 'ArrowLeft':
          e.preventDefault()
          nextIndex = Math.max(currentIndex - 1, 0)
          break
        case 'ArrowDown':
          e.preventDefault()
          nextIndex = Math.min(currentIndex + columnCount, photos.length - 1)
          break
        case 'ArrowUp':
          e.preventDefault()
          nextIndex = Math.max(currentIndex - columnCount, 0)
          break
        case 'Enter':
          if (currentIndex >= 0) {
            e.preventDefault()
            setPhotoViewerOpen(true)
          }
          return
        case ' ':
          if (currentIndex >= 0) {
            e.preventDefault()
            selectPhoto(photos[currentIndex].id, true)
          }
          return
        case 'Delete':
        case 'Backspace':
          if (currentIndex >= 0 && selectedPhotoIds.size > 0) {
            e.preventDefault()
            const idsToDelete = Array.from(selectedPhotoIds)
            // Trigger animation
            useLibraryStore.getState().addDeletingIds(idsToDelete)
            
            setTimeout(() => {
              Promise.all(idsToDelete.map(id => window.api?.deletePhoto(id))).then(() => {
                // Add to history store for Undo
                import('../../stores/historyStore').then(({ useHistoryStore }) => {
                  const { v4: uuidv4 } = require('uuid')
                  useHistoryStore.getState().push({
                    id: uuidv4(),
                    type: 'DELETE',
                    description: `Delete ${idsToDelete.length} photo${idsToDelete.length > 1 ? 's' : ''}`,
                    undo: async () => {
                      await Promise.all(idsToDelete.map(id => window.api?.restorePhoto(id)))
                      useLibraryStore.getState().fetchPhotos()
                    }
                  })
                })
                useLibraryStore.getState().removeDeletingIds(idsToDelete)
                clearSelection()
                fetchPhotos()
              })
            }, 300) // Match CSS transition duration
          }
          return
        case 'a':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            selectPhotos(photos.map(p => p.id), false)
          }
          return
        default:
          return
      }

      if (nextIndex !== currentIndex && nextIndex >= 0) {
        const photo = photos[nextIndex]
        if (e.shiftKey) {
          selectPhoto(photo.id, true)
        } else {
          selectPhoto(photo.id, false)
        }
        setCurrentPhoto(photo.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [photos, currentPhotoId, columnCount, photoViewerOpen, selectedPhotoIds, deletingIds, selectPhoto, selectPhotos, clearSelection, setCurrentPhoto, setPhotoViewerOpen, fetchPhotos])

  const handleDoubleClick = useCallback((id: string) => {
    setCurrentPhoto(id)
    setPhotoViewerOpen(true)
  }, [setCurrentPhoto, setPhotoViewerOpen])

  // Selection states
  const [selection, setSelection] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const lastSelectedId = useRef<string | null>(null)
  const initialSelectionOnDrag = useRef<Set<string>>(new Set())
  const currentIdsInBox = useRef<Set<string>>(new Set())
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null)
  const dragDistance = useRef(0)
  const scrollOffset = useRef({ scrollLeft: 0, scrollTop: 0 })
  const gridContainerRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(({ scrollLeft, scrollTop }: { scrollLeft: number; scrollTop: number }) => {
    scrollOffset.current = { scrollLeft, scrollTop }
  }, [])

  const handleClick = useCallback((id: string, e: React.MouseEvent) => {
    if (dragDistance.current > 5) return
    const isMulti = e.metaKey || e.ctrlKey
    const isRange = e.shiftKey
    if (isRange && lastSelectedId.current) {
      const fromIndex = photos.findIndex(p => p.id === lastSelectedId.current)
      const toIndex = photos.findIndex(p => p.id === id)
      if (fromIndex !== -1 && toIndex !== -1) {
        const start = Math.min(fromIndex, toIndex)
        const end = Math.max(fromIndex, toIndex)
        const rangeIds = photos.slice(start, end + 1).map(p => p.id)
        selectPhotos(rangeIds, isMulti)
      }
    } else if (isMulti) {
      // Cmd/Ctrl click: toggle this photo in the selection
      selectPhoto(id, true)
    } else if (selectedPhotoIds.size > 1) {
      // Multiple selected: plain click opens viewer without clearing selection
      setCurrentPhoto(id)
      setPhotoViewerOpen(true)
    } else {
      // 0 or 1 selected: normal behavior — select this photo and open viewer
      selectPhoto(id, false)
      setCurrentPhoto(id)
      setPhotoViewerOpen(true)
    }
    lastSelectedId.current = id
  }, [photos, selectPhoto, selectPhotos, setCurrentPhoto, setPhotoViewerOpen, selectedPhotoIds])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const isItem = (e.target as HTMLElement).closest('.photo-grid-item')
    const isModifier = e.metaKey || e.ctrlKey || e.shiftKey
    if (!isItem || isModifier) {
      const rect = e.currentTarget.getBoundingClientRect()
      // Use absolute coordinates relative to the direct container
      const x = e.clientX - rect.left + scrollOffset.current.scrollLeft
      const y = e.clientY - rect.top + scrollOffset.current.scrollTop
      mouseDownPos.current = { x: e.clientX, y: e.clientY }
      dragDistance.current = 0
      setSelection({ startX: x, startY: y, currentX: x, currentY: y })
      initialSelectionOnDrag.current = isModifier ? new Set(selectedPhotoIds) : new Set()
      currentIdsInBox.current = new Set()
      if (!isModifier) clearSelection()
      e.preventDefault()
    }
  }, [clearSelection, selectedPhotoIds])

  useEffect(() => {
    if (!selection) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!gridContainerRef.current) return
      const rect = gridContainerRef.current.getBoundingClientRect()
      const x = e.clientX - (mouseDownPos.current?.x || e.clientX)
      const y = e.clientY - (mouseDownPos.current?.y || e.clientY)
      dragDistance.current = Math.sqrt(x * x + y * y)

      const newSelection = { 
        ...selection, 
        currentX: e.clientX - rect.left + scrollOffset.current.scrollLeft, 
        currentY: e.clientY - rect.top + scrollOffset.current.scrollTop 
      }
      
      // Use requestAnimationFrame for marquee visual positioning
      requestAnimationFrame(() => {
        setSelection(newSelection)
      })

      // Hot path: Direct DOM manipulation for selection preview
      const minX = Math.min(newSelection.startX, newSelection.currentX)
      const maxX = Math.max(newSelection.startX, newSelection.currentX)
      const minY = Math.min(newSelection.startY, newSelection.currentY)
      const maxY = Math.max(newSelection.startY, newSelection.currentY)

      const minCol = Math.floor(minX / effectiveCellSize)
      const maxCol = Math.ceil(maxX / effectiveCellSize)
      const minRow = Math.floor(minY / effectiveCellSize)
      const maxRow = Math.ceil(maxY / effectiveCellSize)

      const idsInBox = new Set<string>()
      for (let r = Math.max(0, minRow); r < Math.min(rowCount, maxRow); r++) {
        for (let c = Math.max(0, minCol); c < Math.min(columnCount, maxCol); c++) {
          const index = r * columnCount + c
          if (index >= 0 && index < photos.length) idsInBox.add(photos[index].id)
        }
      }

      // Track changes to apply DOM updates
      const prevIds = currentIdsInBox.current
      currentIdsInBox.current = idsInBox

      // Remove class from items no longer in box
      prevIds.forEach(id => {
        if (!idsInBox.has(id)) {
          const el = gridContainerRef.current?.querySelector(`[data-photo-id="${id}"]`)
          if (el) el.classList.remove('marquee-selecting')
        }
      })

      // Add class to items now in box
      idsInBox.forEach(id => {
        const el = gridContainerRef.current?.querySelector(`[data-photo-id="${id}"]`)
        if (el) el.classList.add('marquee-selecting')
      })
    }

    const handleMouseUp = () => {
      // Commit final selection to store ONLY ONCE at the end
      if (selection) {
        const finalSelection = new Set(initialSelectionOnDrag.current)
        currentIdsInBox.current.forEach(id => finalSelection.add(id))
        useLibraryStore.setState({ selectedPhotoIds: finalSelection })
      }

      // Cleanup DOM classes
      gridContainerRef.current?.querySelectorAll('.marquee-selecting').forEach(el => {
        el.classList.remove('marquee-selecting')
      })

      setSelection(null)
      mouseDownPos.current = null
      initialSelectionOnDrag.current = new Set()
      currentIdsInBox.current = new Set()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [selection, effectiveCellSize, columnCount, rowCount, photos])

  const Cell = useMemo(() => {
    return ({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
      const index = rowIndex * columnCount + columnIndex
      if (index >= photos.length) return null
      const photo = photos[index]
      const isSelected = selectedPhotoIds.has(photo.id)
      const isDeleting = deletingIds.has(photo.id)
      const imgSrc = getImageUrl(photo, true)
      return (
        <div style={{ ...style, left: Number(style.left) + gap / 2, top: Number(style.top) + gap / 2, width: Number(style.width) - gap, height: Number(style.height) - gap }}>
          <Box
            className={`photo-grid-item fade-in ${isSelected ? 'photo-selected' : ''} ${isDeleting ? 'photo-deleting' : ''}`}
            data-photo-id={photo.id}
            onClick={(e) => handleClick(photo.id, e)}
            onDoubleClick={() => handleDoubleClick(photo.id)}
            draggable={!selection}
            onDragStart={(e) => {
              const idsToDrag = selectedPhotoIds.has(photo.id) ? Array.from(selectedPhotoIds) : [photo.id]
              e.dataTransfer.setData('application/json', JSON.stringify(idsToDrag))
              e.dataTransfer.effectAllowed = 'copy'
            }}
            sx={{ width: '100%', height: '100%', borderRadius: 1, overflow: 'hidden', position: 'relative', bgcolor: 'background.paper' }}
          >
            <img src={imgSrc} alt={photo.fileName} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            {/* iOS-style selection checkmark */}
            <Box
              className="selection-circle"
              onClick={(e) => {
                e.stopPropagation()
                handleClick(photo.id, { ...e, metaKey: true } as any)
              }}
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.7)',
                bgcolor: isSelected ? '#2196F3' : 'rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: isSelected ? 1 : 0,
                transition: 'opacity 0.15s, transform 0.15s',
                transform: isSelected ? 'scale(1)' : 'scale(0.8)',
                '.photo-grid-item:hover &': { opacity: 1, transform: 'scale(1)' },
                '&:hover': { transform: 'scale(1.15)' },
                zIndex: 2,
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }}
            >
              {isSelected && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white" />
                </svg>
              )}
            </Box>
            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 0.5, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', opacity: 0, transition: 'opacity 0.2s', '.photo-grid-item:hover &': { opacity: 1 } }}>
              <Typography variant="caption" noWrap sx={{ color: '#fff', fontSize: '0.7rem' }}>{photo.fileName}</Typography>
            </Box>
          </Box>
        </div>
      )
    }
  }, [photos, columnCount, selectedPhotoIds, deletingIds, gap, gridPadding, handleClick, handleDoubleClick])

  if (photos.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6" color="text.secondary">No photos found</Typography>
        <Typography variant="body2" color="text.secondary">Add a source folder and scan to get started</Typography>
      </Box>
    )
  }

  return (
    <Box 
      ref={gridContainerRef}
      onMouseDown={handleMouseDown}
      sx={{ width, height, position: 'relative', userSelect: selection ? 'none' : 'auto' }}
    >
      <Grid
        columnCount={columnCount}
        columnWidth={effectiveCellSize}
        height={height}
        rowCount={rowCount}
        rowHeight={effectiveCellSize}
        width={width}
        onScroll={handleScroll}
      >
        {Cell}
      </Grid>
      <SelectionMarquee selection={selection} scrollOffset={scrollOffset.current} gridPadding={gridPadding} />
      <BatchActionBar />
    </Box>
  )
}
