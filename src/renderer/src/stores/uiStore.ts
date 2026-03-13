import { create } from 'zustand'

export type ViewMode = 'grid' | 'list'
export type ThumbnailSize = 'small' | 'medium' | 'large' | 'xl'
export type SidebarSection = 'all' | 'folders' | 'album' | 'trash' | 'duplicates' | 'people'

interface UIState {
  viewMode: ViewMode
  thumbnailSize: ThumbnailSize
  metadataPanelOpen: boolean
  sidebarSection: SidebarSection
  photoViewerOpen: boolean
  searchText: string

  // Actions
  setViewMode: (mode: ViewMode) => void
  setThumbnailSize: (size: ThumbnailSize) => void
  toggleMetadataPanel: () => void
  setMetadataPanelOpen: (open: boolean) => void
  setSidebarSection: (section: SidebarSection) => void
  setPhotoViewerOpen: (open: boolean) => void
  setSearchText: (text: string) => void
}

const THUMBNAIL_SIZES: Record<ThumbnailSize, number> = {
  small: 150,
  medium: 220,
  large: 320,
  xl: 450,
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'grid',
  thumbnailSize: 'medium',
  metadataPanelOpen: false,
  sidebarSection: 'all',
  photoViewerOpen: false,
  searchText: '',

  setViewMode: (mode) => set({ viewMode: mode }),
  setThumbnailSize: (size) => set({ thumbnailSize: size }),
  toggleMetadataPanel: () => set((s) => ({ metadataPanelOpen: !s.metadataPanelOpen })),
  setMetadataPanelOpen: (open) => set({ metadataPanelOpen: open }),
  setSidebarSection: (section) => set({ sidebarSection: section }),
  setPhotoViewerOpen: (open) => set({ photoViewerOpen: open }),
  setSearchText: (text) => set({ searchText: text }),
}))

export { THUMBNAIL_SIZES }
