import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/icons";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { NDKEvent, NDKUserProfile } from "@nostr-dev-kit/ndk";
import { UserPen } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { FormInput, FormInputProps } from "../../components/form-input";
import { FormInputTextarea, FormInputTextareaProps } from "../../components/form-input-textarea";
import { Button } from "../../components/ui/button";
import { useNdk } from "../../contexts/NdkContext";

async function calculateFileSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

function base64Encode(str: string): string {
  try {
    // Browser environment
    const bytes = new TextEncoder().encode(str);
    const binaryString = String.fromCharCode(...bytes);
    return btoa(binaryString);
  } catch {
    // Node.js environment (basic fallback, might need Buffer for full compatibility)
    return Buffer.from(str, "utf-8").toString("base64");
  }
}

export type ProfileEditFormProps = {
  currentUserProfile: null | NDKUserProfile;
  onSave: (updatedProfile: NDKUserProfile) => void;
};

const BLOSSOM_STORAGE_KEY = "nostrImageAppBlossomServerUrl";
const BLOSSOM_DEFAULT_SERVER = "https://blossom.band"; // Default server

export const EditProfileModal: React.FC<ProfileEditFormProps> = ({
  currentUserProfile,
  onSave,
}) => {
  const { ndk, signer, user } = useNdk();
  const [profile, setProfile] = React.useState<NDKUserProfile>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = React.useState(false);
  const [blossomServerUrl, setBlossomServerUrl] = React.useState<string>(BLOSSOM_DEFAULT_SERVER);

  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (currentUserProfile) {
      setProfile(currentUserProfile);
    } else {
      setProfile({});
    }
    setIsUploadingAvatar(false);
    setIsUploadingBanner(false);
  }, [currentUserProfile]);

  const handleInputOnChange: FormInputProps["onChange"] = (event) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleTextareaOnChange: FormInputTextareaProps["onChange"] = (event) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  // --- Reused Blossom Upload Logic ---
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    fieldName: "banner" | "image",
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
        headers: {
          Authorization: authHeader,
          "X-Content-Length": file.size.toString(),
          "X-Content-Type": file.type,
          "X-SHA-256": fileHash,
        },
        method: "HEAD",
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
        body: fileBuffer, // Raw file data
        headers: {
          Authorization: authHeader,
          "Content-Length": file.size.toString(), // Required for PUT
          "Content-Type": file.type,
        },
        method: "PUT",
      });

      if (!putResponse.ok) {
        let errorMsg = `Upload failed (${putResponse.status})`;
        try {
          const errorBody = await putResponse.json();
          errorMsg += `: ${errorBody.message || errorBody.error || "Server error"}`;
        } catch {
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
    <Dialog
      onOpenChange={(open) => {
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
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPen />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Edit Your Profile</DialogTitle>
        <div className="flex flex-col gap-2">
          <FormInput
            disabled={isUploading}
            label="Display Name"
            name="displayName"
            onChange={handleInputOnChange}
            value={profile.displayName || ""}
          />
          <FormInput
            disabled={isUploading}
            label="Username (handle)"
            name="name"
            onChange={handleInputOnChange}
            value={profile.name || ""}
          />
          <FormInputTextarea
            disabled={isUploading}
            label="About"
            name="about"
            onChange={handleTextareaOnChange}
            rows={5}
            value={profile.about || ""}
          />

          <FormInput
            disabled={isUploading}
            label="Profile Picture URL"
            name="image"
            onChange={handleInputOnChange}
            trailing={
              <Button
                aria-label="Upload profile picture"
                disabled={isUploading}
                onClick={() => handleUploadIconClick(avatarInputRef)}
                variant="tertiary"
              >
                {isUploadingAvatar ? <Loader /> : <PhotoCameraIcon className="text-brand-purple" />}
              </Button>
            }
            type="url"
            value={profile.image || ""}
          />
          <input
            accept="image/*"
            hidden
            onChange={(e) => handleFileChange(e, "image")}
            ref={avatarInputRef}
            type="file"
          />

          <FormInput
            disabled={isUploading}
            label="Banner URL"
            name="banner"
            onChange={handleInputOnChange}
            trailing={
              <Button
                aria-label="Upload profile banner"
                disabled={isUploading}
                onClick={() => handleUploadIconClick(bannerInputRef)}
                variant="tertiary"
              >
                {isUploadingBanner ? <Loader /> : <PhotoCameraIcon className="text-brand-purple" />}
              </Button>
            }
            type="url"
            value={profile.banner || ""}
          />
          <input
            accept="image/*"
            hidden
            onChange={(e) => handleFileChange(e, "banner")}
            ref={bannerInputRef}
            type="file"
          />

          <FormInput
            disabled={isUploading}
            label="Website URL"
            name="website"
            onChange={handleInputOnChange}
            type="url"
            value={profile.website || ""}
          />
          <FormInput
            disabled={isUploading}
            label="Nostr Address (NIP-05)"
            name="nip05"
            onChange={handleInputOnChange}
            value={profile.nip05 || ""}
          />
          <FormInput
            disabled={isUploading}
            label="Lightning Address (LUD-16)"
            name="lud16"
            onChange={handleInputOnChange}
            value={profile.lud16 || ""}
          />
        </div>
        <DialogFooter>
          <Button disabled={isSaving || isUploading} onClick={handleSave}>
            {isSaving ? <Loader /> : "Save Profile"}
          </Button>
          <DialogClose asChild>
            <Button disabled={isSaving || isUploading} variant="secondary">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
