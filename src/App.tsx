import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import CreateIcon from "@mui/icons-material/Create";
//import AddIcon from "@mui/icons-material/Add";
import HomeIcon from "@mui/icons-material/Home";
import LogoutIcon from "@mui/icons-material/Logout";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
//import BurstModeIcon from "@mui/icons-material/BurstMode"; // Using BurstMode for Flix
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
//import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ThemeProvider, createTheme } from "@mui/material/styles"; // Correct import for ThemeProvider, createTheme
import { useTheme } from "@mui/material/styles"; // Correct import for useTheme
//import Fab from "@mui/material/Fab";
import useMediaQuery from "@mui/material/useMediaQuery"; // Correct import for useMediaQuery
// src/App.tsx
import React, {
  useEffect,
  //useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import toast, { Toaster } from "react-hot-toast";
import { Link as RouterLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { LoginModal } from "./components/LoginModal";
import { SignUpModal } from "./components/SignUpModal";
import { useNdk } from "./contexts/NdkContext";
import { CreatePostPage } from "./pages/CreatePostPage";
import { FollowingFeedPage } from "./pages/FollowingFeedPage";
import { GlobalFeedPage } from "./pages/GlobalFeedPage";
import { HashtagFeedPage } from "./pages/HashtagFeedPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { ThreadPage } from "./pages/ThreadPage";
import { createAppTheme } from "./theme";

function AppContent() {
  const {
    //ndk,
    loggedInUserProfile,
    logout,
    signer,
    themeMode,
    toggleThemeMode,
    user,
  } = useNdk();
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] = useState<null | HTMLElement>(null); // State for mobile overflow menu
  const location = useLocation();
  const navigate = useNavigate();
  const hasRedirectedRef = useRef(false);
  const theme = useTheme(); // Get theme for breakpoints
  const isDesktop = useMediaQuery(theme.breakpoints.up("sm")); // Adjust breakpoint as needed ('sm', 'md')

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) =>
    setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);

  const handleOpenMobileMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchorEl(event.currentTarget);
  };
  const handleCloseMobileMenu = () => {
    setMobileMenuAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleCloseUserMenu();
    handleCloseMobileMenu();
    navigate("/");
  };

  const handleThemeToggle = () => {
    toggleThemeMode();
    handleCloseMobileMenu(); // Close menu after toggle
  };

  useEffect(() => {
    if (!user) {
      hasRedirectedRef.current = false;
      return;
    }
    if (user && location.pathname === "/" && !hasRedirectedRef.current) {
      console.log(
        "AppContent: User logged in on global feed, performing initial redirect to /following.",
      );
      navigate("/following", { replace: true });
      hasRedirectedRef.current = true;
    }
  }, [user, location.pathname, navigate]);

  const userInitial =
    loggedInUserProfile?.displayName?.charAt(0)?.toUpperCase() ||
    loggedInUserProfile?.name?.charAt(0)?.toUpperCase() ||
    (user ? "N" : "");

  const dynamicTheme = useMemo(() => createTheme(createAppTheme(themeMode)), [themeMode]);

  return (
    <ThemeProvider theme={dynamicTheme}>
      <CssBaseline />

      <Box sx={{ display: "flex", height: "100vh" }}>
        {isDesktop && (
          // Desktop Left Menu
          <Box
            component="nav"
            sx={{
              bgcolor: "background.paper", // Example background color
              borderRight: "1px solid divider", // Example separator
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              height: "100%",
              width: 200, // Fixed width for the left menu
            }}
          >
            {/* Logo and Name (Desktop) */}
            <Box
              component={RouterLink}
              sx={{
                alignItems: "center",
                color: "inherit",
                display: "flex",
                mb: 1, // Margin below logo
                p: 2, // Padding around logo
                textDecoration: "none",
              }}
              to="/"
            >
              <img
                alt="Zappix Logo"
                src="/zappix-logo.png"
                style={{ height: "30px", marginRight: "10px" }}
              />
              <Typography component="div" noWrap variant="h6">
                Zappix
              </Typography>
            </Box>

            {/* Desktop Navigation Links */}
            <Box sx={{ flexGrow: 1, overflowY: "auto", px: 1 }}>
              {" "}
              {/* Makes nav scrollable if needed */}
              <Button
                component={RouterLink}
                fullWidth
                sx={{
                  justifyContent: "flex-start",
                  mb: 1,
                  padding: "8px 16px",
                  textAlign: "left",
                }}
                to="/"
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <HomeIcon />
                </ListItemIcon>
                <ListItemText primary="Home" />
              </Button>
              {/* Add Search and Flix placeholders or actual implementation later */}
              <Button
                fullWidth
                onClick={() => toast("Search not implemented")}
                sx={{
                  justifyContent: "flex-start",
                  mb: 1,
                  padding: "8px 16px",
                  textAlign: "left",
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <SearchIcon />
                </ListItemIcon>
                <ListItemText primary="Search" />
              </Button>
              <Button
                fullWidth
                onClick={() => toast("Flix not implemented")}
                sx={{
                  justifyContent: "flex-start",
                  mb: 1,
                  padding: "8px 16px",
                  textAlign: "left",
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <VideoLibraryIcon />
                </ListItemIcon>
                <ListItemText primary="Flix" />
              </Button>
              <Button
                component={RouterLink}
                fullWidth
                sx={{
                  justifyContent: "flex-start",
                  mb: 1,
                  padding: "8px 16px",
                  textAlign: "left",
                }}
                to="/create"
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CreateIcon />
                </ListItemIcon>
                <ListItemText primary="Create" />
              </Button>
            </Box>

            {/* Desktop Auth/User Controls */}
            <Box sx={{ mt: "auto", p: 2 }}>
              {" "}
              {/* Align to bottom */}
              {!user && !signer ? (
                <Box>
                  <Button
                    fullWidth
                    onClick={() => setLoginOpen(true)}
                    sx={{ mb: 1 }}
                    variant="outlined"
                  >
                    Login
                  </Button>
                  <Button fullWidth onClick={() => setSignupOpen(true)} variant="contained">
                    Sign Up
                  </Button>
                </Box>
              ) : (
                <Box
                  sx={{
                    alignItems: "center",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Tooltip title="Open menu">
                    <IconButton onClick={handleOpenUserMenu} sx={{ mb: 1, p: 0 }}>
                      <Avatar
                        alt={
                          loggedInUserProfile?.displayName || loggedInUserProfile?.name || "User"
                        }
                        src={
                          loggedInUserProfile?.image?.startsWith("http")
                            ? loggedInUserProfile.image
                            : undefined
                        }
                      >
                        {!loggedInUserProfile?.image?.startsWith("http") ? userInitial : null}
                      </Avatar>
                    </IconButton>
                  </Tooltip>
                  <Typography sx={{ mb: 1, textAlign: "center" }} variant="caption">
                    {loggedInUserProfile?.displayName || user?.npub.substring(0, 8) + "..."}
                  </Typography>
                  <IconButton color="inherit" onClick={toggleThemeMode}>
                    {themeMode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
                  </IconButton>
                  {/* User Menu (for profile, settings, logout on desktop) */}
                  <Menu
                    anchorEl={anchorElUser}
                    anchorOrigin={{ horizontal: "right", vertical: "top" }}
                    id="user-menu-desktop"
                    onClose={handleCloseUserMenu}
                    open={Boolean(anchorElUser)}
                    transformOrigin={{ horizontal: "left", vertical: "top" }}
                  >
                    <MenuItem
                      component={RouterLink}
                      onClick={handleCloseUserMenu}
                      to={`/profile/${user?.npub}`}
                    >
                      Profile
                    </MenuItem>
                    <MenuItem component={RouterLink} onClick={handleCloseUserMenu} to="/settings">
                      Settings
                    </MenuItem>
                    <MenuItem onClick={handleLogout}>Logout</MenuItem>
                  </Menu>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Main Content Area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            height: "100vh",
            overflowY: "auto", // Allow content scrolling
            //ml: isDesktop ? '240px' : 0, // RESTORED Offset for desktop menu
            pb: isDesktop ? 0 : "56px", // Padding at bottom for mobile nav
            //p: 0, // padding handled by pages/content
          }}
        >
          {/* Container removed, Routes rendered directly in Box */}
          <Routes>
            <Route element={<GlobalFeedPage />} path="/" />
            <Route element={<FollowingFeedPage />} path="/following" />
            <Route element={<ProfilePage />} path="/profile/:npub" />
            <Route element={<SettingsPage />} path="/settings" />
            <Route element={<HashtagFeedPage />} path="/t/:hashtag" />
            <Route element={<ThreadPage />} path="/n/:nevent" />
            <Route element={<CreatePostPage />} path="/create" />
          </Routes>
        </Box>

        {!isDesktop && (
          // Mobile Bottom AppBar
          <AppBar
            color="inherit"
            position="fixed"
            sx={{ borderTop: "1px solid divider", bottom: 0, top: "auto" }}
          >
            <Toolbar sx={{ justifyContent: "space-around" }}>
              {/* Mobile Navigation Icons */}
              <IconButton
                color={location.pathname === "/" ? "primary" : "inherit"}
                component={RouterLink}
                to="/"
              >
                <HomeIcon />
              </IconButton>
              <IconButton color="inherit" onClick={() => toast("Search not implemented")}>
                <SearchIcon />
              </IconButton>{" "}
              {/* Placeholder action */}
              <IconButton color="inherit" onClick={() => toast("Flix not implemented")}>
                <VideoLibraryIcon />
              </IconButton>{" "}
              {/* Placeholder action */}
              <IconButton
                color={location.pathname === "/create" ? "primary" : "inherit"}
                component={RouterLink}
                to="/create"
              >
                <CreateIcon />
              </IconButton>
              {user && (
                <IconButton
                  color={location.pathname.startsWith("/profile/") ? "primary" : "inherit"}
                  component={RouterLink}
                  to={`/profile/${user.npub}`}
                >
                  <PersonIcon />
                </IconButton>
              )}
              {/* Mobile Overflow Menu Button */}
              <IconButton
                color="inherit"
                id="mobile-overflow-button"
                onClick={handleOpenMobileMenu}
              >
                <MoreVertIcon />
              </IconButton>
              {/* Mobile Overflow Menu */}
              <Menu
                anchorEl={mobileMenuAnchorEl}
                anchorOrigin={{ horizontal: "right", vertical: "top" }}
                id="mobile-overflow-menu"
                onClose={handleCloseMobileMenu}
                open={Boolean(mobileMenuAnchorEl)}
                transformOrigin={{ horizontal: "right", vertical: "bottom" }}
              >
                {!user && (
                  <MenuItem
                    onClick={() => {
                      setLoginOpen(true);
                      handleCloseMobileMenu();
                    }}
                  >
                    Login
                  </MenuItem>
                )}
                {!user && (
                  <MenuItem
                    onClick={() => {
                      setSignupOpen(true);
                      handleCloseMobileMenu();
                    }}
                  >
                    Sign Up
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    navigate("/settings");
                    handleCloseMobileMenu();
                  }}
                >
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Settings</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleThemeToggle}>
                  <ListItemIcon>
                    {themeMode === "dark" ? (
                      <Brightness7Icon fontSize="small" />
                    ) : (
                      <Brightness4Icon fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText>{themeMode === "dark" ? "Light Mode" : "Dark Mode"}</ListItemText>
                </MenuItem>
                {user && (
                  <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Logout</ListItemText>
                  </MenuItem>
                )}
              </Menu>
            </Toolbar>
          </AppBar>
        )}
      </Box>

      {/* Modals and Toaster (Render outside main layout) */}
      <LoginModal onClose={() => setLoginOpen(false)} open={loginOpen} />
      <SignUpModal onClose={() => setSignupOpen(false)} open={signupOpen} />
      <Toaster position="bottom-center" />

      {/* FAB - No longer needed as Create is in nav */}
      {/* {!isDesktop && user && (
         <Fab
           color="primary"
           aria-label="add"
           sx={{ position: "fixed", bottom: 72, right: 16 }} // Adjusted position to be above bottom app bar
           component={RouterLink}
           to="/create"
         >
           <AddIcon />
         </Fab>
       )} */}
    </ThemeProvider>
  );
}

function App() {
  // Basic wrapper, could add other top-level providers here if needed
  return <AppContent />;
}

export default App;
