// src/components/ProfileEditForm.tsx
import React, { useState, useEffect, useRef } from 'react';
import { NDKUserProfile, NDKEvent } from '@nostr-dev-kit/ndk';
import { useNdk } from '../contexts/NdkContext';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton'; // Added
import InputAdornment from '@mui/material/InputAdornment'; // Added
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'; // Added
import toast from 'react-hot-toast';

interface ProfileEditFormProps {
    open: boolean;
    onClose: () => void;
    onSave: (updatedProfile: NDKUserProfile) => void;
    currentUserProfile: NDKUserProfile | null;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
    open,
    onClose,
    onSave,
    currentUserProfile,
}) => {
    const { ndk, user, signer } = useNdk();
    const [profile, setProfile] = useState<NDKUserProfile>({});
    const [isSaving, setIsSaving] = useState(false);

    // Refs for hidden file inputs
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (currentUserProfile) {
            setProfile(currentUserProfile);
        } else {
            setProfile({});
        }
    }, [currentUserProfile, open]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!ndk || !user || !signer) {
            toast.error("Cannot save profile: NDK, user, or signer missing.");
            return;
        }
        setIsSaving(true);
        const profileToSave = { ...profile };
        Object.keys(profileToSave).forEach(key => {
            const k = key as keyof NDKUserProfile;
            if (profileToSave[k] === '' || profileToSave[k] === null) {
                delete profileToSave[k];
            }
        });
        console.log("Attempting to save profile:", profileToSave);
        try {
            const event = new NDKEvent(ndk);
            event.kind = 0;
            event.content = JSON.stringify(profileToSave);
            event.created_at = Math.floor(Date.now() / 1000);
            await event.sign(signer);
            const publishedRelays = await event.publish();
            if (publishedRelays.size > 0) {
                toast.success(`Profile updated on ${publishedRelays.size} relays!`);
                onSave(profileToSave);
            } else {
                toast.error("Failed to publish profile update to any connected write relays.");
            }
        } catch (error) {
            console.error("Error saving profile:", error);
            toast.error(`Failed to save profile: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Upload Handlers (Stage 1: UI Only) ---
    const handleUploadIconClick = (ref: React.RefObject<HTMLInputElement>) => {
        ref.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, fieldName: keyof NDKUserProfile) => {
        const file = event.target.files?.[0];
        if (file) {
            console.log(`File selected for ${fieldName}:`, file.name, file.type, file.size);
            // TODO: Implement NIP-96 upload logic here
            toast('Image upload not yet implemented. Please paste URL manually.');
            
            // Example: Simulate upload and set URL (remove this in real implementation)
            // const simulateUpload = async () => {
            //     // Show loading indicator
            //     await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
            //     const fakeUrl = `https://example.com/uploads/${fieldName}_${Date.now()}.jpg`;
            //     setProfile(prev => ({ ...prev, [fieldName]: fakeUrl }));
            //     toast.success('Simulated upload complete!');
            //     // Hide loading indicator
            // };
            // simulateUpload();
        }
        // Reset file input value so the same file can be selected again if needed
        event.target.value = ''; 
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit Your Profile</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {/* Standard Fields */}
                    <TextField
                        label="Display Name"
                        name="displayName"
                        value={profile.displayName || ''}
                        onChange={handleChange}
                        fullWidth
                    />
                    <TextField
                        label="Username (handle)"
                        name="name"
                        value={profile.name || ''}
                        onChange={handleChange}
                        fullWidth
                    />
                    <TextField
                        label="About"
                        name="about"
                        value={profile.about || ''}
                        onChange={handleChange}
                        fullWidth
                        multiline
                        rows={3}
                    />
                    
                    {/* Avatar Upload */}
                    <TextField
                        label="Profile Picture URL"
                        name="image"
                        value={profile.image || ''}
                        onChange={handleChange}
                        fullWidth
                        type="url"
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label="upload picture"
                                        onClick={() => handleUploadIconClick(avatarInputRef)}
                                        edge="end"
                                    >
                                        <PhotoCameraIcon />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => handleFileChange(e, 'image')}
                    />
                    
                    {/* Banner Upload */}
                     <TextField
                        label="Banner URL"
                        name="banner"
                        value={profile.banner || ''}
                        onChange={handleChange}
                        fullWidth
                        type="url"
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label="upload banner"
                                        onClick={() => handleUploadIconClick(bannerInputRef)}
                                        edge="end"
                                    >
                                        <PhotoCameraIcon />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                     <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => handleFileChange(e, 'banner')}
                    />

                    {/* Other Fields */}
                    <TextField
                        label="Website URL"
                        name="website"
                        value={profile.website || ''}
                        onChange={handleChange}
                        fullWidth
                        type="url"
                    />
                    <TextField
                        label="Nostr Address (NIP-05)"
                        name="nip05"
                        value={profile.nip05 || ''}
                        onChange={handleChange}
                        fullWidth
                    />
                    <TextField
                        label="Lightning Address (LUD-16)"
                        name="lud16"
                        value={profile.lud16 || ''}
                        onChange={handleChange}
                        fullWidth
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={isSaving}>
                    {isSaving ? <CircularProgress size={24} /> : 'Save Profile'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
