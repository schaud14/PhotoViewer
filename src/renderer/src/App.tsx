import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Toolbar } from '@mui/material'
import AppToolbar from './components/Toolbar/Toolbar'
import Sidebar, { SIDEBAR_WIDTH } from './components/Sidebar/Sidebar'
import PhotoGrid from './components/PhotoGrid/PhotoGrid'
import PhotoList from './components/PhotoList/PhotoList'
import PhotoViewer from './components/PhotoViewer/PhotoViewer'
import MetadataPanel, { METADATA_PANEL_WIDTH } from './components/MetadataPanel/MetadataPanel'
import CreateAlbumDialog from './components/Dialogs/CreateAlbumDialog'
import DuplicatesView from './components/DuplicatesView/DuplicatesView'
import LightTableView from './components/LightTable/LightTableView'
import { useUIStore } from './stores/uiStore'
import { useLibraryStore } from './stores/libraryStore'
import { useAlbumStore } from './stores/albumStore'
import { useSettingsStore } from './stores/settingsStore'
import { useKeyboardShortcuts } from './hooks/useKeyboard'
import type { SourceFolder } from '../../shared/types'

export default function App() {
  useKeyboardShortcuts()

  const viewMode = useUIStore((s) => s.viewMode)
  const metadataPanelOpen = useUIStore((s) => s.metadataPanelOpen)
  const fetchPhotos = useLibraryStore((s) => s.fetchPhotos)
  const setScanProgress = useLibraryStore((s) => s.setScanProgress)
  const createAlbum = useAlbumStore((s) => s.createAlbum)
  const sidebarSection = useUIStore((s) => s.sidebarSection)

  const [sourceFolders, setSourceFolders] = useState<SourceFolder[]>([])
  const [albumDialogOpen, setAlbumDialogOpen] = useState(false)
  const [albumDialogType, setAlbumDialogType] = useState<'virtual' | 'physical'>('virtual')

  const contentRef = useRef<HTMLDivElement>(null)
  const [contentSize, setContentSize] = useState({ width: 800, height: 600 })

  // Load initial data
  useEffect(() => {
    fetchPhotos()
    loadSourceFolders()

    // Listen for scan progress
    let unsubScan: (() => void) | undefined
    if (window.api?.onScanProgress) {
      unsubScan = window.api.onScanProgress((progress) => {
        setScanProgress(progress)
      })
    }

    // Listen for file watcher updates
    let unsubWatch: (() => void) | undefined
    if (window.api?.onLibraryUpdated) {
      unsubWatch = window.api.onLibraryUpdated(() => {
        fetchPhotos()
      })
    }

    return () => {
      if (unsubScan) unsubScan()
      if (unsubWatch) unsubWatch()
    }
  }, [])

  // Sync settings to main process
  const theme = useSettingsStore((s) => s.theme)
  const heicConversion = useSettingsStore((s) => s.heicConversion)
  
  useEffect(() => {
    if (window.api?.updateSettings) {
      window.api.updateSettings({ theme, heicConversion })
    }
  }, [theme, heicConversion])

  // Global Undo Listener (Cmd+Z / Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        const activeElement = document.activeElement
        // Ignore if typing in an input
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') return
        
        e.preventDefault()
        import('./stores/historyStore').then(({ useHistoryStore }) => {
          useHistoryStore.getState().undo()
        })
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Measure content area with ResizeObserver to handle transitions accurately
  useEffect(() => {
    if (!contentRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setContentSize({ width, height })
      }
    })

    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [])

  const loadSourceFolders = async () => {
    if (!window.api?.getSourceFolders) return
    const folders = await window.api.getSourceFolders()
    setSourceFolders(folders)
  }

  const handleAddFolder = useCallback(async () => {
    if (!window.api?.selectSourceFolders) return
    const paths = await window.api.selectSourceFolders()
    for (const path of paths) {
      await window.api.addSourceFolder(path)
    }
    await loadSourceFolders()

    // Auto-scan after adding
    if (paths.length > 0) {
      useLibraryStore.getState().startScan()
    }
  }, [])

  const handleCreateAlbum = useCallback((type: 'virtual' | 'physical') => {
    setAlbumDialogType(type)
    setAlbumDialogOpen(true)
  }, [])

  const handleRemoveFolder = useCallback(async (id: string) => {
    if (!window.api?.removeSourceFolder) return
    await window.api.removeSourceFolder(id)
    await loadSourceFolders()
    fetchPhotos()
  }, [fetchPhotos])

  const handleAlbumConfirm = useCallback(async (name: string, type: 'virtual' | 'physical') => {
    await createAlbum(name, type)
    setAlbumDialogOpen(false)
  }, [createAlbum])

  const mainContentWidth = metadataPanelOpen
    ? `calc(100% - ${SIDEBAR_WIDTH}px - ${METADATA_PANEL_WIDTH}px)`
    : `calc(100% - ${SIDEBAR_WIDTH}px)`

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AppToolbar onAddFolder={handleAddFolder} onCreateAlbum={handleCreateAlbum} />
      <Sidebar sourceFolders={sourceFolders} onRemoveFolder={handleRemoveFolder} />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: 0, // Removed redundant SIDEBAR_WIDTH
          mr: metadataPanelOpen ? `${METADATA_PANEL_WIDTH}px` : 0,
          transition: 'margin 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <Box
          ref={contentRef}
          sx={{
            flexGrow: 1,
            overflow: 'hidden',
          }}
        >
          {sidebarSection === 'duplicates' ? (
            <DuplicatesView />
          ) : sidebarSection.startsWith('lightTable-') ? (
            <LightTableView tableId={sidebarSection.replace('lightTable-', '')} />
          ) : viewMode === 'grid' ? (
            <PhotoGrid width={contentSize.width} height={contentSize.height} />
          ) : (
            <PhotoList />
          )}
        </Box>
      </Box>

      <MetadataPanel />
      <PhotoViewer />
      <CreateAlbumDialog
        open={albumDialogOpen}
        initialType={albumDialogType}
        onClose={() => setAlbumDialogOpen(false)}
        onConfirm={handleAlbumConfirm}
      />
    </Box>
  )
}
