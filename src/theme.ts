import { PaletteMode } from "@mui/material";
import { deepPurple, pink } from "@mui/material/colors";
import { ThemeOptions } from "@mui/material/styles";

// Function to create the theme based on the mode
export const createAppTheme = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    background:
      mode === "dark"
        ? {
            // Dark mode specific backgrounds (optional customization)
            default: "#121212", // Standard dark background
            paper: "#1e1e1e", // Slightly lighter paper
          }
        : {
            // Light mode specific backgrounds (optional customization)
            default: "#fafafa", // Slightly off-white
            paper: "#ffffff",
          },
    mode, // Set the mode ('light' or 'dark')
    primary: {
      // Use purple as primary
      dark: deepPurple[700],
      light: deepPurple[300],
      main: deepPurple[500],
    },
    secondary: {
      main: pink[500], // Keep pink as secondary or choose another
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
