import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from '@mui/material'

interface RenameDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (newName: string) => void
  currentName: string
}

export default function RenameDialog({ open, onClose, onConfirm, currentName }: RenameDialogProps) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) {
      // By default, select just the name part before the extension
      const lastDot = currentName.lastIndexOf('.')
      setName(lastDot > 0 ? currentName.substring(0, lastDot) : currentName)
    }
  }, [open, currentName])

  const handleConfirm = () => {
    if (!name.trim()) return
    onConfirm(name)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Rename Photo</DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The file extension will be preserved automatically.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="New File Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm()
          }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleConfirm} 
          color="primary" 
          variant="contained"
          disabled={!name.trim() || name === currentName || name === currentName.substring(0, currentName.lastIndexOf('.'))}
        >
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  )
}
