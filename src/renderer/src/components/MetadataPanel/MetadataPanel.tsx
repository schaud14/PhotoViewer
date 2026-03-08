import React, { useEffect, useState } from 'react'
import {
  Drawer,
  Box,
  Typography,
  Divider,
  Chip,
  Autocomplete,
  TextField,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material'
import {
  ExpandMore,
  Delete as DeleteIcon,
  RestoreFromTrash as RestoreIcon,
  Edit as EditIcon,
  Star as StarIcon,
  StarOutline as StarOutlineIcon,
} from '@mui/icons-material'
import { useLibraryStore } from '../../stores/libraryStore'
import { useUIStore } from '../../stores/uiStore'
import { useAlbumStore } from '../../stores/albumStore'
import type { Photo } from '../../../../shared/types'
import RenameDialog from '../Dialogs/RenameDialog'
import { getImageUrl } from '../../utils/imageUrl'

const METADATA_PANEL_WIDTH = 320

export default function MetadataPanel() {
  const metadataPanelOpen = useUIStore((s) => s.metadataPanelOpen)
  const currentPhotoId = useLibraryStore((s) => s.currentPhotoId)
  const photos = useLibraryStore((s) => s.photos)
  const fetchPhotos = useLibraryStore((s) => s.fetchPhotos)
  const albums = useAlbumStore((s) => s.albums)
  const sidebarSection = useUIStore((s) => s.sidebarSection)

  const [photo, setPhoto] = useState<Photo | null>(null)
  const [allTags, setAllTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)

  const currentPhoto = photos.find((p) => p.id === currentPhotoId) || null

  useEffect(() => {
    if (currentPhoto) {
      setPhoto(currentPhoto)
    }
  }, [currentPhoto])

  useEffect(() => {
    if (window.api?.getAllTags) {
      window.api.getAllTags().then(setAllTags).catch(console.error)
    }
  }, [currentPhotoId])

  const handleAddTag = async (tag: string) => {
    if (!photo || !tag.trim()) return
    await window.api.addTags(photo.id, [tag.trim()])
    setTagInput('')
    fetchPhotos()
    window.api.getAllTags().then(setAllTags)
  }

  const handleRemoveTag = async (tag: string) => {
    if (!photo) return
    await window.api.removeTags(photo.id, [tag])
    fetchPhotos()
  }

  const handleDelete = async () => {
    if (!photo) return
    const activeAlbum = albums.find((a) => a.id === useAlbumStore.getState().activeAlbumId)
    await window.api.deletePhoto(photo.id, activeAlbum ? { albumId: activeAlbum.id, albumType: activeAlbum.type } : undefined)
    fetchPhotos()
  }

  const handleRestore = async () => {
    if (!photo) return
    const result = await window.api.restorePhoto(photo.id)
    if (result.success) {
      fetchPhotos()
    } else {
      console.error('Restore failed:', result.message)
    }
  }

  const handleRename = async (newName: string) => {
    if (!photo || !window.api?.renamePhoto) return
    try {
      await window.api.renamePhoto(photo.id, newName)
      setRenameOpen(false)
      fetchPhotos()
      window.api.getMetadata(photo.id).then(setPhoto)
    } catch (err) {
      console.error('Failed to rename:', err)
    }
  }

  const handleToggleFavorite = async () => {
    if (!photo || !window.api?.toggleFavorite) return
    try {
      await window.api.toggleFavorite(photo.id)
      fetchPhotos()
      useAlbumStore.getState().fetchAlbums()
    } catch (err) {
      console.error('[Renderer] Failed to toggle favorite:', err)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString()
  }

  return (
    <Drawer
      variant="persistent"
      anchor="right"
      open={metadataPanelOpen}
      sx={{
        width: metadataPanelOpen ? METADATA_PANEL_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: METADATA_PANEL_WIDTH,
          boxSizing: 'border-box',
          top: '64px',
          height: 'calc(100% - 64px)',
          borderLeft: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {!photo ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Select a photo to see its metadata
          </Typography>
        </Box>
      ) : (
        <Box sx={{ overflow: 'auto', p: 2 }}>
          {/* Preview */}
          <Box sx={{ mb: 2, borderRadius: 1, overflow: 'hidden' }}>
            <img
              src={photo ? getImageUrl(photo, true) : ''}
              alt={photo?.fileName}
              style={{ width: '100%', height: 180, objectFit: 'cover' }}
            />
          </Box>

          {/* File Name */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="subtitle1" noWrap title={photo.fileName}>
              {photo.fileName}
            </Typography>
            <Box sx={{ display: 'flex' }}>
              <Tooltip title={photo.albumIds.includes('favorites-album') ? 'Remove from Favorites' : 'Add to Favorites'}>
                <IconButton size="small" onClick={handleToggleFavorite} sx={{ mr: 0.5 }}>
                  {photo.albumIds.includes('favorites-album') ? (
                    <StarIcon fontSize="small" sx={{ color: '#FFD600' }} />
                  ) : (
                    <StarOutlineIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setRenameOpen(true)} sx={{ mt: -0.5 }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all', display: 'block', mb: 1 }}>
            {photo.absolutePath}
          </Typography>

          {/* Star Rating */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1, minWidth: 40 }}>Rating</Typography>
            {[1, 2, 3, 4, 5].map((star) => (
              <IconButton
                key={star}
                size="small"
                onClick={async () => {
                  const newRating = photo.rating === star ? 0 : star
                  await window.api?.setRating(photo.id, newRating)
                  fetchPhotos()
                  window.api?.getMetadata(photo.id).then(setPhoto)
                }}
                sx={{ p: 0.25 }}
              >
                {star <= (photo.rating || 0) ? (
                  <StarIcon sx={{ fontSize: 20, color: '#FFD600' }} />
                ) : (
                  <StarOutlineIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
                )}
              </IconButton>
            ))}
          </Box>

          {/* Color Labels */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1, minWidth: 40 }}>Label</Typography>
            {[
              { color: '#EF5350', name: 'red' },
              { color: '#FFA726', name: 'orange' },
              { color: '#FFEE58', name: 'yellow' },
              { color: '#66BB6A', name: 'green' },
              { color: '#42A5F5', name: 'blue' },
              { color: '#AB47BC', name: 'purple' },
              { color: '#BDBDBD', name: 'gray' },
            ].map(({ color, name }) => (
              <Tooltip key={name} title={name.charAt(0).toUpperCase() + name.slice(1)}>
                <Box
                  onClick={async () => {
                    const newLabel = photo.colorLabel === name ? null : name
                    await window.api?.setColorLabel(photo.id, newLabel)
                    fetchPhotos()
                    window.api?.getMetadata(photo.id).then(setPhoto)
                  }}
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    bgcolor: color,
                    cursor: 'pointer',
                    border: photo.colorLabel === name ? '2px solid #fff' : '2px solid transparent',
                    boxShadow: photo.colorLabel === name ? `0 0 0 1px ${color}` : 'none',
                    transition: 'all 0.15s',
                    '&:hover': { transform: 'scale(1.2)' },
                  }}
                />
              </Tooltip>
            ))}
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* File Info */}
          <List dense disablePadding>
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemText primary="Size" secondary={formatSize(photo.fileSize)} />
            </ListItem>
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemText primary="Created" secondary={formatDate(photo.createdAt)} />
            </ListItem>
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemText primary="Modified" secondary={formatDate(photo.modifiedAt)} />
            </ListItem>
            {photo.width && photo.height && (
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemText primary="Dimensions" secondary={`${photo.width} × ${photo.height}`} />
              </ListItem>
            )}
          </List>

          <Divider sx={{ my: 2 }} />

          {/* EXIF Data */}
          <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 0 }}>
              <Typography variant="subtitle2">EXIF Data</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0 }}>
              <List dense disablePadding>
                {photo.dateTaken && (
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemText primary="Date Taken" secondary={formatDate(photo.dateTaken)} />
                  </ListItem>
                )}
                {photo.camera && (
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemText primary="Camera" secondary={photo.camera} />
                  </ListItem>
                )}
                {photo.lens && (
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemText primary="Lens" secondary={photo.lens} />
                  </ListItem>
                )}
                {photo.exposure && (
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemText primary="Exposure" secondary={photo.exposure} />
                  </ListItem>
                )}
                {photo.iso && (
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemText primary="ISO" secondary={photo.iso} />
                  </ListItem>
                )}
              </List>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          {/* Tags */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Tags</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {photo.tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onDelete={() => handleRemoveTag(tag)}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
          <Autocomplete
            freeSolo
            options={allTags.filter((t) => !photo.tags.includes(t))}
            value={tagInput}
            onInputChange={(_, val) => setTagInput(val)}
            onChange={(_, val) => {
              if (val) handleAddTag(val)
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Add tag..."
                size="small"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault()
                    handleAddTag(tagInput)
                  }
                }}
              />
            )}
            size="small"
          />

          <Divider sx={{ my: 2 }} />

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {photo.trashed ? (
              <>
                <Button
                  startIcon={<RestoreIcon />}
                  variant="outlined"
                  color="success"
                  size="small"
                  fullWidth
                  onClick={handleRestore}
                >
                  Restore
                </Button>
                <Button
                  startIcon={<DeleteIcon />}
                  variant="outlined"
                  color="error"
                  size="small"
                  fullWidth
                  onClick={async () => {
                    await window.api.permanentlyDelete(photo.id)
                    fetchPhotos()
                  }}
                >
                  Permanent Delete
                </Button>
              </>
            ) : (
              <Button
                startIcon={<DeleteIcon />}
                variant="outlined"
                color="error"
                size="small"
                fullWidth
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
          </Box>
        </Box>
      )}

      {photo && (
        <RenameDialog
          open={renameOpen}
          onClose={() => setRenameOpen(false)}
          onConfirm={handleRename}
          currentName={photo.fileName}
        />
      )}
    </Drawer>
  )
}

export { METADATA_PANEL_WIDTH }
