import React, { useCallback, useEffect, useLayoutEffect, useState, useRef } from 'react'
import {
  Modal,
  Box,
  IconButton,
  Typography,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Slider,
  Button,
} from '@mui/material'
import {
  Close as CloseIcon,
  ArrowBack as PrevIcon,
  ArrowForward as NextIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Slideshow as SlideshowIcon,
  RotateLeft as RotateLeftIcon,
  RotateRight as RotateRightIcon,
  Star as StarIcon,
  StarOutline as StarOutlineIcon,
  DriveFileMove as MoveIcon,
  PhotoAlbum as AlbumIcon,
  Tune as TuneIcon,
  Refresh as ResetIcon,
  Check as SaveIcon,
  Check as CheckIcon,
} from '@mui/icons-material'
import { useLibraryStore } from '../../stores/libraryStore'
import { useUIStore } from '../../stores/uiStore'
import { useAlbumStore } from '../../stores/albumStore'
import { getImageUrl } from '../../utils/imageUrl'

export default function PhotoViewer() {
  const photos = useLibraryStore((s) => s.photos)
  const currentPhotoId = useLibraryStore((s) => s.currentPhotoId)
  const setCurrentPhoto = useLibraryStore((s) => s.setCurrentPhoto)
  const photoViewerOpen = useUIStore((s) => s.photoViewerOpen)
  const setPhotoViewerOpen = useUIStore((s) => s.setPhotoViewerOpen)
  const fetchPhotos = useLibraryStore((s) => s.fetchPhotos)
  const fetchAlbums = useAlbumStore((s) => s.fetchAlbums)
  const albums = useAlbumStore((s) => s.albums)
  const addPhotosToAlbum = useAlbumStore((s) => s.addPhotosToAlbum)

  const [moveMenuAnchor, setMoveMenuAnchor] = useState<null | HTMLElement>(null)

  const [zoom, setZoom] = useState(0)
  const [slideshow, setSlideshow] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  
  // Edit State
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [edits, setEdits] = useState({ brightness: 100, contrast: 100, saturation: 100 })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const MIN_ZOOM = 0.05
  const MAX_ZOOM = 10
  const BUTTON_FACTOR = 1.15 // 15% per click — smooth and gradual
  const clampZoom = (z: number) => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM)
  
  const filmstripRef = React.useRef<HTMLDivElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)
  // Panning/Scrolling state
  const isDragging = React.useRef(false)
  const startPos = React.useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })
  const isTrackpadRef = useRef(false)
  const isAutoScrolling = useRef(false)
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null)

  // Auto-center the image after zoom changes
  useEffect(() => {
    if (zoom === 0 || !containerRef.current) return
    // Use requestAnimationFrame to wait for the DOM to update with new image size
    requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      // Center the scroll position
      const scrollLeft = (container.scrollWidth - container.clientWidth) / 2
      const scrollTop = (container.scrollHeight - container.clientHeight) / 2
      container.scrollLeft = Math.max(0, scrollLeft)
      container.scrollTop = Math.max(0, scrollTop)
    })
  }, [zoom])

  const wasOpenRef = useRef(false)

  // Center active photo in filmstrip (Mathematical)
  useEffect(() => {
    if (photoViewerOpen && currentPhotoId && photos.length > 0) {
      if (isTrackpadRef.current) {
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
        scrollTimeout.current = setTimeout(() => {
          isTrackpadRef.current = false
        }, 300)
        return
      }

      const index = photos.findIndex((p) => p.id === currentPhotoId)
      if (index >= 0) {
        const scrollToTarget = () => {
          if (filmstripRef.current && !isTrackpadRef.current) {
            isAutoScrolling.current = true
            filmstripRef.current.scrollTo({
              left: index * 86, // 70px + 16px margins
              behavior: wasOpenRef.current ? 'smooth' : 'auto'
            })
            if (!wasOpenRef.current) wasOpenRef.current = true
            
            if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
            // Extra grace period for trackpad scroll lock
            scrollTimeout.current = setTimeout(() => {
              isAutoScrolling.current = false
            }, 800)
          }
        }
        
        requestAnimationFrame(scrollToTarget)
        // Ensure jump works across component mount layout states
        if (!wasOpenRef.current) {
          setTimeout(scrollToTarget, 50)
          setTimeout(scrollToTarget, 150)
          setTimeout(scrollToTarget, 400)
        }
      }
    } else if (!photoViewerOpen) {
      wasOpenRef.current = false
      isAutoScrolling.current = false
    }
  }, [currentPhotoId, photoViewerOpen, photos])

  const currentIndex = photos.findIndex((p) => p.id === currentPhotoId)
  const currentPhoto = currentIndex >= 0 ? photos[currentIndex] : null

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentPhoto(photos[currentIndex + 1].id)
      setZoom(0) // Reset to Fit
    }
  }, [currentIndex, photos, setCurrentPhoto])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentPhoto(photos[currentIndex - 1].id)
      setZoom(0) // Reset to Fit
    }
  }, [currentIndex, photos, setCurrentPhoto])

  const handleClose = useCallback(() => {
    setPhotoViewerOpen(false)
    setSlideshow(false)
    setZoom(0) // Reset to Fit
  }, [setPhotoViewerOpen])

  const handleRotate = async (direction: 'left' | 'right') => {
    if (!currentPhoto || !window.api?.rotatePhoto) return
    try {
      console.log(`[Renderer] Triggering rotation: ${direction} for ${currentPhoto.id}`)
      setIsRotating(true)
      await window.api.rotatePhoto(currentPhoto.id, direction)
      console.log(`[Renderer] Rotation successful, fetching photos...`)
      await fetchPhotos()
    } catch (err) {
      console.error('[Renderer] Failed to rotate:', err)
      alert((err as Error).message || 'Failed to rotate image')
    } finally {
      setIsRotating(false)
    }
  }

  const handleToggleEditPanel = () => {
    setShowEditPanel(!showEditPanel)
    // Reset on close
    if (showEditPanel) {
      setEdits({ brightness: 100, contrast: 100, saturation: 100 })
    }
  }

  const handleSaveEdits = async () => {
    if (!currentPhoto || !window.api?.applyEdits) return
    setIsSavingEdit(true)
    try {
      const result = await window.api.applyEdits(currentPhoto.id, edits)
      if (result.success) {
        setShowEditPanel(false)
        setEdits({ brightness: 100, contrast: 100, saturation: 100 })
        await fetchPhotos()
      } else {
        console.error('Failed to save edits:', result.message)
      }
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!currentPhoto || !window.api?.toggleFavorite) return
    try {
      await window.api.toggleFavorite(currentPhoto.id)
      await fetchPhotos()
      await fetchAlbums()
    } catch (err) {
      console.error('[Renderer] Failed to toggle favorite:', err)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    if (!photoViewerOpen) return

    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': goNext(); break
        case 'ArrowLeft': goPrev(); break
        case 'Escape': handleClose(); break
        case '+':
        case '=': setZoom((z) => z === 0 ? 0.25 : clampZoom(z * BUTTON_FACTOR)); break
        case '-': setZoom((z) => { if (z === 0) return 0; const next = z / BUTTON_FACTOR; return next < MIN_ZOOM ? 0 : next; }); break
        case ' ': e.preventDefault(); setSlideshow((s) => !s); break
        case 'i':
        case 'I': setShowInfo((s) => !s); break
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [photoViewerOpen, goNext, goPrev, handleClose])

  // Slideshow auto-advance
  useEffect(() => {
    if (!slideshow || !photoViewerOpen) return
    const timer = setInterval(goNext, 3000)
    return () => clearInterval(timer)
  }, [slideshow, photoViewerOpen, goNext])

  // Calculate the actual "fit" zoom level based on image and container dimensions
  const getFitZoom = useCallback(() => {
    const container = containerRef.current
    if (!container || !currentPhoto?.width || !currentPhoto?.height) return 0.1
    const containerW = container.clientWidth * 0.9  // matches maxWidth: 90vw
    const containerH = container.clientHeight * 0.75 // matches maxHeight: 75vh
    return Math.min(containerW / currentPhoto.width, containerH / currentPhoto.height)
  }, [currentPhoto])

  // Native gesture events for trackpad pinch-to-zoom (macOS)
  useEffect(() => {
    const container = containerRef.current
    if (!container || !photoViewerOpen) return

    let gestureBaseZoom = 0

    const onGestureStart = (e: any) => {
      e.preventDefault()
      gestureBaseZoom = zoom || getFitZoom()
    }

    const onGestureChange = (e: any) => {
      e.preventDefault()
      const fitZoom = getFitZoom()
      const newZoom = gestureBaseZoom * e.scale
      if (newZoom <= fitZoom) {
        setZoom(0) // Snap to Fit — don't go below
      } else {
        setZoom(clampZoom(newZoom))
      }
    }

    const onGestureEnd = (e: any) => {
      e.preventDefault()
    }

    container.addEventListener('gesturestart', onGestureStart, { passive: false })
    container.addEventListener('gesturechange', onGestureChange, { passive: false })
    container.addEventListener('gestureend', onGestureEnd, { passive: false })

    return () => {
      container.removeEventListener('gesturestart', onGestureStart)
      container.removeEventListener('gesturechange', onGestureChange)
      container.removeEventListener('gestureend', onGestureEnd)
    }
  }, [photoViewerOpen, zoom, getFitZoom])

  // Wheel zoom - handles both mouse wheel and trackpad scroll/pinch
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const sensitivity = e.ctrlKey ? 0.008 : 0.003
    const multiplier = 1 - e.deltaY * sensitivity
    const fitZoom = getFitZoom()
    
    setZoom((z) => {
      if (z === 0) {
        return multiplier > 1 ? Math.max(fitZoom * 1.1, 0.1) : 0
      }
      const next = z * multiplier
      if (next <= fitZoom) return 0 // Snap to Fit — never go below
      return clampZoom(next)
    })
  }, [getFitZoom])

  // Panning handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom === 0 || !containerRef.current) return
    isDragging.current = true
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop
    }
    containerRef.current.style.cursor = 'grabbing'
    e.preventDefault()
  }, [zoom])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    containerRef.current.scrollLeft = startPos.current.scrollLeft - dx
    containerRef.current.scrollTop = startPos.current.scrollTop - dy
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    if (containerRef.current) {
        containerRef.current.style.cursor = zoom !== 0 ? 'grab' : 'zoom-in'
    }
  }, [zoom])

  // Helper: smooth zoom in/out for buttons
  const smoothZoomIn = useCallback(() => {
    setZoom((z) => z === 0 ? 0.25 : clampZoom(z * BUTTON_FACTOR))
  }, [])

  const smoothZoomOut = useCallback(() => {
    setZoom((z) => {
      if (z === 0) return 0
      const next = z / BUTTON_FACTOR
      return next < MIN_ZOOM ? 0 : next
    })
  }, [])

  if (!currentPhoto) return null

  return (
    <Modal open={photoViewerOpen} onClose={handleClose}>
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          bgcolor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
        }}
      >
        {/* Top bar */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            zIndex: 10,
            background: 'linear-gradient(rgba(0,0,0,0.6), transparent)',
          }}
        >
          <Typography variant="body2" sx={{ color: '#fff' }}>
            {currentPhoto.fileName} — {currentIndex + 1} / {photos.length}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Rotate Left">
              <IconButton sx={{ color: '#fff' }} onClick={() => handleRotate('left')} disabled={isRotating}>
                <RotateLeftIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Rotate Right">
              <IconButton sx={{ color: '#fff' }} onClick={() => handleRotate('right')} disabled={isRotating}>
                <RotateRightIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title={currentPhoto.albumIds.includes('favorites-album') ? 'Remove from Favorites' : 'Add to Favorites'}>
              <IconButton 
                sx={{ color: currentPhoto.albumIds.includes('favorites-album') ? '#FFD600' : '#fff' }} 
                onClick={handleToggleFavorite}
              >
                {currentPhoto.albumIds.includes('favorites-album') ? <StarIcon /> : <StarOutlineIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Adjust Image">
              <IconButton 
                sx={{ color: showEditPanel ? '#42A5F5' : '#fff' }} 
                onClick={handleToggleEditPanel}
              >
                <TuneIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Move to Album">
              <IconButton sx={{ color: '#fff' }} onClick={(e) => setMoveMenuAnchor(e.currentTarget)}>
                <MoveIcon />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={moveMenuAnchor}
              open={Boolean(moveMenuAnchor)}
              onClose={() => setMoveMenuAnchor(null)}
              PaperProps={{ sx: { maxHeight: 320, minWidth: 200, bgcolor: 'rgba(30,30,30,0.95)', backdropFilter: 'blur(10px)' } }}
            >
              {albums.filter(a => a.id !== 'favorites-album').length === 0 ? (
                <MenuItem disabled>
                  <ListItemText sx={{ color: 'text.secondary' }}>No albums yet</ListItemText>
                </MenuItem>
              ) : (
                albums.filter(a => a.id !== 'favorites-album').map((album) => {
                  const isInAlbum = currentPhoto.albumIds.includes(album.id)
                  return (
                    <MenuItem
                      key={album.id}
                      onClick={async () => {
                        if (!isInAlbum) {
                          await addPhotosToAlbum(album.id, [currentPhoto.id])
                          await fetchPhotos()
                        }
                        setMoveMenuAnchor(null)
                      }}
                    >
                      <ListItemIcon>
                        {isInAlbum ? <CheckIcon fontSize="small" sx={{ color: '#4CAF50' }} /> : <AlbumIcon fontSize="small" sx={{ color: album.type === 'virtual' ? '#42A5F5' : '#FFA726' }} />}
                      </ListItemIcon>
                      <ListItemText>{album.name}</ListItemText>
                      {isInAlbum && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>Added</Typography>
                      )}
                    </MenuItem>
                  )
                })
              )}
            </Menu>

            <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.2)', mx: 1, alignSelf: 'center' }} />
            
            <Tooltip title="Zoom Out (-)">
              <IconButton sx={{ color: '#fff' }} onClick={smoothZoomOut}>
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={zoom === 0 ? 'Click for 100% (Native)' : 'Click for Fit'}>
              <Typography 
                onClick={() => setZoom(zoom === 0 ? 1 : 0)}
                sx={{ 
                  color: '#fff', 
                  alignSelf: 'center', 
                  minWidth: 50, 
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': { color: '#7C4DFF', textShadow: '0 0 8px rgba(124, 77, 255, 0.5)' },
                  transition: 'color 0.2s'
                }}
              >
                {zoom === 0 ? 'Fit' : `${Math.round(zoom * 100)}%`}
              </Typography>
            </Tooltip>
            <Tooltip title="Zoom In (+)">
              <IconButton sx={{ color: '#fff' }} onClick={smoothZoomIn}>
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={slideshow ? 'Stop Slideshow' : 'Start Slideshow (Space)'}>
              <IconButton sx={{ color: slideshow ? '#7C4DFF' : '#fff' }} onClick={() => setSlideshow((s) => !s)}>
                <SlideshowIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close (Esc)">
              <IconButton sx={{ color: '#fff' }} onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Navigation arrows */}
        {currentIndex > 0 && (
          <IconButton
            onClick={goPrev}
            sx={{
              position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
              color: '#fff', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              width: 48, height: 48,
            }}
          >
            <PrevIcon />
          </IconButton>
        )}
        {currentIndex < photos.length - 1 && (
          <IconButton
            onClick={goNext}
            sx={{
              position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
              color: '#fff', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              width: 48, height: 48,
            }}
          >
            <NextIcon />
          </IconButton>
        )}

        {/* Image Area */}
        <Box
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
          sx={{
            overflow: zoom !== 0 ? 'auto' : 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            cursor: zoom !== 0 ? 'grab' : 'zoom-in',
            userSelect: 'none',
            '&::-webkit-scrollbar': { width: 8, height: 8 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 4 },
          }}
        >
          {/* Preload adjacent images for 0-latency swiping */}
          <Box sx={{ display: 'none' }}>
            {currentIndex > 0 && <img src={getImageUrl(photos[currentIndex - 1])} />}
            {currentIndex > 1 && <img src={getImageUrl(photos[currentIndex - 2])} />}
            {currentIndex < photos.length - 1 && <img src={getImageUrl(photos[currentIndex + 1])} />}
            {currentIndex < photos.length - 2 && <img src={getImageUrl(photos[currentIndex + 2])} />}
          </Box>
          <img
            ref={imgRef}
            src={getImageUrl(currentPhoto)}
            alt={currentPhoto.fileName}
            draggable={false}
            decoding="async"
            style={{
              ...(zoom === 0 ? {
                maxWidth: '90vw',
                maxHeight: '75vh',
                width: 'auto',
                height: 'auto',
              } : {
                width: currentPhoto.width ? `${currentPhoto.width * zoom}px` : `${zoom * 100}vw`,
                minWidth: currentPhoto.width ? `${currentPhoto.width * zoom}px` : `${zoom * 100}vw`,
                height: 'auto',
              }),
              objectFit: 'contain',
              flexShrink: 0,
              transition: 'width 0.15s ease-out, filter 0.1s ease-out',
              filter: `
                ${isRotating ? 'blur(2px) grayscale(50%)' : ''}
                brightness(${edits.brightness}%)
                contrast(${edits.contrast}%)
                saturate(${edits.saturation}%)
              `.trim(),
              opacity: isRotating ? 0.7 : 1,
            }}
          />
          {isRotating && (
             <Box sx={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
               <Box className="loading-spinner" sx={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
               <Typography sx={{ color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Rotating...</Typography>
             </Box>
          )}
        </Box>

        {/* Info Overlay */}
        {showInfo && currentPhoto && (
          <Box
            sx={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(12px)',
              borderRadius: 2,
              p: 2.5,
              minWidth: 220,
              maxWidth: 260,
              zIndex: 15,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Typography variant="caption" sx={{ color: '#7C4DFF', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mb: 1.5, display: 'block' }}>Photo Info</Typography>
            {[
              { label: 'File', value: currentPhoto.fileName },
              { label: 'Resolution', value: currentPhoto.width && currentPhoto.height ? `${currentPhoto.width} × ${currentPhoto.height}` : '—' },
              { label: 'Camera', value: currentPhoto.camera || '—' },
              { label: 'Lens', value: currentPhoto.lens || '—' },
              { label: 'Exposure', value: currentPhoto.exposure || '—' },
              { label: 'ISO', value: currentPhoto.iso || '—' },
              { label: 'Date', value: currentPhoto.dateTaken ? new Date(currentPhoto.dateTaken).toLocaleDateString() : '—' },
              { label: 'Size', value: currentPhoto.fileSize ? `${(currentPhoto.fileSize / (1024 * 1024)).toFixed(1)} MB` : '—' },
              { label: 'Rating', value: currentPhoto.rating ? '★'.repeat(currentPhoto.rating) + '☆'.repeat(5 - currentPhoto.rating) : 'None' },
            ].map(({ label, value }) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{label}</Typography>
                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 500, maxWidth: 150, textAlign: 'right', wordBreak: 'break-all' }}>{value}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Edit Panel Overlay */}
        {showEditPanel && currentPhoto && !showInfo && (
          <Box
            sx={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(20, 20, 20, 0.85)',
              backdropFilter: 'blur(24px)',
              borderRadius: 3,
              p: 3,
              width: 280,
              zIndex: 15,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600, mb: 3 }}>Adjustments</Typography>
            
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Brightness</Typography>
                <Typography variant="caption" sx={{ color: '#fff' }}>{edits.brightness}%</Typography>
              </Box>
              <input
                type="range"
                min="0" max="200"
                value={edits.brightness}
                onChange={(e) => setEdits({ ...edits, brightness: Number(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Contrast</Typography>
                <Typography variant="caption" sx={{ color: '#fff' }}>{edits.contrast}%</Typography>
              </Box>
              <input
                type="range"
                min="0" max="200"
                value={edits.contrast}
                onChange={(e) => setEdits({ ...edits, contrast: Number(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </Box>

            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Saturation</Typography>
                <Typography variant="caption" sx={{ color: '#fff' }}>{edits.saturation}%</Typography>
              </Box>
              <input
                type="range"
                min="0" max="200"
                value={edits.saturation}
                onChange={(e) => setEdits({ ...edits, saturation: Number(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="outlined" 
                size="small" 
                fullWidth 
                startIcon={<ResetIcon />}
                onClick={() => setEdits({ brightness: 100, contrast: 100, saturation: 100 })}
                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: '#fff' } }}
              >
                Reset
              </Button>
              <Button 
                variant="contained" 
                color="primary" 
                size="small" 
                fullWidth 
                startIcon={isSavingEdit ? null : <SaveIcon />}
                onClick={handleSaveEdits}
                disabled={isSavingEdit}
                sx={{ borderRadius: 1.5 }}
              >
                {isSavingEdit ? 'Saving...' : 'Save'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Bottom Filmstrip */}
        <Box
          ref={filmstripRef}
          onScroll={(e) => {
            if (isAutoScrolling.current || !wasOpenRef.current) return
            
            const scrollLeft = e.currentTarget.scrollLeft
            if (scrollLeft === 0 && currentPhotoId !== photos[0]?.id) return
            
            const index = Math.round(scrollLeft / 86)
            if (index >= 0 && index < photos.length) {
              const newId = photos[index].id
              if (newId !== currentPhotoId) {
                isTrackpadRef.current = true
                setCurrentPhoto(newId)
              }
            }
          }}
          sx={{
            position: 'absolute',
            bottom: 0, 
            left: 0, 
            right: 0, 
            height: 90,
            display: 'flex',
            alignItems: 'center',
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingLeft: 'calc(50vw - 43px)',
            paddingRight: 'calc(50vw - 43px)',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
            zIndex: 10,
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {photos.map((p) => {
            const isSelected = p.id === currentPhotoId
            return (
              <Box
                key={p.id}
                data-photoid={p.id}
                onClick={() => setCurrentPhoto(p.id)}
                sx={{
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  width: 70, height: 70,
                  margin: '0 8px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, opacity 0.2s',
                  transform: isSelected ? 'scale(1.3)' : 'scale(1)',
                  opacity: isSelected ? 1 : 0.5,
                  border: isSelected ? '2px solid #7C4DFF' : '2px solid transparent',
                  zIndex: isSelected ? 2 : 1,
                  '&:hover': { opacity: isSelected ? 1 : 0.8 },
                }}
              >
                <img
                  src={getImageUrl(p, true)}
                  alt={p.fileName}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Box>
            )
          })}
        </Box>
      </Box>
    </Modal>
  )
}
