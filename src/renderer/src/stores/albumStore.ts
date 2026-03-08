import { create } from 'zustand'
import type { Album } from '../../../shared/types'

interface AlbumState {
  albums: Album[]
  activeAlbumId: string | null
  isLoading: boolean

  // Actions
  fetchAlbums: () => Promise<void>
  setActiveAlbum: (id: string | null) => void
  createAlbum: (name: string, type: 'virtual' | 'physical', basePath?: string) => Promise<Album>
  deleteAlbum: (id: string) => Promise<void>
  addPhotosToAlbum: (albumId: string, photoIds: string[]) => Promise<void>
  removePhotoFromAlbum: (albumId: string, photoId: string) => Promise<void>
}

export const useAlbumStore = create<AlbumState>((set, get) => ({
  albums: [],
  activeAlbumId: null,
  isLoading: false,

  fetchAlbums: async () => {
    if (!window.api?.getAlbums) { set({ isLoading: false }); return }
    set({ isLoading: true })
    try {
      const albums = await window.api.getAlbums()
      set({ albums, isLoading: false })
    } catch (err) {
      console.error('Failed to fetch albums:', err)
      set({ isLoading: false })
    }
  },

  setActiveAlbum: (id) => {
    set({ activeAlbumId: id })
  },

  createAlbum: async (name, type, basePath) => {
    const album = await window.api.createAlbum({ name, type, basePath })
    await get().fetchAlbums()
    return album
  },

  deleteAlbum: async (id) => {
    await window.api.deleteAlbum(id)
    set((state) => ({
      activeAlbumId: state.activeAlbumId === id ? null : state.activeAlbumId
    }))
    await get().fetchAlbums()
  },

  addPhotosToAlbum: async (albumId, photoIds) => {
    await window.api.addPhotosToAlbum(albumId, photoIds)
    await get().fetchAlbums()
  },

  removePhotoFromAlbum: async (albumId, photoId) => {
    await window.api.removePhotoFromAlbum(albumId, photoId)
    await get().fetchAlbums()
  },
}))
