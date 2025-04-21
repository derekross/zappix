import React, { useState, ChangeEvent } from 'react';
import { useNdk } from '../contexts/NdkContext';
// MUI Imports
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import PasswordIcon from '@mui/icons-material/Password'; // Example icon
import ExtensionIcon from '@mui/icons-material/Extension'; // Example icon

export function Login() {
    const { user, loginWithNip07, loginWithNsec, logout, isLoading } = useNdk();
    const [error, setError] = useState<string | null>(null);
    const [nsecInput, setNsecInput] = useState<string>('');
    const [loginMethodLoading, setLoginMethodLoading] = useState<'nip07' | 'nsec' | null>(null);

    const handleNip07Login = async () => {
        setError(null);
        setLoginMethodLoading('nip07');
        try {
            await loginWithNip07();
        } catch (err: any) {
            setError(err.message || "Failed to login with extension.");
        } finally {
             setLoginMethodLoading(null);
        }
    };

    const handleNsecLogin = async () => {
        setError(null);
        if (!nsecInput.trim() || !nsecInput.startsWith('nsec1')) {
             setError("Invalid NSEC format. Must start with 'nsec1'.");
             return;
        }
        setLoginMethodLoading('nsec');
        try {
             await loginWithNsec(nsecInput.trim());
             setNsecInput('');
        } catch (err: any) {
             setError(err.message || "Failed to login with NSEC.");
        } finally {
             setLoginMethodLoading(null);
        }
     };

    const handleLogout = () => {
        setError(null); setNsecInput(''); logout();
    };

    // Show loading state
    if (isLoading) {
        return <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}><CircularProgress size={20} /><Typography>Loading User...</Typography></Box>;
    }

    // Display user info if logged in
    if (user) {
        return (
             <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                 <Typography variant="body1" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                     Logged in as: {user.npub}
                 </Typography>
                 <Button variant="outlined" size="small" onClick={handleLogout}>Logout</Button>
             </Box>
        );
    }

    // Display login options if not logged in
    return (
        <Box>
             <Typography variant="h6" gutterBottom>Login Options</Typography>

             {/* NIP-07 Option */}
             <Box sx={{ mb: 2 }}>
                 <Button
                     variant="contained"
                     startIcon={loginMethodLoading === 'nip07' ? <CircularProgress size={20} color="inherit" /> : <ExtensionIcon />}
                     onClick={handleNip07Login}
                     disabled={!!loginMethodLoading} // Disable while any login is processing
                 >
                     Login with Extension (Recommended)
                 </Button>
                 <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                     Uses a browser extension (Alby, nos2x, etc.) to securely manage your keys.
                 </Typography>
             </Box>

             <Divider sx={{ my: 2 }}>OR</Divider>

             {/* NSEC Option */}
             <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>Login with Secret Key (nsec):</Typography>
                   <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                       <TextField
                           id='nsecInput'
                           type="password"
                           size="small"
                           value={nsecInput}
                           onChange={(e: ChangeEvent<HTMLInputElement>) => setNsecInput(e.target.value)}
                           placeholder="nsec1..."
                           sx={{ flexGrow: 1, minWidth: '250px' }}
                           disabled={!!loginMethodLoading}
                           error={!!error && nsecInput.length > 0 && !error.includes('extension')} // Only show error if related to nsec
                           aria-describedby={error && nsecInput.length > 0 && !error.includes('extension') ? "nsec-error-text" : undefined}
                       />
                       <Button
                          variant="outlined"
                          startIcon={loginMethodLoading === 'nsec' ? <CircularProgress size={20} color="inherit" /> : <PasswordIcon />}
                          onClick={handleNsecLogin}
                          disabled={!!loginMethodLoading || !nsecInput.startsWith('nsec1')}
                        >
                          Login
                       </Button>
                   </Box>
                  <Typography variant="caption" display="block" sx={{ mt: 1, color: 'error.main' }}>
                     ⚠️ Warning: Less secure. Use extensions if possible.
                 </Typography>
             </Box>

             {/* General Error Display */} 
             {error && <Alert severity="error" sx={{ mt: 2 }} id="nsec-error-text">{error}</Alert>}
        </Box>
    );
}