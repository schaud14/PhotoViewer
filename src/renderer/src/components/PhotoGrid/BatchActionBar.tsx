import React, { useState } from 'react'
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Chip,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
  Label as TagIcon,
  Star as FavoriteIcon,
  PhotoAlbum as AlbumIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  GetApp as ExportIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material'
import { useLibraryStore } from '../../stores/libraryStore'
import { useAlbumStore } from '../../stores/albumStore'

export default function BatchActionBar() {
  const selectedPhotoIds = useLibraryStore((s) => s.selectedPhotoIds)
  const photos = useLibraryStore((s) => s.photos)
  const clearSelection = useLibraryStore((s) => s.clearSelection)
  const fetchPhotos = useLibraryStore((s) => s.fetchPhotos)
  const lightTables = useLibraryStore((s) => s.lightTables)
  const albums = useAlbumStore((s) => s.albums)
  const addPhotosToAlbum = useAlbumStore((s) => s.addPhotosToAlbum)
  const fetchAlbums = useAlbumStore((s) => s.fetchAlbums)

  const [moveMenuAnchor, setMoveMenuAnchor] = useState<null | HTMLElement>(null)
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [lightTableMenuAnchor, setLightTableMenuAnchor] = useState<null | HTMLElement>(null)

  const count = selectedPhotoIds.size
  if (count < 2) return null

  const selectedIds = Array.from(selectedPhotoIds)

  const handleBatchDelete = async () => {
    if (!window.api?.deletePhoto) return
    const idsToDelete = [...selectedIds]
    for (const id of idsToDelete) {
      await window.api.deletePhoto(id)
    }
    
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

    clearSelection()
    await fetchPhotos()
  }

  const handleBatchFavorite = async () => {
    if (!window.api?.toggleFavorite) return
    for (const id of selectedIds) {
      await window.api.toggleFavorite(id)
    }
    await fetchPhotos()
    await fetchAlbums()
  }

  const handleBatchTag = async () => {
    if (!tagInput.trim() || !window.api?.addTags) return
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
    for (const id of selectedIds) {
      await window.api.addTags(id, tags)
    }
    setTagInput('')
    setShowTagInput(false)
    await fetchPhotos()
  }

  const handleMoveToAlbum = async (albumId: string) => {
    await addPhotosToAlbum(albumId, selectedIds)
    await fetchPhotos()
    setMoveMenuAnchor(null)
  }

  const handleSendToLightTable = async (tableId: string) => {
    if (!window.api?.addPhotosToLightTable) return
    await window.api.addPhotosToLightTable(tableId, selectedIds)
    setLightTableMenuAnchor(null)
    clearSelection()
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'rgba(20, 20, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        borderRadius: 3,
        px: 2,
        py: 1,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
      }}
    >
      <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, mr: 1, whiteSpace: 'nowrap' }}>
        {count} selected
      </Typography>

      <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.15)' }} />

      {/* Move to Album */}
      <Tooltip title="Move to Album">
        <IconButton sx={{ color: '#42A5F5' }} onClick={(e) => setMoveMenuAnchor(e.currentTarget)}>
          <MoveIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={moveMenuAnchor}
        open={Boolean(moveMenuAnchor)}
        onClose={() => setMoveMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{ sx: { maxHeight: 280, minWidth: 180, bgcolor: 'rgba(30,30,30,0.95)', backdropFilter: 'blur(12px)' } }}
      >
        {albums.filter(a => a.id !== 'favorites-album').map((album) => (
          <MenuItem key={album.id} onClick={() => handleMoveToAlbum(album.id)}>
            <ListItemIcon>
              <AlbumIcon fontSize="small" sx={{ color: album.type === 'virtual' ? '#42A5F5' : '#FFA726' }} />
            </ListItemIcon>
            <ListItemText>{album.name}</ListItemText>
          </MenuItem>
        ))}
        {albums.filter(a => a.id !== 'favorites-album').length === 0 && (
          <MenuItem disabled><ListItemText>No albums</ListItemText></MenuItem>
        )}
      </Menu>

      {/* Send to Light Table */}
      <Tooltip title="Send to Light Table">
        <IconButton sx={{ color: '#AB47BC' }} onClick={(e) => setLightTableMenuAnchor(e.currentTarget)}>
          <DashboardIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={lightTableMenuAnchor}
        open={Boolean(lightTableMenuAnchor)}
        onClose={() => setLightTableMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{ sx: { maxHeight: 280, minWidth: 180, bgcolor: 'rgba(30,30,30,0.95)', backdropFilter: 'blur(12px)' } }}
      >
        {lightTables.map((lt) => (
          <MenuItem key={lt.id} onClick={() => handleSendToLightTable(lt.id)}>
            <ListItemIcon>
              <DashboardIcon fontSize="small" sx={{ color: '#AB47BC' }} />
            </ListItemIcon>
            <ListItemText>{lt.name}</ListItemText>
          </MenuItem>
        ))}
        {lightTables.length === 0 && (
          <MenuItem disabled><ListItemText>No light tables created</ListItemText></MenuItem>
        )}
      </Menu>

      {/* Favorite */}
      <Tooltip title="Toggle Favorite">
        <IconButton sx={{ color: '#FFD600' }} onClick={handleBatchFavorite}>
          <FavoriteIcon />
        </IconButton>
      </Tooltip>

      {/* Tag */}
      <Tooltip title="Add Tags">
        <IconButton sx={{ color: '#66BB6A' }} onClick={() => setShowTagInput(!showTagInput)}>
          <TagIcon />
        </IconButton>
      </Tooltip>

      {showTagInput && (
        <TextField
          size="small"
          placeholder="tag1, tag2..."
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleBatchTag() }}
          autoFocus
          sx={{
            '& .MuiInputBase-root': { color: '#fff', fontSize: '0.85rem', height: 32 },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
            width: 140,
          }}
        />
      )}

      {/* Export */}
      <Tooltip title="Export Photos">
        <IconButton sx={{ color: '#CE93D8' }} onClick={async () => {
          if (!window.api?.exportPhotos) return
          await window.api.exportPhotos({ photoIds: selectedIds, format: 'original' })
        }}>
          <ExportIcon />
        </IconButton>
      </Tooltip>

      <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.15)' }} />

      {/* Delete */}
      <Tooltip title="Delete Selected">
        <IconButton sx={{ color: '#EF5350' }} onClick={handleBatchDelete}>
          <DeleteIcon />
        </IconButton>
      </Tooltip>

      {/* Close */}
      <Tooltip title="Clear Selection">
        <IconButton sx={{ color: 'rgba(255,255,255,0.5)' }} onClick={clearSelection} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
