import React, { useCallback, useState } from 'react'
import {
  AppBar,
  Toolbar as MuiToolbar,
  IconButton,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Box,
  Tooltip,
  Typography,
  InputAdornment,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress,
  Select,
} from '@mui/material'
import {
  CreateNewFolder as AddFolderIcon,
  ViewModule as GridIcon,
  ViewList as ListIcon,
  Info as MetadataIcon,
  Search as SearchIcon,
  PhotoAlbum as VirtualAlbumIcon,
  CreateNewFolder as PhysicalAlbumIcon,
  Add as AddIcon,
  Refresh as ScanIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Sort as SortIcon,
} from '@mui/icons-material'
import { useUIStore, ViewMode, ThumbnailSize } from '../../stores/uiStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { useAlbumStore } from '../../stores/albumStore'
import { useSettingsStore } from '../../stores/settingsStore'
import SettingsDialog from '../Dialogs/SettingsDialog'

interface ToolbarProps {
  onAddFolder: () => void
  onCreateAlbum: (type: 'virtual' | 'physical') => void
}

export default function AppToolbar({ onAddFolder, onCreateAlbum }: ToolbarProps) {
  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const thumbnailSize = useUIStore((s) => s.thumbnailSize)
  const setThumbnailSize = useUIStore((s) => s.setThumbnailSize)
  const toggleMetadataPanel = useUIStore((s) => s.toggleMetadataPanel)
  const metadataPanelOpen = useUIStore((s) => s.metadataPanelOpen)
  const searchText = useUIStore((s) => s.searchText)
  const setSearchText = useUIStore((s) => s.setSearchText)
  const isScanning = useLibraryStore((s) => s.isScanning)
  const scanProgress = useLibraryStore((s) => s.scanProgress)
  const startScan = useLibraryStore((s) => s.startScan)
  const setFilters = useLibraryStore((s) => s.setFilters)
  const fetchPhotos = useLibraryStore((s) => s.fetchPhotos)
  const selectedPhotoIds = useLibraryStore((s) => s.selectedPhotoIds)
  const clearSelection = useLibraryStore((s) => s.clearSelection)

  const [albumMenuAnchor, setAlbumMenuAnchor] = useState<null | HTMLElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchScope, setSearchScope] = useState<'current' | 'all'>('current')
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null)
  const sidebarSection = useUIStore((s) => s.sidebarSection)
  const setSidebarSection = useUIStore((s) => s.setSidebarSection)

  const albums = useAlbumStore((s) => s.albums)
  const activeAlbumId = useAlbumStore((s) => s.activeAlbumId)
  const filters = useLibraryStore((s) => s.filters)

  // Calculate the current view title
  const getContextTitle = () => {
    if (filters.trashed) return 'Trash'
    if (activeAlbumId) {
      const album = albums.find((a) => a.id === activeAlbumId)
      return album ? album.name : 'Album'
    }
    if (filters.sourceFolderPath) {
      return filters.sourceFolderPath.split('/').pop() || filters.sourceFolderPath
    }
    return 'All Photos'
  }

  const contextTitle = getContextTitle()


  // Debounced search
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)
  const handleSearch = useCallback((value: string, scope: 'current' | 'all') => {
    setSearchText(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (scope === 'all' && (useLibraryStore.getState().filters.albumId || useLibraryStore.getState().filters.sourceFolderPath)) {
        // Switch context to "All Photos" if searching globally from within a folder/album
        setSidebarSection('all')
        setFilters({ searchText: value || undefined, albumId: undefined, sourceFolderPath: undefined })
      } else {
        setFilters({ searchText: value || undefined })
      }
    }, 300)
  }, [setSearchText, setFilters, setSidebarSection])

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <MuiToolbar sx={{ gap: 1.5 }}>
        {/* App title */}
        <Typography variant="h6" sx={{ fontWeight: 700, mr: 1, background: 'linear-gradient(135deg, #7C4DFF, #00E5FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          PhotoViewer
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', opacity: 0.6, mr: 2 }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 400, mx: 1 }}>/</Typography>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 500, color: 'text.primary' }}>
            {contextTitle}
          </Typography>
        </Box>

        {/* Selection indicator + clear */}
        {selectedPhotoIds.size > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(33, 150, 243, 0.15)', borderRadius: 2, px: 1.5, py: 0.25, gap: 0.5 }}>
            <Typography variant="body2" sx={{ color: '#2196F3', fontWeight: 600, fontSize: '0.8rem' }}>
              {selectedPhotoIds.size} selected
            </Typography>
            <IconButton size="small" onClick={clearSelection} sx={{ color: '#2196F3', p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        )}

        {/* Add Folder */}
        <Tooltip title="Add Source Folder">
          <IconButton color="inherit" onClick={onAddFolder}>
            <AddFolderIcon />
          </IconButton>
        </Tooltip>

        {/* New Album */}
        <Tooltip title="New Album">
          <IconButton color="inherit" onClick={(e) => setAlbumMenuAnchor(e.currentTarget)}>
            <AddIcon />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={albumMenuAnchor}
          open={Boolean(albumMenuAnchor)}
          onClose={() => setAlbumMenuAnchor(null)}
        >
          <MenuItem onClick={() => { onCreateAlbum('virtual'); setAlbumMenuAnchor(null) }}>
            <ListItemIcon><VirtualAlbumIcon fontSize="small" color="info" /></ListItemIcon>
            <ListItemText>Virtual Album</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { onCreateAlbum('physical'); setAlbumMenuAnchor(null) }}>
            <ListItemIcon><PhysicalAlbumIcon fontSize="small" color="warning" /></ListItemIcon>
            <ListItemText>Physical Album</ListItemText>
          </MenuItem>
        </Menu>

        {/* Scan */}
        <Tooltip title="Scan Source Folders">
          <IconButton color="inherit" onClick={startScan} disabled={isScanning}>
            <ScanIcon />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* View Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, val) => val && setViewMode(val as ViewMode)}
          size="small"
        >
          <ToggleButton value="grid">
            <Tooltip title="Grid View"><GridIcon fontSize="small" /></Tooltip>
          </ToggleButton>
          <ToggleButton value="list">
            <Tooltip title="List View"><ListIcon fontSize="small" /></Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Thumbnail Size Controls */}
        {viewMode === 'grid' && (
          <ToggleButtonGroup
            value={thumbnailSize}
            exclusive
            onChange={(_, val) => val && setThumbnailSize(val as ThumbnailSize)}
            size="small"
          >
            <ToggleButton value="small">
              <Tooltip title="Small Thumbnails"><Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>S</Typography></Tooltip>
            </ToggleButton>
            <ToggleButton value="medium">
              <Tooltip title="Medium Thumbnails"><Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>M</Typography></Tooltip>
            </ToggleButton>
            <ToggleButton value="large">
              <Tooltip title="Large Thumbnails"><Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>L</Typography></Tooltip>
            </ToggleButton>
            <ToggleButton value="xl">
              <Tooltip title="Extra Large Thumbnails"><Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>XL</Typography></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        {/* Sort */}
        <Tooltip title="Sort">
          <IconButton color="inherit" onClick={(e) => setSortMenuAnchor(e.currentTarget)} size="small">
            <SortIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={sortMenuAnchor}
          open={Boolean(sortMenuAnchor)}
          onClose={() => setSortMenuAnchor(null)}
        >
          <MenuItem onClick={() => { setFilters({ sortBy: 'dateTaken', sortOrder: 'desc' }); setSortMenuAnchor(null) }}
            selected={(!filters.sortBy || filters.sortBy === 'dateTaken') && filters.sortOrder !== 'asc'}>
            <ListItemText>Date (Newest First)</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setFilters({ sortBy: 'dateTaken', sortOrder: 'asc' }); setSortMenuAnchor(null) }}
            selected={filters.sortBy === 'dateTaken' && filters.sortOrder === 'asc'}>
            <ListItemText>Date (Oldest First)</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setFilters({ sortBy: 'fileName', sortOrder: 'asc' }); setSortMenuAnchor(null) }}
            selected={filters.sortBy === 'fileName' && filters.sortOrder === 'asc'}>
            <ListItemText>Name (A → Z)</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setFilters({ sortBy: 'fileName', sortOrder: 'desc' }); setSortMenuAnchor(null) }}
            selected={filters.sortBy === 'fileName' && filters.sortOrder === 'desc'}>
            <ListItemText>Name (Z → A)</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setFilters({ sortBy: 'fileSize', sortOrder: 'desc' }); setSortMenuAnchor(null) }}
            selected={filters.sortBy === 'fileSize'}>
            <ListItemText>Size (Largest)</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setFilters({ sortBy: 'createdAt', sortOrder: 'desc' }); setSortMenuAnchor(null) }}
            selected={filters.sortBy === 'createdAt'}>
            <ListItemText>Date Added</ListItemText>
          </MenuItem>
        </Menu>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Search */}
        <TextField
          placeholder="Search photos..."
          value={searchText}
          onChange={(e) => handleSearch(e.target.value, searchScope)}
          size="small"
          sx={{ width: 340 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: (
              sidebarSection !== 'all' && sidebarSection !== 'trash' && (
                <InputAdornment position="end">
                  <Select
                    value={searchScope}
                    onChange={(e) => {
                      const newScope = e.target.value as 'current' | 'all'
                      setSearchScope(newScope)
                      if (searchText) handleSearch(searchText, newScope)
                    }}
                    variant="standard"
                    disableUnderline
                    sx={{ fontSize: '0.75rem', color: 'text.secondary', '.MuiSelect-select': { py: 0, pr: 3 } }}
                  >
                    <MenuItem value="current" sx={{ fontSize: '0.8rem' }}>Current View</MenuItem>
                    <MenuItem value="all" sx={{ fontSize: '0.8rem' }}>All Photos</MenuItem>
                  </Select>
                </InputAdornment>
              )
            ),
          }}
        />

        {/* Metadata Panel Toggle */}
        <Tooltip title="Metadata Panel ( I )">
          <IconButton
            color={metadataPanelOpen ? 'primary' : 'inherit'}
            onClick={toggleMetadataPanel}
          >
            <MetadataIcon />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Settings">
          <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </MuiToolbar>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Scan progress bar */}
      {isScanning && (
        <LinearProgress
          variant={scanProgress?.total ? 'determinate' : 'indeterminate'}
          value={scanProgress?.total ? (scanProgress.processed / scanProgress.total) * 100 : undefined}
          sx={{ height: 2 }}
        />
      )}
    </AppBar>
  )
}
