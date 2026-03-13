import React, { useEffect } from 'react'
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Divider,
  Box,
  Typography,
  Badge,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material'
import {
  PhotoLibrary as AllPhotosIcon,
  Folder as FolderIcon,
  FolderSpecial as FolderSpecialIcon,
  PhotoAlbum as VirtualAlbumIcon,
  CreateNewFolder as PhysicalAlbumIcon,
  Delete as TrashIcon,
  ExpandMore,
  ExpandLess,
  Star as FavoritesIcon,
  FilterFrames as DuplicatesIcon,
  Add as AddIcon, // Added for Light Tables
  Dashboard, // Added for Light Tables
  People as PeopleIcon, // Added for Faces
} from '@mui/icons-material'
import { useUIStore } from '../../stores/uiStore'
import { useAlbumStore } from '../../stores/albumStore'
import { useLibraryStore } from '../../stores/libraryStore'
import type { SourceFolder, Album, LightTable } from '../../../../shared/types'

const SIDEBAR_WIDTH = 260

interface SidebarProps {
  sourceFolders: SourceFolder[]
  onRemoveFolder: (id: string) => void
}

export default function Sidebar({ sourceFolders, onRemoveFolder }: SidebarProps) { // Kept original props, will use store for folders
  const sidebarSection = useUIStore((s) => s.sidebarSection)
  const setSidebarSection = useUIStore((s) => s.setSidebarSection)
  const albums = useAlbumStore((s) => s.albums)
  const activeAlbumId = useAlbumStore((s) => s.activeAlbumId)
  const setActiveAlbum = useAlbumStore((s) => s.setActiveAlbum)
  const fetchAlbums = useAlbumStore((s) => s.fetchAlbums)
  const setFilters = useLibraryStore((s) => s.setFilters)
  const fetchPhotos = useLibraryStore((s) => s.fetchPhotos)
  const folders = useLibraryStore((state) => state.folders) // Added from diff
  const lightTables = useLibraryStore((state) => state.lightTables) // Added from diff
  const fetchLightTables = useLibraryStore((state) => state.fetchLightTables) // Added from diff

  const [foldersOpen, setFoldersOpen] = React.useState(true)
  const [albumsOpen, setAlbumsOpen] = React.useState(true)
  const [deleteId, setDeleteId] = React.useState<string | null>(null) // Added for delete confirmation
  const [deleteType, setDeleteType] = React.useState<'folder' | 'album' | 'lightTable' | null>(null) // Added for delete confirmation

  useEffect(() => {
    fetchAlbums()
    fetchLightTables() // Added from diff
  }, [])

  const virtualAlbums = albums.filter((a) => a.type === 'virtual' && a.id !== 'favorites-album')
  const physicalAlbums = albums.filter((a) => a.type === 'physical')
  const favoritesAlbum = albums.find((a) => a.id === 'favorites-album')

  const handleAllPhotos = () => {
    setSidebarSection('all')
    setActiveAlbum(null)
    setFilters({ albumId: undefined, trashed: false, sourceFolderPath: undefined })
  }

  const handleTrash = () => {
    setSidebarSection('trash')
    setActiveAlbum(null)
    setFilters({ trashed: true, albumId: undefined, sourceFolderPath: undefined })
  }

  const handleAlbumClick = (album: Album) => {
    setSidebarSection('album')
    setActiveAlbum(album.id)
    setFilters({ albumId: album.id, trashed: false, sourceFolderPath: undefined })
  }

  const handleFolderClick = (folder: SourceFolder) => {
    setSidebarSection('folders')
    setActiveAlbum(null)
    setFilters({ sourceFolderPath: folder.path, trashed: false, albumId: undefined })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    e.currentTarget.classList.add('drag-over')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over')
  }

  const handleDropToAlbum = async (e: React.DragEvent, albumId: string) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')
    try {
      const data = e.dataTransfer.getData('application/json')
      if (data && window.api?.addPhotosToAlbum) {
        const photoIds = JSON.parse(data)
        if (Array.isArray(photoIds) && photoIds.length > 0) {
          await window.api.addPhotosToAlbum(albumId, photoIds)
          fetchAlbums()
          if (useAlbumStore.getState().activeAlbumId === albumId) {
            fetchPhotos()
          }
        }
      }
    } catch (err) {
      console.error('Drop to album failed', err)
    }
  }

  // Added from diff
  const handleDeleteConfirm = async () => {
    if (!deleteId || !deleteType) return

    try {
      if (deleteType === 'folder' && window.api?.removeSourceFolder) {
        onRemoveFolder(deleteId)
      } else if (deleteType === 'album' && window.api?.deleteAlbum) {
        await window.api.deleteAlbum(deleteId)
        fetchAlbums()
        if (activeAlbumId === deleteId) {
          setActiveAlbum(null)
          setSidebarSection('all')
          setFilters({ albumId: undefined, sourceFolderPath: undefined, trashed: false })
        }
      } else if (deleteType === 'lightTable' && window.api?.deleteLightTable) {
        await window.api.deleteLightTable(deleteId)
        fetchLightTables()
        if (sidebarSection === `lightTable-${deleteId}`) {
          setSidebarSection('all')
          setFilters({ albumId: undefined, sourceFolderPath: undefined, trashed: false })
        }
      }
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleteId(null)
      setDeleteType(null)
    }
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
          top: '64px',
          height: 'calc(100% - 64px)',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', py: 1 }}>
        {/* All Photos */}
        <List disablePadding>
          <ListItemButton
            selected={sidebarSection === 'all'}
            onClick={handleAllPhotos}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <AllPhotosIcon color={sidebarSection === 'all' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="All Photos" />
          </ListItemButton>

          {/* Duplicates */}
          <ListItemButton
            selected={sidebarSection === 'duplicates'}
            onClick={() => {
              setSidebarSection('duplicates')
              setFilters({})
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <DuplicatesIcon color={sidebarSection === 'duplicates' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="Duplicates" />
          </ListItemButton>

          {/* People / Faces */}
          <ListItemButton
            selected={sidebarSection === 'people'}
            onClick={() => {
              setSidebarSection('people')
              setFilters({})
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <PeopleIcon color={sidebarSection === 'people' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="People" />
          </ListItemButton>

          {/* Favorites - Priority Virtual Album */}
          <ListItemButton
            selected={activeAlbumId === 'favorites-album'}
            onClick={() => favoritesAlbum && handleAlbumClick(favoritesAlbum)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDropToAlbum(e, 'favorites-album')}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <FavoritesIcon color={activeAlbumId === 'favorites-album' ? 'warning' : 'inherit'} />
            </ListItemIcon>
            <ListItemText 
              primary="Favorites" 
              secondary={favoritesAlbum ? `${favoritesAlbum.photoCount || 0} photos` : ''}
              secondaryTypographyProps={{ fontSize: '0.7rem' }}
            />
          </ListItemButton>
        </List>

        <Divider sx={{ my: 1 }} />

        {/* Source Folders */}
        <List disablePadding>
          <ListItemButton onClick={() => setFoldersOpen(!foldersOpen)}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText primary="Source Folders" />
            {foldersOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={foldersOpen} timeout="auto">
            <List disablePadding>
              {sourceFolders.map((folder) => (
                <ListItemButton
                  key={folder.id}
                  sx={{
                    pl: 4,
                    '& .remove-btn': { opacity: 0 },
                    '&:hover .remove-btn': { opacity: 1 },
                  }}
                  selected={sidebarSection === 'folders'}
                  onClick={() => handleFolderClick(folder)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <FolderSpecialIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={folder.path.split('/').pop() || folder.path}
                    primaryTypographyProps={{ fontSize: '0.875rem', noWrap: true }}
                  />
                  <Tooltip title="Remove folder">
                    <IconButton
                      className="remove-btn"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFolder(folder.id)
                      }}
                      sx={{ p: 0.5, transition: 'opacity 0.2s' }}
                    >
                      <TrashIcon fontSize="small" sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>
              ))}
            </List>
          </Collapse>
        </List>

        <Divider sx={{ my: 1 }} />

        {/* Albums */}
        <List disablePadding>
          <ListItemButton onClick={() => setAlbumsOpen(!albumsOpen)}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <VirtualAlbumIcon />
            </ListItemIcon>
            <ListItemText primary="Albums" />
            {albumsOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={albumsOpen} timeout="auto">
            <List disablePadding>
              {virtualAlbums.length > 0 && (
                <ListSubheader sx={{ bgcolor: 'transparent', lineHeight: '28px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Virtual
                </ListSubheader>
              )}
              {virtualAlbums.map((album) => (
                <ListItemButton
                  key={album.id}
                  sx={{ 
                    pl: 4,
                    '&.drag-over': { bgcolor: 'action.hover' }
                  }}
                  selected={activeAlbumId === album.id}
                  onClick={() => handleAlbumClick(album)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropToAlbum(e, album.id)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <VirtualAlbumIcon fontSize="small" color="info" />
                  </ListItemIcon>
                  <ListItemText
                    primary={album.name}
                    secondary={`${album.photoCount || 0} photos`}
                    primaryTypographyProps={{ fontSize: '0.875rem', noWrap: true }}
                    secondaryTypographyProps={{ fontSize: '0.7rem' }}
                  />
                </ListItemButton>
              ))}

              {physicalAlbums.length > 0 && (
                <ListSubheader sx={{ bgcolor: 'transparent', lineHeight: '28px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Physical
                </ListSubheader>
              )}
              {physicalAlbums.map((album) => (
                <ListItemButton
                  key={album.id}
                  sx={{ 
                    pl: 4,
                    '&.drag-over': { bgcolor: 'action.hover' }
                  }}
                  selected={activeAlbumId === album.id}
                  onClick={() => handleAlbumClick(album)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropToAlbum(e, album.id)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <PhysicalAlbumIcon fontSize="small" color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={album.name}
                    secondary={`${album.photoCount || 0} photos`}
                    primaryTypographyProps={{ fontSize: '0.875rem', noWrap: true }}
                    secondaryTypographyProps={{ fontSize: '0.7rem' }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Collapse>
        </List>

        <Divider sx={{ my: 1 }} />

        {/* Trash */}
        <List disablePadding>
          <ListItemButton
            selected={sidebarSection === 'trash'}
            onClick={handleTrash}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <TrashIcon color={sidebarSection === 'trash' ? 'error' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="Trash" />
          </ListItemButton>
        </List>
      </Box>
    </Drawer>
  )
}

export { SIDEBAR_WIDTH }
