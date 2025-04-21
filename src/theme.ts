import { createTheme, ThemeOptions } from '@mui/material/styles';
import { deepPurple, pink } from '@mui/material/colors';
import { PaletteMode } from '@mui/material';

// Function to create the theme based on the mode
export const createAppTheme = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    mode, // Set the mode ('light' or 'dark')
    primary: {
      // Use purple as primary
      main: deepPurple[500], 
      light: deepPurple[300],
      dark: deepPurple[700],
    },
    secondary: {
      main: pink[500], // Keep pink as secondary or choose another
    },
    background: mode === 'dark' ? {
      // Dark mode specific backgrounds (optional customization)
      default: '#121212', // Standard dark background
      paper: '#1e1e1e',   // Slightly lighter paper
    } : {
      // Light mode specific backgrounds (optional customization)
      default: '#fafafa', // Slightly off-white
      paper: '#ffffff',
    },
  },
  typography: {
    // Define any typography customizations here
  },
  // Define any component overrides here
  // components: {
  //   MuiAppBar: {
  //     styleOverrides: {
  //       colorPrimary: {
  //         backgroundColor: mode === 'dark' ? deepPurple[800] : deepPurple[500],
  //       }
  //     }
  //   }
  // }
});
