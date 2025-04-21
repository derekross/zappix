// src/components/SignUpModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
// Only import getPublicKey and nip19 from nostr-tools
import { getPublicKey, nip19 } from 'nostr-tools';
import { useNdk } from '../contexts/NdkContext';
// MUI Imports
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Modal from '@mui/material/Modal';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CircularProgress from '@mui/material/CircularProgress';
import toast from 'react-hot-toast';

interface SignUpModalProps {
    open: boolean;
    onClose: () => void;
}

export function SignUpModal({ open, onClose }: SignUpModalProps) {
    const { loginWithNsec } = useNdk();
    const [nsec, setNsec] = useState('');
    const [npub, setNpub] = useState('');
    const [generated, setGenerated] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Generate keys using window.crypto and nostr-tools getPublicKey/nip19
    const generateKeys = useCallback(() => {
         setIsGenerating(true); setGenerated(false); setNsec(''); setNpub('');
         setTimeout(() => {
             try {
                 if (!window.crypto || !window.crypto.getRandomValues) {
                     throw new Error("Web Crypto API not available in this browser.");
                 }
                 // 1. Generate 32 random bytes for the private key
                 const skBytes = window.crypto.getRandomValues(new Uint8Array(32));

                 // 2. Get public key hex using nostr-tools function
                 const pkHex = getPublicKey(skBytes); // Pass bytes directly

                 // 3. Encode keys using nip19
                 const generatedNsec = nip19.nsecEncode(skBytes); // nip19 expects bytes
                 const generatedNpub = nip19.npubEncode(pkHex); // nip19 expects hex

                 setNsec(generatedNsec);
                 setNpub(generatedNpub);
                 setGenerated(true);
                 toast.success("New keys generated!");
             } catch (e:any) {
                 console.error("Key generation failed:", e);
                 toast.error(`Failed to generate keys: ${e.message || 'Unknown error'}`);
             } finally {
                 setIsGenerating(false);
             }
         }, 50);
    }, []); // No nostr-tools key gen deps needed

    // Optionally generate immediately when modal opens if nsec is empty
    useEffect(() => {
        if (open && !generated && !isGenerating) {
            generateKeys();
        }
        // Reset if modal closes
        if (!open) {
             setGenerated(false);
             setNsec('');
             setNpub('');
        }
    }, [open, generated, isGenerating, generateKeys]);

    const copyToClipboard = (text: string, type: string) => {
        navigator.clipboard.writeText(text)
            .then(() => toast.success(`${type} copied!`))
            .catch(err => toast.error(`Failed to copy ${type}.`));
    };

    const handleLoginWithGeneratedKey = useCallback(async () => {
         if (!nsec) { toast.error("No key generated."); return; }
         setIsLoggingIn(true);
         const toastId = toast.loading("Logging in...");
         try {
             await loginWithNsec(nsec);
             toast.success("Logged in!", { id: toastId });
             onClose(); // Close modal on successful login
         } catch (err: any) {
             toast.error(`Login failed: ${err.message}`, { id: toastId });
         } finally {
              setIsLoggingIn(false);
         }
    }, [loginWithNsec, onClose, nsec]);

    return (
        <Modal open={open} onClose={onClose} aria-labelledby="signup-modal-title">
            <Box sx={{ 
                 position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                 width: { xs: '90%', sm: 500 }, bgcolor: 'background.paper', border: '1px solid #ccc',
                 boxShadow: 24, p: { xs: 2, sm: 3 }, borderRadius: 2, outline: 'none'
            }}>
                 <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                     <Typography id="signup-modal-title" variant="h6" component="h2"> Generate New Keys </Typography>
                     <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
                 </Box>

                 {(isGenerating) && (
                      <Box sx={{display: 'flex', justifyContent:'center', alignItems:'center', p: 3}}>
                         <CircularProgress />
                         <Typography sx={{ml: 2}}>Generating keys...</Typography>
                      </Box>
                 )}

                 {!isGenerating && !generated && (
                     <Button onClick={generateKeys} variant="contained">Generate Keys</Button>
                 )}

                 {generated && (
                     <>
                         <Alert severity="warning" sx={{ mb: 2 }}>
                             **IMPORTANT:** Save your **Secret Key (nsec)** somewhere safe (password manager). If you lose it, you lose access to your account. **Do not share it with anyone.**
                         </Alert>
                         <TextField
                             label="Public Key (npub)"
                             value={npub}
                             fullWidth margin="normal" variant="outlined" size="small"
                             InputProps={{
                                 readOnly: true,
                                 endAdornment: <IconButton onClick={() => copyToClipboard(npub, 'Public Key')} edge="end" title="Copy Public Key"><ContentCopyIcon fontSize="small"/></IconButton>
                             }}
                             helperText="Share this publicly. Others use it to find you."
                         />
                          <TextField
                             label="Secret Key (nsec)"
                             type="password" // Mask the key
                             value={nsec}
                             fullWidth margin="normal" variant="outlined" size="small"
                             InputProps={{
                                 readOnly: true,
                                 endAdornment: <IconButton onClick={() => copyToClipboard(nsec, 'Secret Key')} edge="end" title="Copy Secret Key"><ContentCopyIcon fontSize="small"/></IconButton>
                             }}
                             helperText="KEEP THIS SECRET! Needed to log in."
                             sx={{mb: 2}}
                         />
                         <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 1}}> 
                             <Button onClick={handleLoginWithGeneratedKey} variant="contained" color="primary" disabled={isLoggingIn}>
                                  {isLoggingIn ? <CircularProgress size={24} color="inherit"/> : "Login with this New Key"}
                             </Button>
                             <Button onClick={generateKeys} variant="outlined" disabled={isLoggingIn || isGenerating}>
                                 Regenerate
                             </Button>
                         </Box>
                     </>
                 )}
            </Box>
        </Modal>
    );
}