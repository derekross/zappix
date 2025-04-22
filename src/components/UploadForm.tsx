// src/components/UploadForm.tsx
import React, {
  useState,
  useCallback,
  // FIX: Removed unused ChangeEvent
  useEffect,
  useRef,
} from "react";
import { useNdk } from "../contexts/NdkContext";
import NDK, { NDKEvent, NDKKind, NDKSigner } from "@nostr-dev-kit/ndk";
import { sha256 } from "js-sha256";
import { encode as blurhashEncode } from "blurhash";
import ngeohash from "ngeohash";
import toast from "react-hot-toast";
// MUI Imports
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";

interface BlossomServer {
  name: string;
  apiUrl: string;
}
const BLOSSOM_SERVERS: BlossomServer[] = [
  { name: "blossom.band", apiUrl: "https://blossom.band" },
  { name: "blossom.primal.net", apiUrl: "https://blossom.primal.net" },
  { name: "nostr.download", apiUrl: "https://nostr.download" },
];
const LOCAL_STORAGE_BLOSSOM_SERVER_URL_KEY = "nostrImageAppBlossomServerUrl";

interface ProcessedImageData {
  blob: Blob;
  hash: string;
  blurhash: string;
  dimensions: { width: number; height: number };
}

interface UploadFormProps {
  initialFile: File;
  onUploadSuccess?: () => void;
  onCancel: () => void;
}

const uploadFileToBlossom = async (
  ndk: NDK,
  signer: NDKSigner,
  uploadBlob: Blob,
  serverApiUrl: string,
  fileHash: string
): Promise<{ url: string; hash: string; mimeType: string }> => {
  const controlEvent = new NDKEvent(ndk!);
  controlEvent.kind = 24242 as NDKKind;
  controlEvent.created_at = Math.floor(Date.now() / 1000);
  controlEvent.tags = [
    ["t", "upload"],
    ["x", fileHash],
    ["expiration", `${Math.floor(Date.now() / 1000) + 60 * 60}`],
  ];
  await controlEvent.sign(signer);
  try {
    await controlEvent.publish();
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } catch (publishError) {
    console.warn(
      "Failed to publish control event, proceeding with upload anyway:",
      publishError
    );
  }
  const putUrl = `${serverApiUrl.replace(/\/$/, "")}/upload`;
  let authHeader = "";
  try {
    const rawEvent = controlEvent.rawEvent();
    if (!rawEvent.id || !rawEvent.sig)
      throw new Error("Control event invalid (missing id/sig)");
    authHeader = `Nostr ${btoa(JSON.stringify(rawEvent))}`;
  } catch (e: any) {
    throw new Error(`Auth header preparation failed: ${e.message}`);
  }
  console.log(`Attempting PUT to ${putUrl} with auth header...`);
  try {
    const response = await fetch(putUrl, {
      method: "PUT",
      headers: { Authorization: authHeader, "Content-Type": uploadBlob.type },
      body: uploadBlob,
    });
    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = `Status: ${response.status}`;
      }
      console.error("Blossom PUT Error Response:", errorBody);
      throw new Error(`Upload failed: ${errorBody}`);
    }
    let responseUrl = "",
      responseHash = "";
    const fileHashFromTag = controlEvent.tagValue("x") || fileHash;
    try {
      const responseData = await response.json();
      console.log("Blossom PUT Success Response:", responseData);
      responseUrl =
        responseData?.url ||
        responseData?.link ||
        `${serverApiUrl.replace(/\/$/, "")}/${fileHashFromTag}`;
      responseHash = responseData?.sha256 || fileHashFromTag;
      if (!responseUrl || !responseHash) {
        console.warn(
          "Response missing URL/Hash, falling back using file hash."
        );
      }
    } catch (jsonError) {
      console.warn(
        "Failed to parse Blossom response JSON, constructing URL/Hash manually.",
        jsonError
      );
      if (!fileHashFromTag)
        throw new Error("JSON parsing failed and no file hash available");
      responseUrl = `${serverApiUrl.replace(/\/$/, "")}/${fileHashFromTag}`;
      responseHash = fileHashFromTag;
    }
    return { url: responseUrl, hash: responseHash, mimeType: uploadBlob.type };
  } catch (error: any) {
    console.error("uploadFileToBlossom fetch/processing error:", error);
    throw new Error(`${error.message || "Upload PUT request failed"}`);
  }
};

export const UploadForm: React.FC<UploadFormProps> = ({
  initialFile,
  onUploadSuccess,
  onCancel,
}) => {
  const { ndk, signer, user } = useNdk();
  const [processedData, setProcessedData] = useState<ProcessedImageData | null>(
    null
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [addLocation, setAddLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lon: number;
    geohash: string;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addContentWarning, setAddContentWarning] = useState(false);
  const [contentWarningReason, setContentWarningReason] = useState("");
  const [selectedServerApiUrl, setSelectedServerApiUrl] = useState<string>(
    () =>
      localStorage.getItem(LOCAL_STORAGE_BLOSSOM_SERVER_URL_KEY) ||
      BLOSSOM_SERVERS[0].apiUrl
  );
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helpers
  const handleServerSelectChangeMUI = useCallback(
    (event: SelectChangeEvent<string>) => {
      setSelectedServerApiUrl(event.target.value as string);
    },
    []
  );
  const handleSetDefault = useCallback(() => {
    localStorage.setItem(
      LOCAL_STORAGE_BLOSSOM_SERVER_URL_KEY,
      selectedServerApiUrl
    );
    const n =
      BLOSSOM_SERVERS.find((s) => s.apiUrl === selectedServerApiUrl)?.name ||
      selectedServerApiUrl;
    toast.success(`Default server saved: ${n}`);
  }, [selectedServerApiUrl]);
  const calculateSha256 = useCallback(
    async (inputBlob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => {
          if (e.target?.result instanceof ArrayBuffer) {
            resolve(sha256(e.target.result));
          } else {
            reject(new Error("Not ArrayBuffer"));
          }
        };
        r.onerror = (e) => {
          reject(new Error(`Read fail:${e}`));
        };
        r.readAsArrayBuffer(inputBlob);
      });
    },
    []
  );
  const generateGeohash = useCallback((lat: number, lon: number): string => {
    try {
      return ngeohash.encode(lat, lon, 9);
    } catch (err: any) {
      console.error("Geohash fail:", err);
      toast.error(`Geohash fail: ${err.message}`);
      return "";
    }
  }, []);
  const handleLocationToggle = useCallback(() => {
    const n = !addLocation;
    setAddLocation(n);
    setLocationError(null);
    if (n && !currentLocation) {
      if (!navigator.geolocation) {
        toast.error("Geolocation not supported");
        setAddLocation(false);
      } else {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const { latitude: lt, longitude: ln } = p.coords;
            const g = generateGeohash(lt, ln);
            if (g) setCurrentLocation({ lat: lt, lon: ln, geohash: g });
            else setAddLocation(false);
            setLocationError(null);
          },
          (e) => {
            console.error(e);
            toast.error(`Geo fail: ${e.message}`);
            setCurrentLocation(null);
            setAddLocation(false);
          }
        );
      }
    } else if (!n) {
      setCurrentLocation(null);
      setLocationError(null);
    }
  }, [addLocation, currentLocation, generateGeohash]);

  // Image Processing
  const processAndGetImageData = useCallback(
    async (sourceFile: File): Promise<ProcessedImageData> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = async () => {
            const canvas = canvasRef.current;
            if (!canvas) return reject(new Error("Canvas ref is null"));
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) return reject(new Error("Canvas context failed"));
            ctx.drawImage(img, 0, 0);
            let calculatedBlurhash = "";
            try {
              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
              );
              calculatedBlurhash = blurhashEncode(
                imageData.data,
                canvas.width,
                canvas.height,
                4,
                3
              );
            } catch (e: any) {
              console.error("Blurhash encoding error:", e);
            }
            canvas.toBlob(
              async (blob) => {
                if (!blob) return reject(new Error("Canvas toBlob failed"));
                try {
                  const hash = await calculateSha256(blob);
                  resolve({
                    blob,
                    hash,
                    blurhash: calculatedBlurhash,
                    dimensions: { width: canvas.width, height: canvas.height },
                  });
                } catch (hashError: any) {
                  reject(new Error(`Hashing failed: ${hashError.message}`));
                }
              },
              sourceFile.type,
              0.9
            );
          };
          img.onerror = (err) =>
            reject(new Error(`Image loading failed: ${err}`));
          if (typeof event.target?.result === "string")
            img.src = event.target.result;
          else reject(new Error("FileReader result was not a string"));
        };
        reader.onerror = (err) =>
          reject(new Error(`FileReader failed: ${err}`));
        reader.readAsDataURL(sourceFile);
      });
    },
    [canvasRef, calculateSha256]
  );

  // Effect to process the initialFile prop
  useEffect(() => {
    let isMounted = true;
    const processFile = async () => {
      if (!initialFile) return;
      console.log(
        "UploadForm: Processing initial file prop:",
        initialFile.name
      );
      setIsProcessingImage(true);
      setProcessedData(null);
      setPreviewUrl(null);
      const processToastId = toast.loading("Processing image...");
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (isMounted) setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(initialFile);
        const data = await processAndGetImageData(initialFile);
        if (isMounted) {
          setProcessedData(data);
          setDescription(
            (prev) =>
              prev ||
              initialFile.name.substring(
                0,
                initialFile.name.lastIndexOf(".")
              ) ||
              initialFile.name
          );
          toast.success("Image ready.", { id: processToastId });
        }
      } catch (err: any) {
        console.error("Initial file processing failed:", err);
        toast.error(`Processing failed: ${err.message}`, {
          id: processToastId,
        });
        if (isMounted) setProcessedData(null);
        onCancel();
      } finally {
        if (isMounted) setIsProcessingImage(false);
      }
    };
    processFile();
    return () => {
      isMounted = false;
    };
  }, [initialFile, processAndGetImageData, onCancel]);

  // --- Main Submit Handler ---
  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!processedData || !signer || !user || !ndk) {
        toast.error("Cannot submit: Missing data, signer, user, or NDK.");
        return;
      }
      if (!description.trim()) {
        toast.error("Description required.");
        return;
      }
      if (addContentWarning && !contentWarningReason.trim()) {
        toast.error("Content Warning Reason required.");
        return;
      }
      const server = BLOSSOM_SERVERS.find(
        (s) => s.apiUrl === selectedServerApiUrl
      );
      if (!server) {
        toast.error(`Invalid Server Selected`);
        return;
      }
      setIsUploading(true);
      setIsPublishing(false);
      const processToastId = toast.loading(
        `Starting upload to ${server.name}...`
      );
      const {
        blob: processedBlob,
        hash: fileHash,
        blurhash: calculatedBlurhash,
        dimensions: calculatedDimensions,
      } = processedData;
      try {
        setIsUploading(true);
        toast.loading(`Uploading to ${server.name}...`, { id: processToastId });
        const uploadResult = await uploadFileToBlossom(
          ndk!,
          signer!,
          processedBlob,
          server.apiUrl,
          fileHash
        );
        setIsUploading(false);
        setIsPublishing(true);
        const { url: imageUrl, hash: imageHashRes, mimeType } = uploadResult;
        toast.loading("Publishing post...", { id: processToastId });
        const kind20Event = new NDKEvent(ndk!);
        kind20Event.kind = 20 as NDKKind;
        kind20Event.content = description.trim();
        const tags: string[][] = [];
        const imetaTag = ["imeta"];
        imetaTag.push(`url ${imageUrl}`);
        imetaTag.push(`m ${mimeType}`);
        imetaTag.push(`x ${imageHashRes}`);
        imetaTag.push(
          `dim ${calculatedDimensions.width}x${calculatedDimensions.height}`
        );
        if (calculatedBlurhash) imetaTag.push(`blurhash ${calculatedBlurhash}`);
        imetaTag.push(`alt ${description.trim()}`);
        tags.push(imetaTag);
        tags.push(["url", imageUrl]);
        tags.push(["m", mimeType]);
        tags.push(["x", imageHashRes]);
        tags.push([
          "dim",
          `${calculatedDimensions.width}x${calculatedDimensions.height}`,
        ]);
        if (calculatedBlurhash) tags.push(["blurhash", calculatedBlurhash]);
        hashtags
          .split(/[,\s]+/)
          .filter(Boolean)
          .forEach((tag) => tags.push(["t", tag.toLowerCase()]));
        if (addLocation && currentLocation?.geohash) {
          tags.push(["g", currentLocation.geohash]);
        }
        if (addContentWarning && contentWarningReason.trim()) {
          tags.push(["content-warning", contentWarningReason.trim()]);
        }
        kind20Event.tags = tags;
        await kind20Event.sign(signer);
        await kind20Event.publish();
        toast.success("Post published successfully!", { id: processToastId });
        setProcessedData(null);
        setPreviewUrl(null);
        setDescription("");
        setHashtags("");
        setAddLocation(false);
        setCurrentLocation(null);
        setLocationError(null);
        setAddContentWarning(false);
        setContentWarningReason("");
        if (onUploadSuccess) onUploadSuccess();
      } catch (err: any) {
        console.error("Submit Error:", err);
        toast.error(`Error: ${err.message || "Unknown error"}`, {
          id: processToastId,
          duration: 5000,
        });
      } finally {
        setIsUploading(false);
        setIsPublishing(false);
      }
    },
    [
      processedData,
      signer,
      user,
      ndk,
      description,
      addContentWarning,
      contentWarningReason,
      selectedServerApiUrl,
      addLocation,
      currentLocation,
      hashtags,
      generateGeohash,
      onUploadSuccess,
      onCancel,
    ]
  );

  // --- Rendering (Using MUI Components) ---
  const isProcessingOverall = isProcessingImage || isUploading || isPublishing;
  let buttonText = "Upload & Post";
  if (isProcessingImage) buttonText = "Processing Image...";
  else if (isUploading) buttonText = "Uploading...";
  else if (isPublishing) buttonText = "Publishing...";

  if (isProcessingImage && !previewUrl) {
    return (
      <Box
        sx={{
          p: 2,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }
  if (!isProcessingImage && !processedData && initialFile) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to process image. Please cancel and try again.
        </Alert>
        <Button onClick={onCancel} variant="outlined">
          Cancel
        </Button>
      </Box>
    );
  }
  if (!processedData) {
    return (
      <Alert severity="error">
        Cannot render form: Image data not available.
      </Alert>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>

      {previewUrl && (
        <Box sx={{ mb: 2, textAlign: "center" }}>
          <img
            src={previewUrl}
            alt="Selected preview"
            style={{
              maxWidth: "200px",
              maxHeight: "200px",
              border: "1px solid #ccc",
              objectFit: "contain",
            }}
          />
        </Box>
      )}

      <TextField
        id="description"
        label="Description / Alt Text *"
        multiline
        rows={3}
        fullWidth
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={isProcessingOverall}
        required
        margin="normal"
      />
      <TextField
        id="hashtags"
        label="Hashtags (space separated)"
        fullWidth
        value={hashtags}
        onChange={(e) => setHashtags(e.target.value)}
        disabled={isProcessingOverall}
        margin="normal"
        helperText="e.g., nostr awesome pics"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={addLocation}
            onChange={handleLocationToggle}
            disabled={isProcessingOverall}
          />
        }
        label="Add Location (Geohash)"
        sx={{ display: "block", mt: 1 }}
      />
      {addLocation && currentLocation && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
          📍 Acquired: {currentLocation.geohash}
        </Typography>
      )}
      {locationError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {locationError}
        </Alert>
      )}
      <FormControlLabel
        control={
          <Checkbox
            checked={addContentWarning}
            onChange={(e) => setAddContentWarning(e.target.checked)}
            disabled={isProcessingOverall}
          />
        }
        label="Add Content Warning"
        sx={{ display: "block", mt: 1 }}
      />
      {addContentWarning && (
        <TextField
          id="contentWarningReason"
          label="Content Warning Reason *"
          fullWidth
          value={contentWarningReason}
          onChange={(e) => setContentWarningReason(e.target.value)}
          disabled={isProcessingOverall}
          required={addContentWarning}
          margin="normal"
          size="small"
        />
      )}
      <FormControl fullWidth margin="normal" disabled={isProcessingOverall}>
        <InputLabel id="server-select-label">Blossom Server</InputLabel>
        <Select
          labelId="server-select-label"
          id="serverSelect"
          value={selectedServerApiUrl}
          label="Blossom Server"
          onChange={handleServerSelectChangeMUI}
        >
          {BLOSSOM_SERVERS.map((server) => (
            <MenuItem key={server.apiUrl} value={server.apiUrl}>
              {" "}
              {server.name}{" "}
            </MenuItem>
          ))}
        </Select>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mt: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {" "}
            Current default:{" "}
            {BLOSSOM_SERVERS.find(
              (s) =>
                s.apiUrl ===
                localStorage.getItem(LOCAL_STORAGE_BLOSSOM_SERVER_URL_KEY)
            )?.name || "None Set"}{" "}
          </Typography>
          <Button
            size="small"
            onClick={handleSetDefault}
            disabled={isProcessingOverall}
          >
            Set as Default
          </Button>
        </Box>
      </FormControl>
      <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button
          onClick={onCancel}
          disabled={isProcessingOverall}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isProcessingOverall || !processedData}
          startIcon={
            isUploading || isPublishing ? (
              <CircularProgress size={20} color="inherit" />
            ) : null
          }
        >
          {buttonText}
        </Button>
      </Box>
    </Box>
  );
};
