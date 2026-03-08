import { create } from 'zustand'
import type { Photo, PhotoFilters, ScanProgress, LightTable } from '../../../shared/types'

interface LibraryState {
  photos: Photo[]
  lightTables: LightTable[]
  selectedPhotoIds: Set<string>
  currentPhotoId: string | null
  filters: PhotoFilters
  scanProgress: ScanProgress | null
  isScanning: boolean
  isLoading: boolean
  deletingIds: Set<string>

  // Actions
  fetchPhotos: (filters?: PhotoFilters) => Promise<void>
  fetchLightTables: () => Promise<void>
  setFilters: (filters: Partial<PhotoFilters>) => void
  selectPhoto: (id: string, multi?: boolean) => void
  selectPhotos: (ids: string[], multi?: boolean) => void
  clearSelection: () => void
  setCurrentPhoto: (id: string | null) => void
  startScan: () => Promise<void>
  setScanProgress: (progress: ScanProgress | null) => void
  addDeletingIds: (ids: string[]) => void
  removeDeletingIds: (ids: string[]) => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  photos: [],
  lightTables: [],
  selectedPhotoIds: new Set(),
  currentPhotoId: null,
  filters: {},
  scanProgress: null,
  isScanning: false,
  isLoading: false,
  deletingIds: new Set(),

  fetchPhotos: async (filters?: PhotoFilters) => {
    if (!window.api?.getPhotos) { set({ isLoading: false }); return }
    set({ isLoading: true })
    try {
      const appliedFilters = filters || get().filters
      const photos = await window.api.getPhotos(appliedFilters)
      set({ photos, filters: appliedFilters, isLoading: false })
    } catch (err) {
      console.error('Failed to fetch photos:', err)
      set({ isLoading: false })
    }
  },

  fetchLightTables: async () => {
    if (!window.api?.getLightTables) return
    try {
      const tables = await window.api.getLightTables()
      set({ lightTables: tables })
    } catch (err) {
      console.error('Failed to fetch light tables:', err)
    }
  },

  setFilters: (newFilters) => {
    const filters = { ...get().filters, ...newFilters }
    set({ filters })
    get().fetchPhotos(filters)
  },

  selectPhoto: (id, multi = false) => {
    set((state) => {
      const newSelection = new Set(multi ? state.selectedPhotoIds : [])
      if (newSelection.has(id) && multi) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
      return { selectedPhotoIds: newSelection, currentPhotoId: id }
    })
  },
  
  selectPhotos: (ids, multi = false) => {
    set((state) => {
      const newSelection = new Set(multi ? state.selectedPhotoIds : [])
      for (const id of ids) {
        newSelection.add(id)
      }
      return { selectedPhotoIds: newSelection }
    })
  },

  clearSelection: () => {
    set({ selectedPhotoIds: new Set(), currentPhotoId: null })
  },

  setCurrentPhoto: (id) => {
    set({ currentPhotoId: id })
  },

  startScan: async () => {
    if (!window.api?.scanSources) return
    set({ isScanning: true })
    try {
      await window.api.scanSources()
    } catch (err) {
      console.error('Scan failed:', err)
    }
    set({ isScanning: false })
    get().fetchPhotos()
  },

  setScanProgress: (progress) => {
    set({ scanProgress: progress })
    if (progress?.status === 'complete') {
      set({ isScanning: false })
      get().fetchPhotos()
    }
  },

  addDeletingIds: (ids: string[]) => {
    set((state) => {
      const newMap = new Set(state.deletingIds)
      ids.forEach(id => newMap.add(id))
      return { deletingIds: newMap }
    })
  },

  removeDeletingIds: (ids: string[]) => {
    set((state) => {
      const newMap = new Set(state.deletingIds)
      ids.forEach(id => newMap.delete(id))
      return { deletingIds: newMap }
    })
  }
}))
