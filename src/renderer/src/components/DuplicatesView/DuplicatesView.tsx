import React, { useEffect, useState } from 'react'
import { Box, Typography, Button, IconButton, Tooltip, Divider } from '@mui/material'
import { Delete as DeleteIcon, AutoFixHigh as AutoFixIcon } from '@mui/icons-material'
import type { Photo } from '../../../../shared/types'
import { useLibraryStore } from '../../stores/libraryStore'
import { getImageUrl } from '../../utils/imageUrl'

export default function DuplicatesView() {
  const [duplicateGroups, setDuplicateGroups] = useState<Photo[][]>([])
  const [loading, setLoading] = useState(true)
  const fetchPhotos = useLibraryStore((s) => s.fetchPhotos)

  const loadDuplicates = async () => {
    setLoading(true)
    console.log('[DuplicatesView] Fetching duplicates...')
    try {
      if (window.api?.getDuplicates) {
        // The API returns { groups: Photo[][], exactDuplicates: Map }
        const result = await window.api.getDuplicates() as any
        console.log('[DuplicatesView] Received result:', result)
        
        const groups = result.groups || result // Fallback if it's already an array
        
        if (Array.isArray(groups)) {
          console.log(`[DuplicatesView] Found ${groups.length} groups`)
          setDuplicateGroups(groups)
        } else {
          console.warn('[DuplicatesView] Unexpected result format:', result)
          setDuplicateGroups([])
        }
      }
    } catch (err) {
      console.error('[DuplicatesView] Failed to load duplicates:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDuplicates()
  }, [])

  const handleDelete = async (id: string) => {
    if (!window.api?.deletePhoto) return
    await window.api.deletePhoto(id)
    await loadDuplicates()
    fetchPhotos()
  }

  const handleSmartClean = async () => {
    if (!window.api?.deletePhoto) return
    let deleted = 0
    for (const group of duplicateGroups) {
      // Keep the first one (highest quality as sorted by backend), delete the rest
      for (let i = 1; i < group.length; i++) {
        await window.api.deletePhoto(group[i].id)
        deleted++
      }
    }
    if (deleted > 0) {
      await loadDuplicates()
      fetchPhotos()
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary">Analyzing visual similarity...</Typography>
      </Box>
    )
  }

  if (duplicateGroups.length === 0) {
    return (
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography variant="h6" gutterBottom>No Duplicates Found</Typography>
        <Typography color="text.secondary">Your library is clean! No visually similar photos were detected.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 4, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>Duplicate Finder</Typography>
          <Typography variant="body2" color="text.secondary">
            Found {duplicateGroups.length} groups of visually similar photos.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AutoFixIcon />}
          onClick={handleSmartClean}
          sx={{ borderRadius: 2 }}
        >
          Smart Clean (Keep Best)
        </Button>
      </Box>

      {duplicateGroups.map((group, index) => {
        if (!group || !Array.isArray(group)) {
          console.error(`[DuplicatesView] Group at index ${index} is invalid:`, group)
          return null
        }
        
        return (
          <Box key={index} sx={{ mb: 4, bgcolor: 'background.paper', borderRadius: 2, p: 2, boxShadow: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
              Group {index + 1} — {group.length} Photos
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
              {group.map((photo, pIdx) => {
                if (!photo) return null
                
                return (
                  <Box key={photo.id} sx={{ position: 'relative', width: 200, flexShrink: 0 }}>
                    <img
                      src={getImageUrl(photo)}
                      alt={photo.fileName || 'Unknown'}
                      style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: '8px' }}
                      onError={(e) => {
                        console.error(`[DuplicatesView] Failed to load image: ${photo.absolutePath}`)
                        e.currentTarget.src = 'https://via.placeholder.com/200x140?text=Error'
                      }}
                    />
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" noWrap display="block" title={photo.fileName}>{photo.fileName || 'Unknown'}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {photo.fileSize ? (photo.fileSize / (1024 * 1024)).toFixed(1) : '0'} MB • {photo.width || '?'}x{photo.height || '?'}
                      </Typography>
                      {pIdx === 0 && (
                        <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>Best Quality</Typography>
                      )}
                    </Box>
                    <Tooltip title="Move to Trash">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(photo.id)}
                        sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'error.main' } }}
                      >
                        <DeleteIcon fontSize="small" sx={{ color: '#fff' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )
              })}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
