// src/components/UploadForm.tsx
import React, { useState, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import { useNdk } from '../contexts/NdkContext';
import { NDKEvent, NDKKind, NDKNip07Signer, NDKSigner } from '@nostr-dev-kit/ndk';
import { sha256 } from 'js-sha256';
import { encode as blurhashEncode } from 'blurhash';
import ngeohash from 'ngeohash';
import toast from 'react-hot-toast';
// MUI Imports
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';

interface BlossomServer { name: string; apiUrl: string; }
const BLOSSOM_SERVERS: BlossomServer[] = [
    { name: "blossom.band", apiUrl: "https://blossom.band" },
    { name: "blossom.primal.net", apiUrl: "https://blossom.primal.net" },
    { name: "nostr.download (Mechanism Unknown)", apiUrl: "https://nostr.download/api/v2/blossom" },
];
const LOCAL_STORAGE_DEFAULT_BLOSSOM_SERVER_KEY = 'nostrImageAppDefaultBlossomServer';

interface ProcessedImageData {
    blob: Blob;
    hash: string;
    blurhash: string;
    dimensions: { width: number; height: number };
}

interface UploadFormProps {
    initialFile: File; // File is now required
    onUploadSuccess?: () => void;
    onCancel: () => void; // Callback for cancel button
}

// Blossom Upload - PUT /upload with Control Event Auth
const uploadFileToBlossom = async ( ndk: NDK, signer: NDKSigner, uploadBlob: Blob, serverApiUrl: string, fileHash: string ): Promise<{ url: string; hash: string; mimeType: string }> => {
    // ... (implementation remains same) ...
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


export const UploadForm: React.FC<UploadFormProps> = ({ initialFile, onUploadSuccess, onCancel }) => {
    const { ndk, signer, user } = useNdk();
    // State
    const [processedData, setProcessedData] = useState<ProcessedImageData | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [hashtags, setHashtags] = useState('');
    const [addLocation, setAddLocation] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number; geohash: string } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [addContentWarning, setAddContentWarning] = useState(false);
    const [contentWarningReason, setContentWarningReason] = useState('');
    const [selectedServerApiUrl, setSelectedServerApiUrl] = useState<string>(() => localStorage.getItem(LOCAL_STORAGE_DEFAULT_BLOSSOM_SERVER_KEY) || BLOSSOM_SERVERS[0].apiUrl);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Helpers
    const handleServerSelectChangeMUI = useCallback((event: SelectChangeEvent<string>) => { setSelectedServerApiUrl(event.target.value as string); }, []);
    const handleSetDefault = useCallback(() => { localStorage.setItem(LOCAL_STORAGE_DEFAULT_BLOSSOM_SERVER_KEY, selectedServerApiUrl); const n=BLOSSOM_SERVERS.find(s=>s.apiUrl===selectedServerApiUrl)?.name||selectedServerApiUrl; toast.success(`Default server saved: ${n}`); }, [selectedServerApiUrl]);
    const calculateSha256 = useCallback(async (inputBlob: Blob): Promise<string> => { /* ... */ return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=(e)=>{if(e.target?.result instanceof ArrayBuffer){resolve(sha256(e.target.result))}else{reject(new Error("ArrBuf fail"))}};r.onerror=(e)=>{reject(new Error(`Read fail:${e}`))};r.readAsArrayBuffer(inputBlob)}); }, []);
    const generateGeohash = useCallback((lat: number, lon: number): string => { try { return ngeohash.encode(lat, lon, 9); } catch (err: any) { console.error("Geohash fail:", err); toast.error(`Geohash fail: ${err.message}`); return ""; } }, []);
    const handleLocationToggle = useCallback(() => { const n=!addLocation;setAddLocation(n);setLocationError(null);if(n&&!currentLocation){if(!navigator.geolocation){toast.error("Geolocation NI");setAddLocation(false)}else{navigator.geolocation.getCurrentPosition((p)=>{const{latitude:lt,longitude:ln}=p.coords;const g=generateGeohash(lt,ln);if(g)setCurrentLocation({lat:lt,lon:ln,geohash:g});else setAddLocation(false);setLocationError(null)},(e)=>{console.error(e);toast.error(`Geo fail: ${e.message}`);setCurrentLocation(null);setAddLocation(false)})}}else if(!n){setCurrentLocation(null);setLocationError(null)} }, [addLocation, currentLocation, generateGeohash]);

    // --- Image Processing & Metadata Calculation ---
    const processAndGetImageData = useCallback(async (sourceFile: File): Promise<ProcessedImageData> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = async () => {
                    const canvas = canvasRef.current;
                    if (!canvas) return reject(new Error("Canvas NI"));
                    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
                    // Add willReadFrequently hint
                    const ctx = canvas.getContext('2d', { willReadFrequently: true }); 
                    if (!ctx) return reject(new Error("Ctx NI"));
                    ctx.drawImage(img, 0, 0);
                    let calculatedBlurhash = "";
                    try { 
                        const imageData = ctx.getImageData(0,0,canvas.width,canvas.height); 
                        calculatedBlurhash = blurhashEncode(imageData.data, iD.width, iD.height, 4, 3); 
                    } catch (e: any) { 
                        console.error("BH Err:", e); 
                        // Don't toast error here, handled in handleFileSelect
                        // toast.error("Warn: BH Fail"); 
                    }
                    canvas.toBlob(
                        async (blob) => {
                            if (!blob) return reject(new Error("Canvas Blob NI"));
                            try { const hash = await calculateSha256(blob); resolve({ blob, hash, blurhash: calculatedBlurhash, dimensions: { width: canvas.width, height: canvas.height } }); }
                            catch (hashError: any) { reject(new Error(`Hashing failed: ${hashError.message}`)); }
                        }, sourceFile.type, 0.9
                    );
                };
                img.onerror = (err) => reject(new Error(`Img load err: ${err}`));
                if (typeof event.target?.result === 'string') img.src = event.target.result; else reject(new Error("FileReader !string"));
            };
            reader.onerror = (err) => reject(new Error(`FileReader err: ${err}`));
            reader.readAsDataURL(sourceFile);
        });
    }, [canvasRef, calculateSha256]);

    // --- File Selection Handler (Corrected Toast ID usage) ---
    const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        // Reset state needed BEFORE processing
        setProcessedData(null); setPreviewUrl(null); 
        if (selectedFile) {
            if (!selectedFile.type.startsWith('image/')) { toast.error('img pls'); return; }
            setIsProcessingImage(true);
            const processToastId = toast.loading("Processing image..."); // Start loading toast
            try {
                const previewReader = new FileReader();
                previewReader.onloadend = () => { setPreviewUrl(previewReader.result as string); };
                previewReader.readAsDataURL(selectedFile);
                const data = await processAndGetImageData(selectedFile);
                setProcessedData(data); 
                toast.success("Image processed & ready.", { id: processToastId }); // Update toast
            } catch (err: any) { 
                console.error("Proc Fail:", err);
                toast.error(`Proc Fail: ${err.message}`, { id: processToastId }); // Update toast
                setPreviewUrl(null); 
            } finally {
                setIsProcessingImage(false);
            }
        }
    }, [processAndGetImageData]);

     // --- Effect to process the initialFile prop ---
     useEffect(() => {
        let isMounted = true;
        const processFile = async () => {
            if (!initialFile) return; // Guard if initialFile is null
            console.log("UploadForm: Processing initial file prop:", initialFile.name);
            setIsProcessingImage(true);
            setProcessedData(null); 
            setPreviewUrl(null);
            const processToastId = toast.loading("Processing image...");
            try {
                const reader = new FileReader();
                reader.onloadend = () => { if (isMounted) setPreviewUrl(reader.result as string); };
                reader.readAsDataURL(initialFile);
                const data = await processAndGetImageData(initialFile);
                if (isMounted) {
                    setProcessedData(data);
                    setDescription(prev => prev || initialFile.name.substring(0, initialFile.name.lastIndexOf('.')) || initialFile.name);
                    toast.success("Image ready.", { id: processToastId });
                }
            } catch (err: any) {
                console.error("Proc Fail:", err);
                toast.error(`Proc Fail: ${err.message}`, { id: processToastId });
                if (isMounted) setProcessedData(null); 
                onCancel(); // Close modal on error
            } finally {
                if (isMounted) setIsProcessingImage(false);
            }
        };
        processFile();
        return () => { isMounted = false; } 
    }, [initialFile, processAndGetImageData, onCancel]);

    // --- Main Submit Handler ---
    const handleSubmit = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (!processedData || !signer || !user) { toast.error('Cannot submit: Missing data, signer, or user.'); return; }
        if (!description.trim()) { toast.error('Description required.'); return; }
        if (addContentWarning && !contentWarningReason.trim()) { toast.error('CW Reason required.'); return; }
        const server = BLOSSOM_SERVERS.find(s => s.apiUrl === selectedServerApiUrl);
        if (!server || server.name.includes("Unknown")) { toast.error(`Invalid/Unsupported Server`); return; }

        setIsUploading(true); setIsPublishing(false);
        const processToastId = toast.loading(`Starting upload to ${server.name}...`);
        let signedControlEvent: NDKEvent | null = null;
        const { blob: processedBlob, hash: fileHash, blurhash: calculatedBlurhash, dimensions: calculatedDimensions } = processedData;
        try {
            setIsUploading(true); // Flag start of upload phase
            toast.loading('Publishing authorization...', { id: processToastId });
            const controlEvent = new NDKEvent(ndk);
            controlEvent.kind = 24242 as NDKKind; controlEvent.created_at = Math.floor(Date.now() / 1000);
            controlEvent.tags = [ ['t', 'upload'], ['x', fileHash], ['expiration', `${Math.floor(Date.now() / 1000) + 60 * 60}`] ];
            await controlEvent.sign(signer as NDKSigner);
            signedControlEvent = controlEvent;
            await controlEvent.publish();
            toast.loading(`Auth event sent. Uploading...`, { id: processToastId });
            await new Promise(resolve => setTimeout(resolve, 3000)); // Keep delay
            const uploadResult = await uploadFileToBlossom(ndk, signer as NDKSigner, processedBlob, server.apiUrl, fileHash);
            setIsUploading(false);
            setIsPublishing(true);
            const { url: imageUrl, hash: imageHashRes, mimeType } = uploadResult;
            toast.loading('Publishing post...', { id: processToastId });
            const kind20Event = new NDKEvent(ndk);
            kind20Event.kind = 20 as NDKKind; kind20Event.content = description.trim(); const tags: string[][] = []; const imetaTag = ['imeta'];
            imetaTag.push(`url ${imageUrl}`); imetaTag.push(`m ${mimeType}`); imetaTag.push(`x ${imageHashRes}`);
            imetaTag.push(`dim ${calculatedDimensions.width}x${calculatedDimensions.height}`);
            if (calculatedBlurhash) imetaTag.push(`blurhash ${calculatedBlurhash}`);
            imetaTag.push(`alt ${description.trim()}`); tags.push(imetaTag);
            tags.push(['x', imageHashRes]); tags.push(['m', mimeType]);
            hashtags.split(/[,\s]+/).filter(Boolean).forEach(tag => tags.push(['t', tag]));
            if (addLocation && currentLocation?.geohash) { tags.push(['g', currentLocation.geohash]); }
            if (addContentWarning && contentWarningReason.trim()) { tags.push(['content-warning', contentWarningReason.trim()]); }
            kind20Event.tags = tags;
            await kind20Event.publish();
            toast.success('Post published successfully!', { id: processToastId });
            setProcessedData(null); setPreviewUrl(null); setDescription(''); setHashtags(''); setAddLocation(false); setCurrentLocation(null); setLocationError(null); setAddContentWarning(false); setContentWarningReason('');
            if (onUploadSuccess) onUploadSuccess(); 
        } catch (err: any) { console.error("Submit Err:", err); toast.error(`Error: ${err.message || 'Unknown error'}`, { id: processToastId }); }
        finally { setIsUploading(false); setIsPublishing(false); }
    }, [processedData, signer, user, description, addContentWarning, contentWarningReason, selectedServerApiUrl, addLocation, currentLocation, hashtags, ndk, uploadFileToBlossom, generateGeohash, onUploadSuccess]);


    // --- Rendering (Using MUI Components) ---
     const isProcessingOverall = isProcessingImage || isUploading || isPublishing;
     let buttonText = 'Upload & Post';
     if (isProcessingImage) buttonText = 'Processing Image...';
     else if (isUploading) buttonText = 'Uploading...'; 
     else if (isPublishing) buttonText = 'Publishing...';

     // Conditional rendering based on initialFile presence for initial state
     if (!initialFile && !processedData && !isProcessingImage) return <Typography color="error">No file provided to form.</Typography>; 

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
             <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

             {previewUrl && ( <Box sx={{ mb: 2, textAlign: 'center' }}> <img src={previewUrl} alt="Selected preview" style={{ maxWidth: '200px', maxHeight: '200px', border: '1px solid #ccc' }} /> </Box> )}
            
             {isProcessingImage && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><CircularProgress size={20}/><Typography variant="caption">Processing image...</Typography></Box> }

             {/* Render form fields only when processing is done and successful */}
             {!isProcessingImage && processedData && (
                 <>
                     <TextField id="description" label="Description / Alt Text *" multiline rows={3} fullWidth value={description} onChange={(e) => setDescription(e.target.value)} disabled={isProcessingOverall} required margin="normal" />
                     <TextField id="hashtags" label="Hashtags (space separated)" fullWidth value={hashtags} onChange={(e) => setHashtags(e.target.value)} disabled={isProcessingOverall} margin="normal" helperText="e.g., nostr awesome pics" />
                     <FormControlLabel control={ <Checkbox checked={addLocation} onChange={handleLocationToggle} disabled={isProcessingOverall} /> } label="Add Location (Geohash)" sx={{ display: 'block', mt: 1 }} />
                     {addLocation && currentLocation && ( <Typography variant="caption" color="text.secondary" sx={{ml:4}}>📍 Acquired: {currentLocation.geohash}</Typography> )}
                     {locationError && <Alert severity="error" sx={{mt:1}}>{locationError}</Alert>}
                     <FormControlLabel control={ <Checkbox checked={addContentWarning} onChange={(e) => setAddContentWarning(e.target.checked)} disabled={isProcessingOverall} /> } label="Add Content Warning" sx={{ display: 'block', mt: 1 }} />
                     {addContentWarning && ( <TextField id="contentWarningReason" label="Content Warning Reason *" fullWidth value={contentWarningReason} onChange={(e) => setContentWarningReason(e.target.value)} disabled={isProcessingOverall} required={addContentWarning} margin="normal" size="small" /> )}
                     <FormControl fullWidth margin="normal" disabled={isProcessingOverall}>
                        <InputLabel id="server-select-label">Blossom Server</InputLabel>
                         <Select labelId="server-select-label" id="serverSelect" value={selectedServerApiUrl} label="Blossom Server" onChange={handleServerSelectChangeMUI} >
                             {BLOSSOM_SERVERS.map(server => ( <MenuItem key={server.apiUrl} value={server.apiUrl} disabled={server.name.includes("Unknown")}> {server.name} </MenuItem> ))}
                         </Select>
                         <Box sx={{display: 'flex', justifyContent:'space-between', alignItems:'center', mt: 1}}>
                            <Typography variant="caption" color="text.secondary"> Current default: { BLOSSOM_SERVERS.find(s => s.apiUrl === localStorage.getItem(LOCAL_STORAGE_DEFAULT_BLOSSOM_SERVER_KEY))?.name || 'None' } </Typography>
                            <Button size="small" onClick={handleSetDefault} disabled={isProcessingOverall}>Set Default</Button>
                         </Box>
                     </FormControl>
                     <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                          <Button onClick={onCancel} disabled={isProcessingOverall} variant="outlined">Cancel</Button>
                          <Button type="submit" variant="contained" disabled={isProcessingOverall || !processedData} startIcon={(isUploading || isPublishing) ? <CircularProgress size={20} color="inherit" /> : null} >
                            {buttonText}
                         </Button>
                     </Box>
                </>
            )}
            {/* Show error if processing failed - Use initialFile prop here */}
             {!isProcessingImage && !processedData && initialFile && ( 
                 <Alert severity="error">Failed to process image. Please try cancelling and selecting a different file.</Alert>
             )}
        </Box>
    );
};