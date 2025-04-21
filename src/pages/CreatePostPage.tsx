// /home/raven/zappix/src/pages/CreatePostPage.tsx
import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Box, Typography, Container, TextField, Button, Switch, FormControlLabel, Card, CardMedia, CircularProgress, Alert } from '@mui/material';
import { useNdk } from '../contexts/NdkContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
// We will need ngeohash later if geolocation is enabled
// import ngeohash from 'ngeohash';
import { NDKEvent } from '@nostr-dev-kit/ndk'; // Import NDKEvent

export const CreatePostPage: React.FC = () => {
    const { ndk, user, signer } = useNdk();
    const navigate = useNavigate();

    // Form State
    const [description, setDescription] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isGeoEnabled, setIsGeoEnabled] = useState(false);
    const [isContentWarningEnabled, setIsContentWarningEnabled] = useState(false);
    const [contentWarningReason, setContentWarningReason] = useState('');
    const [hashtags, setHashtags] = useState(''); // Comma or space separated
    const [fileHash, setFileHash] = useState<string | null>(null); // Store SHA-256 hash
    // const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null); // Optionally store buffer

    // Interaction State
    const [isLoading, setIsLoading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [blossomServerUrl, setBlossomServerUrl] = useState<string>('https://blossom.band'); // Default

    // Get Blossom server URL from settings on mount
    useEffect(() => {
        const storedUrl = localStorage.getItem('nostrImageAppBlossomServerUrl');
        if (storedUrl) {
            // Basic validation: check if it looks like an HTTP URL
            if (storedUrl.startsWith('http://') || storedUrl.startsWith('https://')) {
                setBlossomServerUrl(storedUrl);
                console.log(`Using Blossom server from localStorage: ${storedUrl}`);
            } else {
                 console.warn(`Invalid Blossom server URL found in localStorage: ${storedUrl}. Using default.`);
            }
        } else {
            console.log('No Blossom server URL in localStorage, using default.');
        }
    }, []);

    // Helper function to convert ArrayBuffer to Hex String
    const bufferToHex = (buffer: ArrayBuffer): string => {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    };

    // Handle file selection and hashing
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setSelectedFile(null);
        setPreviewUrl(null);
        setFileHash(null);
        // setFileBuffer(null);
        setUploadError(null); // Clear previous errors

        if (file) {
            setSelectedFile(file);

            // Create a preview URL
            const previewReader = new FileReader();
            previewReader.onloadend = () => {
                setPreviewUrl(previewReader.result as string);
            };
            previewReader.readAsDataURL(file);

            // Calculate SHA-256 hash
            try {
                const buffer = await file.arrayBuffer();
                // setFileBuffer(buffer); // Store buffer if needed for PUT request directly
                const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
                const hashHex = bufferToHex(hashBuffer);
                setFileHash(hashHex);
                console.log(`File Hash (SHA-256): ${hashHex}`);
            } catch (err) {
                console.error("Error hashing file:", err);
                setUploadError("Failed to calculate file hash.");
                setSelectedFile(null); // Invalidate selection if hashing fails
                setPreviewUrl(null);
            }
        } 
    };

    // --- New handleSubmit implementing strict NIP-98/BUD-02/BUD-06 --- 
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedFile || !fileHash) {
            toast.error("Please select an image (and wait for hashing to complete).");
            return;
        }
        if (!signer || !user || !ndk) {
             toast.error("Login required to create posts.");
            return;
        }

        setIsLoading(true);
        setUploadError(null);
        toast('Preparing upload...');

        try {
            // --- NIP-98 Blossom Upload Flow ---
            
            // 1. Create Kind 24242 Authorization Event
            const now = Math.floor(Date.now() / 1000);
            const expiration = now + (60 * 60); // 1 hour expiration
            const authEvent = new NDKEvent(ndk);
            authEvent.kind = 24242;
            authEvent.created_at = now;
            authEvent.content = `Upload ${selectedFile.name}`;
            authEvent.tags = [
                ['t', 'upload'],
                ['x', fileHash], // File hash
                ['expiration', expiration.toString()],
                ['m', selectedFile.type], // Mimetype
                ['size', selectedFile.size.toString()] // Size
            ];

            // 2. Sign the Authorization Event
            console.log("Signing NIP-98 Auth Event (Kind 24242)...");
            toast('Signing upload authorization...');
            await authEvent.sign(signer);
            if (!authEvent.sig) {
                throw new Error("Failed to sign NIP-98 authorization event.");
            }
            const signedAuthEvent = await authEvent.toNostrEvent();

            // 3. Base64 Encode the Signed Auth Event for the Header
            const authHeader = 'Nostr ' + btoa(JSON.stringify(signedAuthEvent));
            console.log("NIP-98 Auth Header generated.");

            // 4. Perform HEAD request to check requirements (BUD-06)
            const uploadUrl = blossomServerUrl.endsWith('/') ? blossomServerUrl + 'upload' : blossomServerUrl + '/upload';
            console.log("Performing HEAD request to check upload requirements...");
            toast('Checking server requirements...');
            const headResponse = await fetch(uploadUrl, { 
                method: 'HEAD',
                headers: {
                    'Authorization': authHeader,
                    'X-Content-Type': selectedFile.type,
                    'X-Content-Length': selectedFile.size.toString(),
                    'X-SHA-256': fileHash
                }
            });
            console.log(`HEAD Response Status: ${headResponse.status}`);
            if (!headResponse.ok) {
                 let reason = headResponse.headers.get('X-Reason') || headResponse.statusText || 'Unknown reason';
                 if (headResponse.status === 400) reason = "Bad Request (check headers/auth event format).";
                 if (headResponse.status === 401) reason = "Authorization required or invalid.";
                 if (headResponse.status === 403) reason = "Authorization forbidden.";
                 if (headResponse.status === 413) reason = "File size exceeds server limit.";
                 if (headResponse.status === 415) reason = "File type not supported.";
                 // Add more specific status code handling if needed
                throw new Error(`Upload check failed (${headResponse.status}): ${reason}`);
            }
            console.log("HEAD check successful.");

            // 5. Perform the PUT Upload (BUD-02)
            console.log(`Uploading ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB) via PUT to ${uploadUrl}...`); 
            toast('Uploading image...');
            // Read file content again for PUT request body
            const fileBuffer = await selectedFile.arrayBuffer();

            // ****** Ensure Content-Length is added here ******
            const putResponse = await fetch(uploadUrl, { 
                method: 'PUT',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': selectedFile.type, 
                    'Content-Length': selectedFile.size.toString() // Explicitly add Content-Length
                },
                body: fileBuffer // Send raw file data
            });
            // ***************************************************

            if (!putResponse.ok) {
                let errorMsg = `Upload failed (${putResponse.status})`;
                try { 
                    const errorBody = await putResponse.json();
                    errorMsg += `: ${errorBody.message || errorBody.error || 'Server error'}`;
                } catch (e) { errorMsg += `: ${putResponse.statusText}`; }
                throw new Error(errorMsg);
            }

            const uploadResult = await putResponse.json();
            console.log("Blossom Upload (PUT) successful:", uploadResult);

            // Validate essential fields from NIP-96 response
            if (!uploadResult.url || !uploadResult.type) {
                 throw new Error("Invalid response from Blossom server: Missing url or type.");
            }
            // Validate hash if returned by server (optional check)
            if (uploadResult.sha256 && uploadResult.sha256 !== fileHash) {
                console.warn(`Server returned SHA256 (${uploadResult.sha256}) differs from client calculated (${fileHash}). Using client hash for tag.`);
            } 
            const resultHash = fileHash; // Use the hash we calculated and authorized
            const resultSize = uploadResult.size || selectedFile.size.toString(); // Use original file size if missing

            // --- Upload Complete ---
            toast.success('Upload complete! Creating post...');
            
            // 6. Get Geolocation if enabled (TODO)
            let geohashTag: string[] | null = null;
            if (isGeoEnabled) {
                 console.log("Geolocation requested...");
                 // --- Placeholder for geo logic ---
                 // await getCurrentPosition... -> ngeohash.encode...
                 // geohashTag = ['g', theGeohash];
                 console.warn("Geolocation fetching not yet implemented.");
                 // -----------------------------------
            }

            // 7. Parse Hashtags
            const hashtagTags = hashtags
                 .split(/[\s,]+/) // Split by space or comma
                 .map(tag => tag.trim().toLowerCase())
                 .filter(tag => tag.length > 0)
                 .map(tag => ['t', tag]);

            // 8. Construct Kind 20 Event
            const newEvent = new NDKEvent(ndk);
            newEvent.kind = 20;
            newEvent.content = description; // Main description goes in content
            newEvent.created_at = Math.floor(Date.now() / 1000);
            
            // NIP-68 `imeta` tag
            const imetaTag = ['imeta'];
            imetaTag.push(`url ${uploadResult.url}`);
            imetaTag.push(`m ${uploadResult.type}`);
            imetaTag.push(`x ${resultHash}`); // Use validated hash
            imetaTag.push(`size ${resultSize}`); // Use validated size
            // Add optional fields if returned by Blossom
            if (uploadResult.ox) imetaTag.push(`ox ${uploadResult.ox}`);
            if (uploadResult.dim) imetaTag.push(`dim ${uploadResult.dim}`);
            newEvent.tags.push(imetaTag);
            
            // NIP-68 `alt` tag (required)
            newEvent.tags.push(['alt', description || "Image posted via Zappix"]);

            // Add other tags
            if (geohashTag) newEvent.tags.push(geohashTag);
            if (hashtagTags.length > 0) newEvent.tags.push(...hashtagTags);
            if (isContentWarningEnabled) {
                newEvent.tags.push(['content-warning', contentWarningReason || 'Nudity, sensitive content']);
            }

            // 9. Sign and Publish Kind 20 Event
             console.log("Signing and publishing Kind 20 event:", newEvent.rawEvent());
             toast('Publishing post...');
            await newEvent.sign(signer);
            const publishedTo = await newEvent.publish(); // Use event's publish
            
            if (publishedTo.size > 0) {
                 toast.success('Post created successfully!');
                navigate('/'); // Navigate back to feed on success
            } else {
                 throw new Error("Event failed to publish to any relays.");
            }

        } catch (error: any) {
            console.error("Failed to create post:", error);
            setUploadError(error.message || "An unknown error occurred during upload/post.");
            toast.error(`Failed to create post: ${error.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };
    // --- End handleSubmit --- 

    return (
        <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
            <Box 
                component="form" 
                onSubmit={handleSubmit}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
                <Typography component="h1" variant="h5" gutterBottom>
                    Create New Post
                </Typography>

                {/* Image Preview */} 
                {previewUrl && (
                    <Card sx={{ width: '100%', mb: 2 }}>
                        <CardMedia
                            component="img"
                            image={previewUrl}
                            alt="Image preview"
                            sx={{ maxHeight: 300, objectFit: 'contain' }}
                        />
                    </Card>
                )}

                {/* Image Upload Button */} 
                <Button
                    variant="contained"
                    component="label"
                    disabled={isLoading}
                    sx={{ mb: 2 }}
                >
                    {previewUrl ? "Change Image" : "Select Image"}
                    <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                </Button>

                {/* Description */} 
                <TextField
                    label="Description (Alt Text)"
                    variant="outlined"
                    fullWidth
                    multiline
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required // Alt text is important
                    disabled={isLoading}
                    sx={{ mb: 2 }}
                />

                {/* Hashtags */} 
                <TextField
                    label="Hashtags (space or comma separated)"
                    variant="outlined"
                    fullWidth
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    disabled={isLoading}
                    sx={{ mb: 2 }}
                />

                {/* Geolocation Toggle */} 
                <FormControlLabel
                    control={<Switch checked={isGeoEnabled} onChange={(e) => setIsGeoEnabled(e.target.checked)} disabled={isLoading} />}
                    label="Add Geolocation (Requires browser permission)"
                    sx={{ alignSelf: 'flex-start', mb: 1 }}
                />

                {/* Content Warning Toggle */} 
                <FormControlLabel
                    control={<Switch checked={isContentWarningEnabled} onChange={(e) => setIsContentWarningEnabled(e.target.checked)} disabled={isLoading} />}
                    label="Add Content Warning"
                    sx={{ alignSelf: 'flex-start', mb: isContentWarningEnabled ? 0 : 2 }} // Adjust margin
                />

                {/* Content Warning Reason */} 
                {isContentWarningEnabled && (
                    <TextField
                        label="Content Warning Reason (optional)"
                        variant="outlined"
                        fullWidth
                        size="small"
                        value={contentWarningReason}
                        onChange={(e) => setContentWarningReason(e.target.value)}
                        disabled={isLoading}
                        sx={{ mb: 2, mt: 1 }}
                    />
                )}
                
                {/* Error Message */} 
                {uploadError && (
                    <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{uploadError}</Alert>
                )}

                {/* Submit Button */} 
                <Button 
                    type="submit" 
                    variant="contained" 
                    color="primary" 
                    disabled={isLoading || !selectedFile || !fileHash} // Also disable if hash calculation failed
                    fullWidth
                    sx={{ mb: 2 }}
                >
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Create Post'}
                </Button>

            </Box>
        </Container>
    );
};
