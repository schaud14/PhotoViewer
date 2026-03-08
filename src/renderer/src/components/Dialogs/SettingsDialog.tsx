import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Divider,
} from '@mui/material'
import { useSettingsStore } from '../../stores/settingsStore'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const heicConversion = useSettingsStore((s) => s.heicConversion)
  const setHeicConversion = useSettingsStore((s) => s.setHeicConversion)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        
        {/* Appearance Settings */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Appearance
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="theme-select-label">Theme</InputLabel>
            <Select
              labelId="theme-select-label"
              value={theme}
              label="Theme"
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            >
              <MenuItem value="system">System Default</MenuItem>
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Divider />

        {/* Import Settings */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Import
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={heicConversion}
                onChange={(e) => setHeicConversion(e.target.checked)}
                color="primary"
              />
            }
            label="Convert HEIC to JPEG on import"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4, mt: -0.5 }}>
            Automatically converts Apple HEIC photos to standard JPEG when copying into physical albums or importing. The original files in source folders are never modified.
          </Typography>
        </Box>

      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  )
}
