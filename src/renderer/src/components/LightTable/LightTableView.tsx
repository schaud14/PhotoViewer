import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import type { LightTable, LightTablePhoto } from '../../../../shared/types'
import { getImageUrl } from '../../utils/imageUrl'

interface LightTableViewProps {
  tableId: string
}

export default function LightTableView({ tableId }: LightTableViewProps) {
  const [table, setTable] = useState<LightTable | null>(null)
  const [photos, setPhotos] = useState<LightTablePhoto[]>([])
  
  // Viewport transformations
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  
  // Interaction states
  const [isPanning, setIsPanning] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    if (!window.api?.getLightTable) return
    const data = await window.api.getLightTable(tableId)
    if (data) {
      setTable(data.table)
      setPhotos(data.photos)
    }
  }, [tableId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // --- Wheel / Trackpad logic ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      e.preventDefault()
      const zoomFactor = 1.05
      let newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor
      newScale = Math.min(Math.max(newScale, 0.1), 5) // Clamp zoom
      
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      
      // Zoom around mouse pointer
      const pointerX = e.clientX - rect.left
      const pointerY = e.clientY - rect.top
      
      const newPanX = pointerX - (pointerX - pan.x) * (newScale / scale)
      const newPanY = pointerY - (pointerY - pan.y) * (newScale / scale)

      setScale(newScale)
      setPan({ x: newPanX, y: newPanY })
      
    } else {
      // Pan
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
    }
  }, [scale, pan])

  // --- Background Panning Drag ---
  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return // Left or Middle
    if ((e.target as HTMLElement).closest('.light-table-photo')) return
    setIsPanning(true)
  }

  // --- Photo Dragging ---
  const handlePhotoMouseDown = (e: React.MouseEvent, ltp: LightTablePhoto) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault() // prevent native drag
    setDraggingId(ltp.photoId)
    
    // Offset is distance from pointer to top-left of photo
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Calculate raw canvas coords of pointer
    const canvasPointerX = (e.clientX - (containerRef.current?.getBoundingClientRect().left || 0) - pan.x) / scale
    const canvasPointerY = (e.clientY - (containerRef.current?.getBoundingClientRect().top || 0) - pan.y) / scale
    
    setDragOffset({
      x: canvasPointerX - ltp.x,
      y: canvasPointerY - ltp.y
    })
  }

  // --- Global Mouse Move & Up ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }))
      } else if (draggingId) {
        // Find canvas pointer coords
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        const canvasPointerX = (e.clientX - rect.left - pan.x) / scale
        const canvasPointerY = (e.clientY - rect.top - pan.y) / scale
        
        const newX = canvasPointerX - dragOffset.x
        const newY = canvasPointerY - dragOffset.y

        setPhotos(prev => prev.map(p => p.photoId === draggingId ? { ...p, x: newX, y: newY } : p))
      }
    }

    const handleMouseUp = async () => {
      if (isPanning) setIsPanning(false)
      if (draggingId) {
        // Save to DB
        const movedPhoto = photos.find(p => p.photoId === draggingId)
        if (movedPhoto && window.api?.updateLightTablePhoto) {
          await window.api.updateLightTablePhoto(tableId, draggingId, { x: movedPhoto.x, y: movedPhoto.y })
        }
        setDraggingId(null)
      }
    }

    if (isPanning || draggingId) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isPanning, draggingId, pan, scale, dragOffset, photos, tableId])

  if (!table) return <Box sx={{ p: 4 }}><Typography>Loading...</Typography></Box>

  return (
    <Box 
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleBackgroundMouseDown}
      sx={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden', 
        bgcolor: '#1e1e1e', 
        position: 'relative',
        cursor: isPanning ? 'grabbing' : (draggingId ? 'grabbing' : 'grab'),
        backgroundSize: `${40 * scale}px ${40 * scale}px`,
        backgroundImage: `
          linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
        `,
        backgroundPosition: `${pan.x}px ${pan.y}px`
      }}
    >
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10, bgcolor: 'rgba(0,0,0,0.5)', px: 2, py: 1, borderRadius: 1 }}>
        <Typography variant="h6" color="white">{table.name}</Typography>
        <Typography variant="caption" color="gray">Scroll to Pan • Cmd/Ctrl+Scroll to Zoom</Typography>
      </Box>

      {/* Infinite Canvas Transform Space */}
      <Box 
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          width: 0,
          height: 0
        }}
      >
        {photos.map(p => (
          <Box
            key={p.photoId}
            className="light-table-photo"
            onMouseDown={(e) => handlePhotoMouseDown(e, p)}
            sx={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.width,
              height: p.height,
              zIndex: draggingId === p.photoId ? 999 : p.zIndex,
              bgcolor: 'background.paper',
              boxShadow: draggingId === p.photoId ? '0 10px 30px rgba(0,0,0,0.8)' : '0 2px 10px rgba(0,0,0,0.5)',
              transition: draggingId === p.photoId ? 'none' : 'box-shadow 0.2s',
              cursor: 'grab',
              userSelect: 'none',
              borderRadius: 1,
              overflow: 'hidden'
            }}
          >
            {p.photo && (
              <img 
                src={getImageUrl(p.photo, false)} 
                alt={p.photo.fileName} 
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} 
              />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
