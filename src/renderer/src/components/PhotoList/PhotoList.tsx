import React, { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Box,
  Typography,
  Chip,
  Avatar,
} from '@mui/material'
import { useLibraryStore } from '../../stores/libraryStore'
import { useUIStore } from '../../stores/uiStore'
import { getImageUrl } from '../../utils/imageUrl'

type SortField = 'fileName' | 'dateTaken' | 'fileSize' | 'createdAt'
type SortDir = 'asc' | 'desc'

export default function PhotoList() {
  const photos = useLibraryStore((s) => s.photos)
  const selectedPhotoIds = useLibraryStore((s) => s.selectedPhotoIds)
  const selectPhoto = useLibraryStore((s) => s.selectPhoto)
  const setCurrentPhoto = useLibraryStore((s) => s.setCurrentPhoto)
  const setPhotoViewerOpen = useUIStore((s) => s.setPhotoViewerOpen)

  const [sortField, setSortField] = React.useState<SortField>('createdAt')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      let aVal = a[sortField] ?? ''
      let bVal = b[sortField] ?? ''
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [photos, sortField, sortDir])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  }

  if (photos.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6" color="text.secondary">No photos found</Typography>
        <Typography variant="body2" color="text.secondary">Add a source folder and scan to get started</Typography>
      </Box>
    )
  }

  return (
    <TableContainer sx={{ height: '100%', overflow: 'auto' }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 50 }}></TableCell>
            <TableCell>
              <TableSortLabel active={sortField === 'fileName'} direction={sortDir} onClick={() => handleSort('fileName')}>
                Name
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel active={sortField === 'dateTaken'} direction={sortDir} onClick={() => handleSort('dateTaken')}>
                Date
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel active={sortField === 'fileSize'} direction={sortDir} onClick={() => handleSort('fileSize')}>
                Size
              </TableSortLabel>
            </TableCell>
            <TableCell>Tags</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedPhotos.map((photo) => {
            const isSelected = selectedPhotoIds.has(photo.id)
            return (
              <TableRow
                key={photo.id}
                hover
                selected={isSelected}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) {
                    selectPhoto(photo.id, true)
                  } else {
                    selectPhoto(photo.id, false)
                    setCurrentPhoto(photo.id)
                    setPhotoViewerOpen(true)
                  }
                }}
                onDoubleClick={() => { setCurrentPhoto(photo.id); setPhotoViewerOpen(true) }}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell sx={{ p: 0.5 }}>
                  <Avatar
                    variant="rounded"
                    src={getImageUrl(photo, true)}
                    sx={{ width: 40, height: 40 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 300, color: 'text.primary' }}>
                    {photo.fileName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatDate(photo.dateTaken || photo.createdAt)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatSize(photo.fileSize)}</Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {photo.tags.slice(0, 3).map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    ))}
                    {photo.tags.length > 3 && (
                      <Chip label={`+${photo.tags.length - 3}`} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
