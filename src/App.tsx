// src/App.tsx
import React, {
  useState,
  useEffect,
  useRef,
  //useCallback,
  useMemo,
} from "react";
import { Route, Routes, Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles"; // Correct import for ThemeProvider, createTheme
import CssBaseline from "@mui/material/CssBaseline";
//import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
//import Fab from "@mui/material/Fab";
import useMediaQuery from "@mui/material/useMediaQuery"; // Correct import for useMediaQuery
import { useTheme } from "@mui/material/styles"; // Correct import for useTheme
import toast, { Toaster } from "react-hot-toast";
import { useNdk } from "./contexts/NdkContext";
import { GlobalFeedPage } from "./pages/GlobalFeedPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { HashtagFeedPage } from "./pages/HashtagFeedPage";
import { ThreadPage } from "./pages/ThreadPage";
import { FollowingFeedPage } from "./pages/FollowingFeedPage";
import { CreatePostPage } from "./pages/CreatePostPage";
import { LoginModal } from "./components/LoginModal";
import { SignUpModal } from "./components/SignUpModal";
import { createAppTheme } from "./theme";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
//import AddIcon from "@mui/icons-material/Add";
import HomeIcon from "@mui/icons-material/Home";
import SearchIcon from "@mui/icons-material/Search";
//import BurstModeIcon from "@mui/icons-material/BurstMode"; // Using BurstMode for Flix
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import CreateIcon from "@mui/icons-material/Create";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import LogoutIcon from "@mui/icons-material/Logout";

function AppContent() {
  const {
    //ndk,
    user,
    signer,
    loggedInUserProfile,
    logout,
    themeMode,
    toggleThemeMode,
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
              width: 200, // Fixed width for the left menu
              flexShrink: 0,
              bgcolor: "background.paper", // Example background color
              borderRight: "1px solid divider", // Example separator
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            {/* Logo and Name (Desktop) */}
            <Box
              component={RouterLink}
              to="/"
              sx={{
                display: "flex",
                alignItems: "center",
                color: "inherit",
                textDecoration: "none",
                p: 2, // Padding around logo
                mb: 1, // Margin below logo
              }}
            >
              <img
                src="/zappix-logo.png"
                alt="Zappix Logo"
                style={{ height: "30px", marginRight: "10px" }}
              />
              <Typography variant="h6" noWrap component="div">
                Zappix
              </Typography>
            </Box>

            {/* Desktop Navigation Links */}
            <Box sx={{ flexGrow: 1, overflowY: "auto", px: 1 }}>
              {" "}
              {/* Makes nav scrollable if needed */}
              <Button
                fullWidth
                sx={{
                  justifyContent: "flex-start",
                  mb: 1,
                  textAlign: "left",
                  padding: "8px 16px",
                }}
                component={RouterLink}
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
                sx={{
                  justifyContent: "flex-start",
                  mb: 1,
                  textAlign: "left",
                  padding: "8px 16px",
                }}
                onClick={() => toast("Search not implemented")}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <SearchIcon />
                </ListItemIcon>
                <ListItemText primary="Search" />
              </Button>
              <Button
                fullWidth
                sx={{
                  justifyContent: "flex-start",
                  mb: 1,
                  textAlign: "left",
                  padding: "8px 16px",
                }}
                onClick={() => toast("Flix not implemented")}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <VideoLibraryIcon />
                </ListItemIcon>
                <ListItemText primary="Flix" />
              </Button>
              <Button
                fullWidth
                sx={{
                  justifyContent: "flex-start",
                  mb: 1,
                  textAlign: "left",
                  padding: "8px 16px",
                }}
                component={RouterLink}
                to="/create"
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CreateIcon />
                </ListItemIcon>
                <ListItemText primary="Create" />
              </Button>
            </Box>

            {/* Desktop Auth/User Controls */}
            <Box sx={{ p: 2, mt: "auto" }}>
              {" "}
              {/* Align to bottom */}
              {!user && !signer ? (
                <Box>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setLoginOpen(true)}
                    sx={{ mb: 1 }}
                  >
                    Login
                  </Button>
                  <Button fullWidth variant="contained" onClick={() => setSignupOpen(true)}>
                    Sign Up
                  </Button>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <Tooltip title="Open menu">
                    <IconButton onClick={handleOpenUserMenu} sx={{ p: 0, mb: 1 }}>
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
                  <Typography variant="caption" sx={{ mb: 1, textAlign: "center" }}>
                    {loggedInUserProfile?.displayName || user?.npub.substring(0, 8) + "..."}
                  </Typography>
                  <IconButton onClick={toggleThemeMode} color="inherit">
                    {themeMode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
                  </IconButton>
                  {/* User Menu (for profile, settings, logout on desktop) */}
                  <Menu
                    id="user-menu-desktop"
                    anchorEl={anchorElUser}
                    open={Boolean(anchorElUser)}
                    onClose={handleCloseUserMenu}
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "left" }}
                  >
                    <MenuItem
                      component={RouterLink}
                      to={`/profile/${user?.npub}`}
                      onClick={handleCloseUserMenu}
                    >
                      Profile
                    </MenuItem>
                    <MenuItem component={RouterLink} to="/settings" onClick={handleCloseUserMenu}>
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
            //ml: isDesktop ? '240px' : 0, // RESTORED Offset for desktop menu
            pb: isDesktop ? 0 : "56px", // Padding at bottom for mobile nav
            overflowY: "auto", // Allow content scrolling
            height: "100vh",
            //p: 0, // padding handled by pages/content
          }}
        >
          {/* Container removed, Routes rendered directly in Box */}
          <Routes>
            <Route path="/" element={<GlobalFeedPage />} />
            <Route path="/following" element={<FollowingFeedPage />} />
            <Route path="/profile/:npub" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/t/:hashtag" element={<HashtagFeedPage />} />
            <Route path="/n/:nevent" element={<ThreadPage />} />
            <Route path="/create" element={<CreatePostPage />} />
          </Routes>
        </Box>

        {!isDesktop && (
          // Mobile Bottom AppBar
          <AppBar
            position="fixed"
            color="inherit"
            sx={{ top: "auto", bottom: 0, borderTop: "1px solid divider" }}
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
                onClick={handleOpenMobileMenu}
                id="mobile-overflow-button"
              >
                <MoreVertIcon />
              </IconButton>
              {/* Mobile Overflow Menu */}
              <Menu
                id="mobile-overflow-menu"
                anchorEl={mobileMenuAnchorEl}
                open={Boolean(mobileMenuAnchorEl)}
                onClose={handleCloseMobileMenu}
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
                transformOrigin={{ vertical: "bottom", horizontal: "right" }}
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
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <SignUpModal open={signupOpen} onClose={() => setSignupOpen(false)} />
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
