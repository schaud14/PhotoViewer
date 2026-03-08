import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Typography,
} from '@mui/material'

interface CreateAlbumDialogProps {
  open: boolean
  initialType?: 'virtual' | 'physical'
  onClose: () => void
  onConfirm: (name: string, type: 'virtual' | 'physical') => void
}

export default function CreateAlbumDialog({ open, initialType, onClose, onConfirm }: CreateAlbumDialogProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'virtual' | 'physical'>(initialType || 'virtual')

  const handleSubmit = () => {
    if (name.trim()) {
      onConfirm(name.trim(), type)
      setName('')
      setType('virtual')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Create New Album</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <TextField
          autoFocus
          label="Album Name"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          sx={{ mb: 3 }}
        />
        <FormControl>
          <FormLabel>Album Type</FormLabel>
          <RadioGroup value={type} onChange={(e) => setType(e.target.value as 'virtual' | 'physical')}>
            <FormControlLabel
              value="virtual"
              control={<Radio />}
              label={
                <div>
                  <Typography variant="body2">Virtual Album</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Photos stay in their original locations. A photo can be in multiple virtual albums.
                  </Typography>
                </div>
              }
            />
            <FormControlLabel
              value="physical"
              control={<Radio />}
              label={
                <div>
                  <Typography variant="body2">Physical Album</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Creates a folder on disk and moves photos into it. A photo can only be in one physical album.
                  </Typography>
                </div>
              }
            />
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!name.trim()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  )
}
