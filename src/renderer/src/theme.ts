import { createTheme } from '@mui/material/styles'

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7C4DFF',
      light: '#B388FF',
      dark: '#651FFF',
    },
    secondary: {
      main: '#00E5FF',
      light: '#18FFFF',
      dark: '#00B8D4',
    },
    background: {
      default: '#0D1117',
      paper: '#161B22',
    },
    text: {
      primary: '#E6EDF3',
      secondary: '#8B949E',
    },
    divider: '#21262D',
    error: {
      main: '#F85149',
    },
    warning: {
      main: '#D29922',
    },
    success: {
      main: '#3FB950',
    },
    info: {
      main: '#58A6FF',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600, fontSize: '1rem' },
    subtitle1: { fontWeight: 500 },
    body2: { color: '#8B949E' },
  },
  shape: { borderRadius: 8 },
  components: {
    ...sharedComponents('dark')
  }
})

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#651FFF',
      light: '#7C4DFF',
      dark: '#4615b2',
    },
    secondary: {
      main: '#00B8D4',
      light: '#00E5FF',
      dark: '#00838f',
    },
    background: {
      default: '#F6F8FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#24292F',
      secondary: '#57606A',
    },
    divider: '#D0D7DE',
    error: { main: '#CF222E' },
    warning: { main: '#9A6700' },
    success: { main: '#1A7F37' },
    info: { main: '#0969DA' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600, fontSize: '1rem' },
    subtitle1: { fontWeight: 500 },
    body2: { color: '#57606A' },
  },
  shape: { borderRadius: 8 },
  components: {
    ...sharedComponents('light')
  }
})

function sharedComponents(mode: 'light' | 'dark') {
  const isDark = mode === 'dark'
  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          overflow: 'hidden',
          userSelect: 'none',
        },
        '::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '::-webkit-scrollbar-thumb': {
          background: isDark ? '#30363D' : '#D0D7DE',
          borderRadius: '4px',
        },
        '::-webkit-scrollbar-thumb:hover': {
          background: isDark ? '#484F58' : '#8C959F',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: isDark ? '#0D1117' : '#F6F8FA',
          borderRight: `1px solid ${isDark ? '#21262D' : '#D0D7DE'}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
          borderBottom: `1px solid ${isDark ? '#21262D' : '#D0D7DE'}`,
          boxShadow: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          margin: '2px 8px',
          '&.Mui-selected': {
            backgroundColor: isDark ? 'rgba(124, 77, 255, 0.15)' : 'rgba(101, 31, 255, 0.08)',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(124, 77, 255, 0.25)' : 'rgba(101, 31, 255, 0.12)',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          fontWeight: 500,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small' as const,
        variant: 'outlined' as const,
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
          backgroundImage: 'none',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: isDark ? '#30363D' : '#24292F',
          fontSize: '0.75rem',
        },
      },
    },
  }
}
