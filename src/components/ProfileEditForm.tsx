// src/components/ProfileEditForm.tsx
import React, { useState, useCallback, ChangeEvent, useRef } from 'react';
import { NDKUser, NDKUserProfile, NDKEvent, NDKKind, NDKSigner } from '@nostr-dev-kit/ndk';
import { useNdk } from '../contexts/NdkContext';
import toast from 'react-hot-toast';
import { sha256 } from 'js-sha256';
// MUI Imports
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Modal from '@mui/material/Modal';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Paper from '@mui/material/Paper'; // Use Paper for modal content background
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';

// Copy/adapt upload logic
const calculateSha256 = async (inputBlob: Blob): Promise<string> => { return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=(e)=>{if(e.target?.result instanceof ArrayBuffer){resolve(sha256(e.target.result))}else{reject(new Error("ArrBuf fail"))}};r.onerror=(e)=>{reject(new Error(`Read fail:${e}`))};r.readAsArrayBuffer(inputBlob)}); };
const uploadFileToBlossom = async ( ndk: NDK, signer: NDKSigner, uploadBlob: Blob, serverApiUrl: string, fileHash: string ): Promise<{ url: string; hash: string; mimeType: string }> => {
    const controlEvent = new NDKEvent(ndk); controlEvent.kind = 24242 as NDKKind; controlEvent.created_at = Math.floor(Date.now() / 1000); controlEvent.tags = [ ['t', 'upload'], ['x', fileHash], ['expiration', `${Math.floor(Date.now() / 1000) + 60 * 60}`] ];
    await controlEvent.sign(signer);
    await controlEvent.publish();
    await new Promise(resolve => setTimeout(resolve, 3000));
    const putUrl = `${serverApiUrl.replace(/\/$/, '')}/upload`;
    let authHeader = ''; try { const rE=controlEvent.rawEvent(); if(!rE.id||!rE.sig)throw new Error("Ctrl evt invalid"); authHeader=`Nostr ${btoa(JSON.stringify(rE))}`; } catch (e:any){throw new Error(`Auth prep fail: ${e.message}`)} 
    try {
        const response = await fetch(putUrl, { method: 'PUT', headers: { 'Authorization': authHeader, 'Content-Type': uploadBlob.type, 'Content-Length': uploadBlob.size.toString() }, body: uploadBlob, });
        if (!response.ok) { let eB=''; try{eB=await response.text()}catch(e){eB=`${response.status}`}; throw new Error(`PUT Err: ${eB}`); }
        let rUrl='', rHash=''; const fH=controlEvent.tagValue('x')||''; try { const bD=await response.json(); rUrl=bD?.url||bD?.link||`${serverApiUrl.replace(/\/$/,'')}/${fH}`; rHash=bD?.sha256||fH; if(!rUrl||!rHash) throw new Error("Desc missing URL/Hash"); } catch(e){ if(!fH)throw new Error("JSON fail&no hash"); rUrl=`${serverApiUrl.replace(/\/$/,'')}/${fH}`; rHash=fH; }
        return { url: rUrl, hash: rHash, mimeType: uploadBlob.type };
    } catch (error: any) { throw new Error(`${error.message|| 'PUT Unknown'}`); }
};

interface ProfileEditFormProps {
    currentUser: NDKUser;
    currentProfile: NDKUserProfile;
    onClose: () => void;
    onProfileUpdate: () => void;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({ currentUser, currentProfile, onClose, onProfileUpdate }) => {
    const { ndk, signer } = useNdk();
    const [name, setName] = useState(currentProfile.name || '');
    const [displayName, setDisplayName] = useState(currentProfile.display_name || currentProfile.displayName || '');
    const [about, setAbout] = useState(currentProfile.about || '');
    const [website, setWebsite] = useState(currentProfile.website || '');
    const [lud16, setLud16] = useState(currentProfile.lud16 || '');
    const [nip05, setNip05] = useState(currentProfile.nip05 || '');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(currentProfile.picture || currentProfile.image || null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(currentProfile.banner || null);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
             const reader = new FileReader();
             reader.onloadend = () => {
                 if (type === 'avatar') { setAvatarFile(file); setAvatarPreview(reader.result as string); }
                 else { setBannerFile(file); setBannerPreview(reader.result as string); }
             };
             reader.readAsDataURL(file);
        } else if (file) { toast.error("Select image."); }
         event.target.value = '';
    };

    const handleSaveProfile = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (!signer || !ndk) { toast.error("Signer/NDK NI."); return; }
        setIsSaving(true); setUploadStatus('');
        const toastId = toast.loading("Saving...");
        const uploadServerUrl = "https://blossom.primal.net";
        let finalAvatarUrl = currentProfile.picture || currentProfile.image;
        let finalBannerUrl = currentProfile.banner;

        try {
            if (avatarFile) {
                 toast.loading("Uploading avatar...", { id: toastId }); setUploadStatus('Hashing avatar...');
                 const hash = await calculateSha256(avatarFile);
                 setUploadStatus(`Authorizing avatar...`);
                 const result = await uploadFileToBlossom(ndk, signer as NDKSigner, avatarFile, uploadServerUrl, hash);
                 finalAvatarUrl = result.url;
                 setUploadStatus('Avatar uploaded!');
            }
            if (bannerFile) {
                 toast.loading("Uploading banner...", { id: toastId }); setUploadStatus('Hashing banner...');
                 const hash = await calculateSha256(bannerFile);
                 setUploadStatus(`Authorizing banner...`);
                 const result = await uploadFileToBlossom(ndk, signer as NDKSigner, bannerFile, uploadServerUrl, hash);
                 finalBannerUrl = result.url;
                 setUploadStatus('Banner uploaded!');
            }

            toast.loading("Constructing event...", { id: toastId });
            const newProfileContent: NDKUserProfile = {
                ...currentProfile,
                name: name.trim() || undefined,
                display_name: displayName.trim() || undefined,
                about: about.trim() || undefined,
                website: website.trim() || undefined,
                lud16: lud16.trim() || undefined,
                nip05: nip05.trim() || undefined,
                picture: finalAvatarUrl || undefined,
                banner: finalBannerUrl || undefined,
            };
            for (const key in newProfileContent) { if (newProfileContent[key as keyof NDKUserProfile] === undefined || newProfileContent[key as keyof NDKUserProfile] === '') { delete newProfileContent[key as keyof NDKUserProfile]; } }

            const profileEvent = new NDKEvent(ndk); profileEvent.kind = NDKKind.Metadata; profileEvent.content = JSON.stringify(newProfileContent);
            toast.loading("Signing & Publishing...", { id: toastId });
            await profileEvent.sign(signer as NDKSigner);
            const publishedTo = await profileEvent.publish();

            if (publishedTo.size > 0) {
                onProfileUpdate();
                toast.success("Profile saved!", { id: toastId });
                onClose();
            } else { throw new Error("Publish failed."); }

        } catch (error: any) { toast.error(`Save failed: ${error.message || 'Unknown'}`, { id: toastId }); }
        finally { setIsSaving(false); setUploadStatus(''); }

    }, [ ndk, signer, onClose, onProfileUpdate, currentProfile, name, displayName, about, website, lud16, nip05, avatarFile, bannerFile ]);

    return (
        <Modal
             open={true} // Controlled by parent
             onClose={onClose}
             aria-labelledby="edit-profile-modal-title"
        >
            <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '95%', sm: '85%', md: 700 }, maxHeight: '90vh', overflowY: 'auto', outline: 'none' }}>
                 <Paper sx={{ p: { xs: 2, sm: 3, md: 4 } }}> {/* Use Paper */} 
                     <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                        <Typography id="edit-profile-modal-title" variant="h6" component="h2">
                            Edit Profile
                        </Typography>
                        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
                     </Box>

                     <Box component="form" onSubmit={handleSaveProfile} noValidate>
                         {/* Avatar / Banner in Grid */}
                          <Grid container spacing={3} sx={{mb: 2}}>
                              <Grid item xs={12} sm={6}>
                                 <Typography variant="subtitle2" gutterBottom>Avatar (picture)</Typography>
                                 {avatarPreview && <img src={avatarPreview} alt="Avatar Preview" style={{maxWidth:'80px',maxHeight:'80px',marginBottom:'10px',display:'block',borderRadius:'50%'}}/>}
                                 <Button variant="outlined" size="small" component="label" disabled={isSaving}>
                                      {avatarFile ? "Change Avatar" : "Upload Avatar"}
                                      <input type="file" accept="image/*" hidden onChange={(e) => handleImageChange(e, 'avatar')} />
                                  </Button>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                  <Typography variant="subtitle2" gutterBottom>Banner</Typography>
                                  {bannerPreview && <img src={bannerPreview} alt="Banner Preview" style={{maxWidth:'100%',maxHeight:'100px',marginBottom:'10px',display:'block'}}/>}
                                  <Button variant="outlined" size="small" component="label" disabled={isSaving}>
                                       {bannerFile ? "Change Banner" : "Upload Banner"}
                                      <input type="file" accept="image/*" hidden onChange={(e) => handleImageChange(e, 'banner')} />
                                  </Button>
                              </Grid>
                          </Grid>
                         <Divider sx={{ my: 2 }}/>

                         {/* Text Fields */} 
                          <TextField id="displayName" label="Display Name (display_name)" fullWidth margin="dense" variant="outlined" size="small" value={displayName} onChange={(e)=>setDisplayName(e.target.value)} disabled={isSaving} helperText="Your preferred name shown publicly."/>
                          <TextField id="name" label="Username (name)" fullWidth margin="dense" variant="outlined" size="small" value={name} onChange={(e)=>setName(e.target.value)} disabled={isSaving} placeholder="alphanumeric_underscores" helperText="A short identifier that isn't unique."/>
                          <TextField id="about" label="About" multiline rows={3} fullWidth margin="dense" variant="outlined" size="small" value={about} onChange={(e)=>setAbout(e.target.value)} disabled={isSaving} helperText="A short biography or description about yourself."/>
                          <TextField id="website" label="Website" type="url" fullWidth margin="dense" variant="outlined" size="small" value={website} onChange={(e)=>setWebsite(e.target.value)} disabled={isSaving} placeholder="https://..." helperText="A link to your personal or professional website."/>
                          <TextField id="lud16" label="Lightning Address (LUD-16)" fullWidth margin="dense" variant="outlined" size="small" value={lud16} onChange={(e)=>setLud16(e.target.value)} disabled={isSaving} placeholder="name@domain.com" helperText="Your Lightning Network address for receiving Zaps."/>
                          <TextField id="nip05" label="Nostr Address (NIP-05)" fullWidth margin="dense" variant="outlined" size="small" value={nip05} onChange={(e)=>setNip05(e.target.value)} disabled={isSaving} placeholder="name@domain.com" helperText="A human-readable, verifiable identifier (requires server setup)."/>

                         {/* Status & Buttons */} 
                         {uploadStatus && <Typography variant="caption" color="primary" sx={{display: 'block', mt: 1}}>{uploadStatus}</Typography>}
                         <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                             <Button onClick={onClose} disabled={isSaving} variant="outlined">Cancel</Button>
                             <Button type="submit" variant="contained" disabled={isSaving} startIcon={isSaving ? <CircularProgress size={20} color="inherit"/> : null}>
                                 {isSaving ? 'Saving...' : 'Save Profile'}
                             </Button>
                         </Box>
                     </Box>
                 </Paper>
            </Box>
        </Modal>
    );
};