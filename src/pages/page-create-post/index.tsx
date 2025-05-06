import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorIcon, Loader } from "@/components/ui/icons";
import { NDKEvent } from "@nostr-dev-kit/ndk"; // Import NDKEvent
import { CheckedState } from "@radix-ui/react-checkbox";
import cx from "classnames";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FormInput } from "../../components/form-input";
import { FormInputCheckbox } from "../../components/form-input-checkbox";
import { FormInputTextarea } from "../../components/form-input-textarea";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { useNdk } from "../../contexts/NdkContext";

// Helper function to convert ArrayBuffer to Hex String
const bufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const CreatePostPage: React.FC = () => {
  const { ndk, signer, user } = useNdk();
  const navigate = useNavigate();

  // Form State
  const [description, setDescription] = React.useState("");
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);
  const [fileHashes, setFileHashes] = React.useState<string[]>([]); // Store SHA-256 hashes for each file
  const [isGeoEnabled, setIsGeoEnabled] = React.useState<CheckedState>(false);
  const [isContentWarningEnabled, setIsContentWarningEnabled] = React.useState<CheckedState>(false);
  const [contentWarningReason, setContentWarningReason] = React.useState("");
  const [hashtags, setHashtags] = React.useState(""); // Comma or space separated

  // Interaction State
  const [isLoading, setIsLoading] = React.useState(false); // General loading for hashing/submitting
  const [isUploading, setIsUploading] = React.useState(false); // Specific loading for upload process
  const [uploadError, setUploadError] = React.useState<null | string>(null);
  const [blossomServerUrl, setBlossomServerUrl] = React.useState<string>("https://blossom.band"); // Default

  // Get Blossom server URL from settings on mount
  React.useEffect(() => {
    const storedUrl = localStorage.getItem("nostrImageAppBlossomServerUrl");
    if (storedUrl) {
      if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) {
        setBlossomServerUrl(storedUrl);
        console.log(`Using Blossom server from localStorage: ${storedUrl}`);
      } else {
        console.warn(
          `Invalid Blossom server URL found in localStorage: ${storedUrl}. Using default.`,
        );
      }
    } else {
      console.log("No Blossom server URL in localStorage, using default.");
    }
  }, []);

  // Handle file selection and hashing for multiple files
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setFileHashes([]);
    setUploadError(null); // Clear previous errors

    if (files.length === 0) {
      return;
    }

    setSelectedFiles(files);
    setIsLoading(true); // Start loading indicator for hashing
    toast.loading("Processing images...");

    const previews: string[] = [];
    const hashes: string[] = [];
    const errors: string[] = [];

    const processingPromises = files.map(async (file) => {
      previews.push(URL.createObjectURL(file));
      try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashHex = bufferToHex(hashBuffer);
        hashes.push(hashHex);
        console.log(`File Hash for ${file.name}: ${hashHex}`);
      } catch (err) {
        console.error(`Error hashing file ${file.name}:`, err);
        errors.push(`Failed to hash ${file.name}.`);
        hashes.push(""); // Placeholder to maintain order
      }
    });

    await Promise.all(processingPromises);

    // Update state after all processing is done
    // Note: Ensure order matches original files array
    setPreviewUrls(previews);
    setFileHashes(hashes);
    setIsLoading(false); // Stop loading indicator
    toast.dismiss(); // Dismiss processing toast

    if (errors.length > 0) {
      setUploadError(`Errors during file processing: ${errors.join(", ")}`);
      toast.error("Some files could not be processed.");
    } else {
      setUploadError(null);
    }
  };

  // --- New handleSubmit implementing strict NIP-98/BUD-02/BUD-06 for multiple files ---
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      selectedFiles.length === 0 ||
      fileHashes.length !== selectedFiles.length ||
      fileHashes.some((hash) => !hash)
    ) {
      toast.error("Please select one or more valid images (wait for processing).", {
        id: "submit-error",
      });
      return;
    }
    if (!signer || !user || !ndk) {
      toast.error("Login required to create posts.", { id: "submit-error" });
      return;
    }

    setIsUploading(true); // Use uploading state here
    setUploadError(null);
    const uploadToastId = toast.loading("Preparing uploads...");

    const uploadedImageData: {
      dim?: string;
      ox?: string;
      sha256: string;
      size: string;
      type: string;
      url: string;
    }[] = [];
    const uploadErrors: string[] = [];

    try {
      // --- NIP-98 Blossom Upload Flow for each file ---
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileHash = fileHashes[i];

        if (!fileHash) {
          uploadErrors.push(`Skipping upload for ${file.name}: Hash missing.`);
          continue; // Skip this file if hashing failed
        }

        toast.loading(`Uploading ${file.name}... (${i + 1}/${selectedFiles.length})`, {
          id: uploadToastId,
        });

        const now = Math.floor(Date.now() / 1000);
        const expiration = now + 60 * 60; // 1 hour expiration

        // 1. Create Kind 24242 Auth Event
        const authEvent = new NDKEvent(ndk);
        authEvent.kind = 24242;
        authEvent.created_at = now;
        authEvent.content = `Upload ${file.name}`;
        authEvent.tags = [
          ["t", "upload"],
          ["x", fileHash],
          ["expiration", expiration.toString()],
          ["m", file.type],
          ["size", file.size.toString()],
        ];

        // 2. Sign Auth Event
        console.log(`Signing NIP-98 Auth Event for ${file.name}...`);
        await authEvent.sign(signer);
        if (!authEvent.sig) {
          throw new Error(`Failed to sign NIP-98 authorization for ${file.name}.`);
        }
        const signedAuthEvent = await authEvent.toNostrEvent();
        const authHeader = "Nostr " + btoa(JSON.stringify(signedAuthEvent));

        // 3. Perform HEAD request
        const uploadUrl = blossomServerUrl.endsWith("/")
          ? blossomServerUrl + "upload"
          : blossomServerUrl + "/upload";
        console.log(`Performing HEAD request for ${file.name}...`);
        const headResponse = await fetch(uploadUrl, {
          headers: {
            Authorization: authHeader,
            "X-Content-Length": file.size.toString(),
            "X-Content-Type": file.type,
            "X-SHA-256": fileHash,
          },
          method: "HEAD",
        });
        if (!headResponse.ok) {
          const reason =
            headResponse.headers.get("X-Reason") || headResponse.statusText || "Unknown reason";
          uploadErrors.push(
            `Upload check failed for ${file.name} (${headResponse.status}): ${reason}`,
          );
          continue;
        }

        // 4. Perform PUT Upload
        console.log(`Uploading ${file.name} via PUT...`);
        const fileBuffer = await file.arrayBuffer();
        const putResponse = await fetch(uploadUrl, {
          body: fileBuffer,
          headers: {
            Authorization: authHeader,
            "Content-Length": file.size.toString(),
            "Content-Type": file.type,
          },
          method: "PUT",
        });
        if (!putResponse.ok) {
          let errorMsg = `Upload failed for ${file.name} (${putResponse.status})`;
          try {
            const errorBody = await putResponse.json();
            errorMsg += `: ${errorBody.message || errorBody.error || "Server error"}`;
          } catch {
            errorMsg += `: ${putResponse.statusText}`;
          }
          uploadErrors.push(errorMsg);
          continue;
        }
        const uploadResult = await putResponse.json();
        console.log(`Upload successful for ${file.name}:`, uploadResult);
        if (!uploadResult.url || !uploadResult.type) {
          uploadErrors.push(`Invalid response from Blossom for ${file.name}.`);
          continue;
        }
        if (uploadResult.sha256 && uploadResult.sha256 !== fileHash) {
          console.warn(`Server/Client hash mismatch for ${file.name}. Using client hash.`);
        }
        uploadedImageData.push({
          dim: uploadResult.dim,
          ox: uploadResult.ox,
          sha256: fileHash,
          size: uploadResult.size ? uploadResult.size.toString() : file.size.toString(),
          type: uploadResult.type,
          url: uploadResult.url,
        });
      }

      if (uploadedImageData.length === 0) {
        throw new Error("No images were successfully uploaded.");
      }

      toast.loading("Creating post...", { id: uploadToastId });

      // 6. Get Geolocation if enabled (TODO)
      const geohashTag: null | string[] = null;
      if (isGeoEnabled) {
        console.warn("Geolocation fetching not yet implemented.");
      }

      // 7. Parse Hashtags
      const hashtagTags = hashtags
        .split(/[\s,]+/)
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
        .map((tag) => ["t", tag]);

      // 8. Construct Kind 20 Event with multiple imeta tags
      const newEvent = new NDKEvent(ndk);
      newEvent.kind = 20;
      newEvent.content = description;
      newEvent.created_at = Math.floor(Date.now() / 1000);

      uploadedImageData.forEach((imageData) => {
        const imetaTag = ["imeta"];
        imetaTag.push(`url ${imageData.url}`);
        imetaTag.push(`m ${imageData.type}`);
        imetaTag.push(`x ${imageData.sha256}`);
        imetaTag.push(`size ${imageData.size}`);
        if (imageData.ox) imetaTag.push(`ox ${imageData.ox}`);
        if (imageData.dim) imetaTag.push(`dim ${imageData.dim}`);
        newEvent.tags.push(imetaTag);
      });

      newEvent.tags.push([
        "alt",
        description || `Collection of ${uploadedImageData.length} images posted via Zappix`,
      ]);
      if (geohashTag) newEvent.tags.push(geohashTag);
      if (hashtagTags.length > 0) newEvent.tags.push(...hashtagTags);
      if (isContentWarningEnabled) {
        newEvent.tags.push([
          "content-warning",
          contentWarningReason || "Nudity, sensitive content",
        ]);
      }

      // 9. Sign and Publish Kind 20 Event
      console.log(
        "Signing and publishing Kind 20 event with multiple images:",
        newEvent.rawEvent(),
      );
      await newEvent.sign(signer);
      const publishedTo = await newEvent.publish();

      if (publishedTo.size > 0) {
        toast.success("Post created successfully!", { id: uploadToastId });
        navigate("/"); // Navigate back to feed on success
      } else {
        throw new Error("Event failed to publish to any relays.");
      }
    } catch (error: any) {
      console.error("Failed to create post:", error);
      const errorMsg = error.message || "An unknown error occurred during upload/post.";
      setUploadError(errorMsg);
      toast.error(`Failed: ${errorMsg}`, { id: uploadToastId });
    } finally {
      setIsUploading(false);
      if (uploadErrors.length > 0) {
        const fullErrorMsg = `Upload completed with errors: ${uploadErrors.join(", ")}`;
        setUploadError((prev) => {
          // Check if the new message is already part of the previous message
          // to avoid excessive duplication if the same error happens repeatedly
          if (prev && prev.includes(fullErrorMsg)) {
            return prev;
          }
          // Append if previous error exists and is different
          if (prev) {
            return `${prev}. ${fullErrorMsg}`; // Use a separator like period+space
          }
          // Otherwise, just set the new error message
          return fullErrorMsg;
        });
        toast.error("Some image uploads failed. Check errors.", {
          duration: 5000,
        });
      }
    }
  };

  return (
    <div className="py-6">
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <h2 className="text-2xl">Create New Post</h2>

        {previewUrls.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {previewUrls.map((url, index) => (
              <Card key={index}>
                <CardContent>
                  <img alt={`Image preview ${index + 1}`} src={url} />
                </CardContent>
                {/* Optionally add a remove button for each preview */}
              </Card>
            ))}
          </div>
        )}

        <Button
          className="flex"
          disabled={isLoading || isUploading}
          type="button"
          variant="secondary"
        >
          <label
            className={cx("w-full", {
              "cursor-pointer": !isLoading && !isUploading,
            })}
          >
            {previewUrls.length > 0 ? "Change/Add Images" : "Select Images"}
            <input
              accept="image/*"
              hidden
              multiple // Allow multiple file selection
              onChange={handleFileChange}
              type="file"
            />
          </label>
        </Button>

        <FormInputTextarea
          disabled={isUploading}
          label="What's Zappening?"
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          required
          rows={3}
          value={description}
        />

        <FormInput
          disabled={isUploading}
          label="Hashtags"
          onChange={(e) => {
            setHashtags(e.target.value);
          }}
          placeholder="Space or comma separated"
          value={hashtags}
        />

        <FormInputCheckbox
          checked={isGeoEnabled}
          disabled={isUploading}
          label="Add Geolocation (requires browser permission)"
          onCheckedChange={setIsGeoEnabled}
        />

        <FormInputCheckbox
          checked={isContentWarningEnabled}
          disabled={isUploading}
          label="Add Content Warning"
          onCheckedChange={setIsContentWarningEnabled}
        />

        {isContentWarningEnabled && (
          <FormInput
            disabled={isUploading}
            label="Content Warning Reason"
            onChange={(e) => {
              setContentWarningReason(e.target.value);
            }}
            placeholder="Optional"
            value={contentWarningReason}
          />
        )}

        {uploadError && (
          <Alert>
            <ErrorIcon />
            <AlertTitle>Image Upload</AlertTitle>
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        <Button
          disabled={
            isLoading ||
            isUploading ||
            selectedFiles.length === 0 ||
            fileHashes.length !== selectedFiles.length
          }
          type="submit"
        >
          {isUploading ? <Loader /> : "Create Post"}
        </Button>
      </form>
    </div>
  );
};
