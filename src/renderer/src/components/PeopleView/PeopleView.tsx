import React, { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Avatar,
  TextField,
  IconButton,
  CircularProgress
} from '@mui/material'
import { 
  Edit as EditIcon, 
  Check as CheckIcon, 
  Close as CloseIcon, 
  Refresh as ScanIcon,
  DeleteSweep as ResetIcon
} from '@mui/icons-material'
import { Button } from '@mui/material'
import type { Person } from '../../../../shared/types'
import { useLibraryStore } from '../../stores/libraryStore'

interface PeopleViewProps {
  onPersonClick: (personId: string) => void
}

export default function PeopleView({ onPersonClick }: PeopleViewProps) {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})

  const isScanning = useLibraryStore(state => state.isScanning)
  const scanProgress = useLibraryStore(state => state.scanProgress)
  const startScan = useLibraryStore(state => state.startScan)

  // Load people from DB
  const loadPeople = useCallback(async () => {
    try {
      if (window.api?.getPeople) {
        setLoading(true)
        const data = await window.api.getPeople()
        
        // Sort by face count descending, then by name
        const sortedData = data.sort((a, b) => {
          if (b.faceCount !== a.faceCount) return (b.faceCount || 0) - (a.faceCount || 0)
          return (a.name || 'Unknown').localeCompare(b.name || 'Unknown')
        })
        
        setPeople(sortedData)

        // Load cover photo thumbnails asynchronously
        if (window.api.getThumbnail) {
          const newThumbnails: Record<string, string> = {}
          for (const person of sortedData) {
            if (person.coverPhotoId) {
              try {
                const thumbPath = await window.api.getThumbnail(person.coverPhotoId)
                if (thumbPath) {
                  // Prepend file:// to the absolute path for correct local rendering
                  newThumbnails[person.id] = `file://${thumbPath}`
                }
              } catch (e) {
                console.error('Failed to load cover thumb for', person.id, e)
              }
            }
          }
          setThumbnails(newThumbnails)
        }
      }
    } catch (err) {
      console.error('Failed to load people', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPeople()
  }, [loadPeople])

  // Listen for library updates (e.g., after scan finishes)
  useEffect(() => {
    if (window.api?.onLibraryUpdated) {
      console.log('[PeopleView] Subscribing to library updates')
      const unsubscribe = window.api.onLibraryUpdated(() => {
        console.log('[PeopleView] Library updated, re-loading people...')
        loadPeople()
      })
      return unsubscribe
    }
  }, [loadPeople])

  const handleRenameSubmit = async (personId: string) => {
    if (!editName.trim()) {
      setEditingId(null)
      return
    }

    try {
      if (window.api?.renamePerson) {
        await window.api.renamePerson(personId, editName.trim())
        // Optimistically update the UI
        setPeople(prev => prev.map(p => p.id === personId ? { ...p, name: editName.trim() } : p))
      }
    } catch (err) {
      console.error('Failed to rename person', err)
    } finally {
      setEditingId(null)
    }
  }

  const handleReset = async () => {
    console.log('[PeopleView] Reset button clicked')
    if (!window.confirm('This will clear all person names and groups and start a completely fresh face scan. This cannot be undone. Are you sure?')) {
      console.log('[PeopleView] Reset cancelled by user')
      return
    }

    try {
      setLoading(true)
      console.log('[PeopleView] Calling api.resetFaces()...')
      
      if (window.api?.resetFaces) {
        await window.api.resetFaces()
        console.log('[PeopleView] resetFaces() completed. Clearing local state...')
        
        // Reset local state
        setPeople([])
        setThumbnails({})
        
        // Start a new scan
        console.log('[PeopleView] Starting new scan via libraryStore...')
        await useLibraryStore.getState().startScan()
        console.log('[PeopleView] startScan() triggered')
      } else {
        console.error('[PeopleView] api.resetFaces is NOT defined!')
        alert('Internal error: Reset function not available in this version of the app.')
      }
    } catch (err) {
      console.error('[PeopleView] Failed to reset faces:', err)
      alert('Failed to reset faces. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  const handleRenameCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
  }

  const startRename = (e: React.MouseEvent, person: Person) => {
    e.stopPropagation()
    setEditingId(person.id)
    setEditName(person.name || `Unknown Person (${person.faceCount})`)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Scanning clusters...</Typography>
      </Box>
    )
  }

  if (people.length === 0) {
    return (
      <Box sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          No People Found
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 400, mb: 3 }}>
          {isScanning ? 'The AI engine is currently scanning your library for faces. This may take a moment depending on your library size.' : 'Enable Face Detection in Settings and ensure photos contain clear human faces to begin automatic clustering.'}
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<ScanIcon />} 
          onClick={startScan}
          disabled={isScanning}
          sx={{ borderRadius: 2 }}
        >
          {isScanning ? 'Scanning...' : 'Scan for Faces'}
        </Button>
      </Box>
    )
  }



  return (
    <Box sx={{ p: 4, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            People ({people.length})
          </Typography>
          {isScanning && scanProgress && (
            <Typography variant="caption" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <CircularProgress size={12} color="inherit" />
              {scanProgress.status === 'scanning' ? `Scanning faces... ${scanProgress.processed}/${scanProgress.total}` : 'Processing library...'}
            </Typography>
          )}
        </Box>
        <Button 
          variant="outlined" 
          color="error"
          startIcon={<ResetIcon />}
          onClick={handleReset}
          size="small"
          disabled={isScanning}
          sx={{ borderRadius: 2 }}
        >
          Reset and Rescan
        </Button>
      </Box>
      
      {isScanning && scanProgress?.status === 'scanning' && (
        <Box sx={{ width: '100%', mb: 3 }}>
          <Box sx={{ height: 4, width: '100%', bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}>
            <Box 
              sx={{ 
                height: '100%', 
                bgcolor: 'primary.main', 
                width: `${(scanProgress.processed / (scanProgress.total || 1)) * 100}%`,
                transition: 'width 0.3s ease'
              }} 
            />
          </Box>
        </Box>
      )}
      
      <Grid container spacing={3} mt={2}>
        {people.map((person) => {
          const isEditing = editingId === person.id
          const displayName = person.name || `Unknown (${person.faceCount})`
          const coverImage = thumbnails[person.id]

          return (
            <Grid item xs={6} sm={4} md={3} lg={2} key={person.id}>
              <Card 
                elevation={2} 
                sx={{ 
                  borderRadius: 3, 
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  overflow: 'hidden'
                }}
              >
                <CardActionArea 
                  disabled={isEditing}
                  onClick={() => onPersonClick(person.id)}
                  sx={{ display: 'flex', flexDirection: 'column', pt: 3, flexGrow: 1 }}
                >
                  <Avatar 
                    src={coverImage} 
                    sx={{ width: 120, height: 120, mb: 1, boxShadow: 2 }}
                  />
                  
                  <CardContent sx={{ width: '100%', p: 2, textAlign: 'center' }}>
                    {!isEditing && (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                          <Typography variant="body1" noWrap sx={{ fontWeight: 500, flexGrow: 1 }} title={displayName}>
                            {displayName}
                          </Typography>
                          <IconButton 
                            size="small" 
                            sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                            onClick={(e) => startRename(e, person)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {person.faceCount} {person.faceCount === 1 ? 'photo' : 'photos'}
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </CardActionArea>

                {isEditing && (
                  <Box sx={{ p: 2, pt: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextField
                      autoFocus
                      fullWidth
                      size="small"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameSubmit(person.id)
                        } else if (e.key === 'Escape') {
                          setEditingId(null)
                        }
                      }}
                      sx={{ '& .MuiInputBase-root': { fontSize: '0.85rem' } }}
                    />
                    <IconButton size="small" color="primary" onClick={() => handleRenameSubmit(person.id)}>
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setEditingId(null)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
