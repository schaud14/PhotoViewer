import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material'
import { darkTheme, lightTheme } from './theme'
import App from './App'
import { useSettingsStore } from './stores/settingsStore'
import './styles/index.css'

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const themeSetting = useSettingsStore((s) => s.theme)
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')

  const isDark = themeSetting === 'dark' || (themeSetting === 'system' && prefersDarkMode)
  const activeTheme = isDark ? darkTheme : lightTheme

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeWrapper>
      <App />
    </ThemeWrapper>
  </React.StrictMode>
)
