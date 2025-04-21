// src/App.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Route, Routes, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Slide from '@mui/material/Slide';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { Toaster } from 'react-hot-toast';
import { useNdk } from './contexts/NdkContext';
import { GlobalFeedPage } from './pages/GlobalFeedPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { HashtagFeedPage } from './pages/HashtagFeedPage'; 
import { ThreadPage } from './pages/ThreadPage';
import { FollowingFeedPage } from './pages/FollowingFeedPage';
import { LoginModal } from './components/LoginModal';
import { SignUpModal } from './components/SignUpModal';
import { createAppTheme } from './theme';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

function AppContent() {
    const { ndk, user, signer, logout, themeMode, toggleThemeMode } = useNdk();
    const [avatarImageUrl, setAvatarImageUrl] = useState<string | undefined>(undefined);
    const [loginOpen, setLoginOpen] = useState(false);
    const [signupOpen, setSignupOpen] = useState(false);
    const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [isAppBarVisible, setIsAppBarVisible] = useState(true);
    const lastScrollY = useRef(0);
    const appBarHideThreshold = 10;
    const scrollUpBuffer = 5;

    // Sync local avatar state with context user profile
    useEffect(() => {
        if (user) {
            const currentImage = user.profile?.image?.startsWith('http') ? user.profile.image : undefined;
            setAvatarImageUrl(currentImage);
            // Optional: Re-fetch profile if needed
            // user.fetchProfile({cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST})... 
        } else {
            setAvatarImageUrl(undefined);
        }
    }, [user]); 

    const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElUser(event.currentTarget);
    const handleCloseUserMenu = () => setAnchorElUser(null);
    const handleLogout = () => { logout(); handleCloseUserMenu(); };
    
    const handleScroll = useCallback(() => {
        const currentScrollY = window.scrollY;
        if (currentScrollY < appBarHideThreshold) {
            setIsAppBarVisible(true);
        } else if (currentScrollY > lastScrollY.current + appBarHideThreshold && isAppBarVisible) {
             setIsAppBarVisible(false);
        } else if (lastScrollY.current - currentScrollY > scrollUpBuffer && !isAppBarVisible) {
            setIsAppBarVisible(true);
        }
        lastScrollY.current = currentScrollY <= 0 ? 0 : currentScrollY;
    }, [isAppBarVisible]);
    
    useEffect(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => { window.removeEventListener('scroll', handleScroll); };
    }, [handleScroll]);

    const userInitial = user?.profile?.displayName?.charAt(0)?.toUpperCase() ||
                        user?.profile?.name?.charAt(0)?.toUpperCase() ||
                        (user ? 'N' : '');
    
    const dynamicTheme = useMemo(() => createTheme(createAppTheme(themeMode)), [themeMode]);
    const handleTabChange = (event: React.SyntheticEvent, newValue: string) => navigate(newValue);
    
    const getCurrentTab = () => {
        const currentPath = location?.pathname;
        if (currentPath === '/') return '/'; 
        if (currentPath?.startsWith('/following')) return '/following';
        return false; 
   };

    return (
        <ThemeProvider theme={dynamicTheme}>
            <CssBaseline />
            <Slide appear={false} direction="down" in={isAppBarVisible}>
                <AppBar position="fixed" color="inherit" elevation={1}>
                    <Toolbar>
                        {/* Logo and Tabs */} 
                        <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', color: 'inherit', textDecoration: 'none', mr: 2 }}>
                            <img src="/zappix-logo.png" alt="Zappix Logo" style={{ height: '30px', marginRight: '10px' }} />
                            <Typography variant="h6" noWrap component="div">Zappix</Typography>
                        </Box>
                        <Tabs value={getCurrentTab()} onChange={handleTabChange} textColor="inherit" indicatorColor="primary" aria-label="feed navigation tabs" sx={{ minHeight: 'auto' }}>
                             <Tab label="Global" value="/" sx={{ minHeight: 'auto', minWidth: 'auto', px: 2, py: 1 }}/>
                            {user && <Tab label="Following" value="/following" sx={{ minHeight: 'auto', minWidth: 'auto', px: 2, py: 1 }}/>}
                        </Tabs>
                         <Box sx={{ flexGrow: 1 }} />
                         {/* Login/Signup Buttons */} 
                        {!user && !signer && (<><Button color="inherit" onClick={() => setLoginOpen(true)}>Login</Button><Button color="inherit" onClick={() => setSignupOpen(true)}>Sign Up</Button></>)}
                        {/* User Menu */} 
                        {signer && user && (
                            <Box sx={{ flexGrow: 0, ml: 1 }}>
                                <Tooltip title="Open menu">
                                    <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                                         <Avatar alt={user.profile?.displayName || user.profile?.name || 'User'} src={avatarImageUrl} >{!avatarImageUrl ? userInitial : null}</Avatar>
                                    </IconButton>
                                </Tooltip>
                                <Menu sx={{ mt: '45px' }} id="menu-appbar" anchorEl={anchorElUser} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} keepMounted transformOrigin={{ vertical: 'top', horizontal: 'right' }} open={Boolean(anchorElUser)} onClose={handleCloseUserMenu}>
                                     <MenuItem component={RouterLink} to={`/profile/${user.npub}`} onClick={handleCloseUserMenu}><ListItemText>Profile</ListItemText></MenuItem>
                                     <MenuItem component={RouterLink} to="/settings" onClick={handleCloseUserMenu}><ListItemText>Settings</ListItemText></MenuItem>
                                     <MenuItem onClick={() => { toggleThemeMode(); }}><ListItemIcon>{themeMode === 'dark' ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}</ListItemIcon><ListItemText>{themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}</ListItemText></MenuItem>
                                     <MenuItem onClick={handleLogout}><ListItemText>Logout</ListItemText></MenuItem>
                                </Menu>
                            </Box>
                        )}
                    </Toolbar>
                </AppBar>
            </Slide>
            <Toolbar />
            <Container maxWidth="lg" sx={{ pt: 2, pb: 4, mx: 'auto' }}>
                 <Routes>
                      <Route path="/" element={<GlobalFeedPage />} />
                      <Route path="/following" element={<FollowingFeedPage />} />
                      <Route path="/profile/:npub" element={<ProfilePage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/t/:hashtag" element={<HashtagFeedPage />} /> 
                      <Route path="/n/:nevent" element={<ThreadPage />} />
                 </Routes>
             </Container>
            <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSignUpClick={() => { setLoginOpen(false); setSignupOpen(true); }} />
            <SignUpModal open={signupOpen} onClose={() => setSignupOpen(false)} />
            <Toaster position="bottom-center" />
        </ThemeProvider>
    );
}

function App() {
    return <AppContent />;
}

export default App;
