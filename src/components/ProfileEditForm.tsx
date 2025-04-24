// src/components/ProfileEditForm.tsx
import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { NDKUserProfile, NDKEvent } from "@nostr-dev-kit/ndk";
import { useNdk } from "../contexts/NdkContext";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import toast from "react-hot-toast";

// --- Helper Functions ---

// Calculate SHA256 hash of a file
async function calculateFileSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

// Base64 encode (UTF-8 safe)
function base64Encode(str: string): string {
  try {
    // Browser environment
    const bytes = new TextEncoder().encode(str);
    const binaryString = String.fromCharCode(...bytes);
    return btoa(binaryString);
  } catch (e) {
    // Node.js environment (basic fallback, might need Buffer for full compatibility)
    return Buffer.from(str, "utf-8").toString("base64");
  }
}

// --- Component Props ---
interface ProfileEditFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (updatedProfile: NDKUserProfile) => void;
  currentUserProfile: NDKUserProfile | null;
}

// --- Blossom Server Config Key ---
const BLOSSOM_STORAGE_KEY = "nostrImageAppBlossomServerUrl";
const BLOSSOM_DEFAULT_SERVER = "https://blossom.band"; // Default server

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  open,
  onClose,
  onSave,
  currentUserProfile,
}) => {
  const { ndk, user, signer } = useNdk();
  const [profile, setProfile] = useState<NDKUserProfile>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [blossomServerUrl, setBlossomServerUrl] = useState<string>(BLOSSOM_DEFAULT_SERVER);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Get Blossom server URL from settings on mount/open
  useEffect(() => {
    if (open) {
      // Only check when modal becomes visible
      const storedUrl = localStorage.getItem(BLOSSOM_STORAGE_KEY);
      let urlToUse = BLOSSOM_DEFAULT_SERVER;
      if (storedUrl) {
        if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) {
          urlToUse = storedUrl;
          console.log(`Using Blossom server from localStorage: ${urlToUse}`);
        } else {
          console.warn(
            `Invalid Blossom server URL found in localStorage: ${storedUrl}. Using default.`,
          );
        }
      } else {
        console.log("No Blossom server URL in localStorage, using default.");
      }
      // Ensure URL doesn't end with a slash for consistency
      setBlossomServerUrl(urlToUse.endsWith("/") ? urlToUse.slice(0, -1) : urlToUse);
    }
  }, [open]);

  useEffect(() => {
    if (currentUserProfile) {
      setProfile(currentUserProfile);
    } else {
      setProfile({});
    }
    setIsUploadingAvatar(false);
    setIsUploadingBanner(false);
  }, [currentUserProfile, open]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  // --- Reused Blossom Upload Logic ---
  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
    fieldName: "image" | "banner",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!signer || !user || !ndk) {
      toast.error("Login required to upload images.");
      return;
    }

    const setLoading = fieldName === "image" ? setIsUploadingAvatar : setIsUploadingBanner;
    setLoading(true);
    const uploadToastId = "upload-toast-" + fieldName;

    try {
      toast.loading("Preparing upload...", { id: uploadToastId });

      // 1. Calculate Hash
      const fileHash = await calculateFileSHA256(file);
      console.log(`File Hash (SHA-256) for ${fieldName}: ${fileHash}`);

      // 2. Create Auth Event
      const now = Math.floor(Date.now() / 1000);
      const expiration = now + 60 * 60; // 1 hour
      const authEvent = new NDKEvent(ndk);
      authEvent.kind = 24242;
      authEvent.created_at = now;
      authEvent.content = `Upload ${file.name} for profile ${fieldName}`;
      authEvent.tags = [
        ["t", "upload"], // General upload tag
        ["x", fileHash],
        ["expiration", expiration.toString()],
        ["m", file.type],
        ["size", file.size.toString()],
      ];

      // 3. Sign Auth Event
      toast.loading("Signing upload authorization...", { id: uploadToastId });
      await authEvent.sign(signer);
      if (!authEvent.sig) throw new Error("Failed to sign NIP-98 authorization event.");
      const signedAuthEvent = await authEvent.toNostrEvent();

      // 4. Base64 Encode Auth Event for Header
      const authHeader = "Nostr " + base64Encode(JSON.stringify(signedAuthEvent));
      console.log("NIP-98 Auth Header generated.");

      // 5. Perform HEAD request check
      const uploadEndpoint = `${blossomServerUrl}/upload`; // Append /upload
      console.log(`Performing HEAD request to ${uploadEndpoint}...`);
      toast.loading("Checking server requirements...", { id: uploadToastId });
      const headResponse = await fetch(uploadEndpoint, {
        method: "HEAD",
        headers: {
          Authorization: authHeader,
          "X-Content-Type": file.type,
          "X-Content-Length": file.size.toString(),
          "X-SHA-256": fileHash,
        },
      });
      console.log(`HEAD Response Status: ${headResponse.status}`);
      if (!headResponse.ok) {
        let reason =
          headResponse.headers.get("X-Reason") || headResponse.statusText || "Unknown reason";
        if (headResponse.status === 400) reason = "Bad Request (check headers/auth event format).";
        else if (headResponse.status === 401) reason = "Authorization required or invalid.";
        else if (headResponse.status === 403) reason = "Authorization forbidden.";
        else if (headResponse.status === 413) reason = "File size exceeds server limit.";
        else if (headResponse.status === 415) reason = "File type not supported.";
        throw new Error(`Upload check failed (${headResponse.status}): ${reason}`);
      }
      console.log("HEAD check successful.");

      // 6. Perform PUT Upload
      console.log(
        `Uploading ${file.name} (${Math.round(file.size / 1024)} KB) via PUT to ${uploadEndpoint}...`,
      );
      toast.loading("Uploading image...", { id: uploadToastId });
      const fileBuffer = await file.arrayBuffer();
      const putResponse = await fetch(uploadEndpoint, {
        method: "PUT",
        headers: {
          Authorization: authHeader,
          "Content-Type": file.type,
          "Content-Length": file.size.toString(), // Required for PUT
        },
        body: fileBuffer, // Raw file data
      });

      if (!putResponse.ok) {
        let errorMsg = `Upload failed (${putResponse.status})`;
        try {
          const errorBody = await putResponse.json();
          errorMsg += `: ${errorBody.message || errorBody.error || "Server error"}`;
        } catch (e) {
          errorMsg += `: ${putResponse.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const uploadResult = await putResponse.json();
      console.log("Blossom Upload (PUT) successful:", uploadResult);

      // 7. Extract URL and Update State
      const uploadedFileUrl = uploadResult?.url; // blossom.band uses top-level url
      if (!uploadedFileUrl || !uploadedFileUrl.startsWith("http")) {
        throw new Error("Invalid or missing URL in upload response.");
      }
      setProfile((prev) => ({ ...prev, [fieldName]: uploadedFileUrl }));
      toast.success("Image uploaded successfully!", { id: uploadToastId });
    } catch (error) {
      console.error(`Error uploading ${fieldName}:`, error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : String(error)}`, {
        id: uploadToastId,
      });
    } finally {
      setLoading(false);
      // Reset file input value so the same file can be selected again if needed
      event.target.value = "";
    }
  };

  const handleUploadIconClick = (ref: React.RefObject<HTMLInputElement>) => {
    ref.current?.click();
  };

  // --- Save Profile Logic (Unchanged) ---
  const handleSave = async () => {
    if (!ndk || !user || !signer) {
      toast.error("Cannot save profile: NDK, user, or signer missing.");
      return;
    }
    setIsSaving(true);
    const profileToSave = { ...profile };
    Object.keys(profileToSave).forEach((key) => {
      const k = key as keyof NDKUserProfile;
      if (profileToSave[k] === "" || profileToSave[k] === null) {
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
      toast.error(
        `Failed to save profile: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isUploading = isUploadingAvatar || isUploadingBanner;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Your Profile</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Standard Fields */}
          <TextField
            label="Display Name"
            name="displayName"
            value={profile.displayName || ""}
            onChange={handleChange}
            fullWidth
            disabled={isUploading}
          />
          <TextField
            label="Username (handle)"
            name="name"
            value={profile.name || ""}
            onChange={handleChange}
            fullWidth
            disabled={isUploading}
          />
          <TextField
            label="About"
            name="about"
            value={profile.about || ""}
            onChange={handleChange}
            fullWidth
            multiline
            rows={3}
            disabled={isUploading}
          />

          {/* Avatar Upload */}
          <TextField
            label="Profile Picture URL"
            name="image"
            value={profile.image || ""}
            onChange={handleChange}
            fullWidth
            type="url"
            disabled={isUploading} // Disable during any upload
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="upload picture"
                    onClick={() => handleUploadIconClick(avatarInputRef)}
                    edge="end"
                    disabled={isUploading} // Disable during any upload
                  >
                    {isUploadingAvatar ? <CircularProgress size={20} /> : <PhotoCameraIcon />}
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
            onChange={(e) => handleFileChange(e, "image")}
          />

          {/* Banner Upload */}
          <TextField
            label="Banner URL"
            name="banner"
            value={profile.banner || ""}
            onChange={handleChange}
            fullWidth
            type="url"
            disabled={isUploading} // Disable during any upload
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="upload banner"
                    onClick={() => handleUploadIconClick(bannerInputRef)}
                    edge="end"
                    disabled={isUploading} // Disable during any upload
                  >
                    {isUploadingBanner ? <CircularProgress size={20} /> : <PhotoCameraIcon />}
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
            onChange={(e) => handleFileChange(e, "banner")}
          />

          {/* Other Fields */}
          <TextField
            label="Website URL"
            name="website"
            value={profile.website || ""}
            onChange={handleChange}
            fullWidth
            type="url"
            disabled={isUploading}
          />
          <TextField
            label="Nostr Address (NIP-05)"
            name="nip05"
            value={profile.nip05 || ""}
            onChange={handleChange}
            fullWidth
            disabled={isUploading}
          />
          <TextField
            label="Lightning Address (LUD-16)"
            name="lud16"
            value={profile.lud16 || ""}
            onChange={handleChange}
            fullWidth
            disabled={isUploading}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving || isUploading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={isSaving || isUploading}>
          {isSaving ? <CircularProgress size={24} /> : "Save Profile"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
