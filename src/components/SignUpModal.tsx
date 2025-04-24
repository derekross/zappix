import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Alert from "@mui/material/Alert";
// MUI Imports
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Modal from "@mui/material/Modal";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Only import getPublicKey and nip19 from nostr-tools
import { getPublicKey, nip19 } from "nostr-tools";
// src/components/SignUpModal.tsx
// FIX 1: Removed unused React import
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNdk } from "../contexts/NdkContext";

interface SignUpModalProps {
  open: boolean;
  onClose: () => void;
}

export function SignUpModal({ onClose, open }: SignUpModalProps) {
  const { loginWithNsec } = useNdk();
  const [nsec, setNsec] = useState("");
  const [npub, setNpub] = useState("");
  const [generated, setGenerated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate keys using window.crypto and nostr-tools getPublicKey/nip19
  const generateKeys = useCallback(() => {
    setIsGenerating(true);
    setGenerated(false);
    setNsec("");
    setNpub("");
    setTimeout(() => {
      try {
        if (!window.crypto || !window.crypto.getRandomValues) {
          throw new Error("Web Crypto API not available in this browser.");
        }
        const skBytes = window.crypto.getRandomValues(new Uint8Array(32));
        const pkHex = getPublicKey(skBytes);
        const generatedNsec = nip19.nsecEncode(skBytes);
        const generatedNpub = nip19.npubEncode(pkHex);

        setNsec(generatedNsec);
        setNpub(generatedNpub);
        setGenerated(true);
        toast.success("New keys generated!");
      } catch (e: any) {
        console.error("Key generation failed:", e);
        toast.error(`Failed to generate keys: ${e.message || "Unknown error"}`);
      } finally {
        setIsGenerating(false);
      }
    }, 50); // Short delay for visual feedback
  }, []);

  // Generate immediately when modal opens if needed
  useEffect(() => {
    if (open && !generated && !isGenerating && !nsec) {
      // Added !nsec check
      generateKeys();
    }
    // Reset if modal closes
    if (!open) {
      setGenerated(false);
      setNsec("");
      setNpub("");
      setIsGenerating(false); // Ensure generating flag resets
      setIsLoggingIn(false); // Ensure logging flag resets
    }
  }, [open, generated, isGenerating, generateKeys, nsec]); // Added nsec dependency

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${type} copied!`))
      // FIX 2: Remove unused 'err' parameter
      .catch(() => toast.error(`Failed to copy ${type}.`));
  };

  const handleLoginWithGeneratedKey = useCallback(async () => {
    if (!nsec) {
      toast.error("No key generated or available.");
      return;
    }
    setIsLoggingIn(true);
    const toastId = toast.loading("Logging in...");
    try {
      await loginWithNsec(nsec);
      toast.success("Logged in!", { id: toastId });
      onClose(); // Close modal on successful login
    } catch (err: any) {
      toast.error(`Login failed: ${err.message || "Unknown error"}`, {
        id: toastId,
      });
    } finally {
      setIsLoggingIn(false);
    }
  }, [loginWithNsec, onClose, nsec]);

  return (
    <Modal aria-labelledby="signup-modal-title" onClose={onClose} open={open}>
      <Box
        sx={{
          bgcolor: "background.paper",
          border: "1px solid #ccc",
          borderRadius: 2,
          boxShadow: 24,
          left: "50%",
          outline: "none",
          p: { sm: 3, xs: 2 },
          position: "absolute",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: { sm: 500, xs: "90%" },
        }}
      >
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography component="h2" id="signup-modal-title" variant="h6">
            {" "}
            Generate New Keys{" "}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {isGenerating && (
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              justifyContent: "center",
              p: 3,
            }}
          >
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Generating keys...</Typography>
          </Box>
        )}

        {!isGenerating && !generated && (
          // Show button only if explicitly not generated and not generating
          <Button disabled={isGenerating} onClick={generateKeys} variant="contained">
            Generate Keys
          </Button>
        )}

        {generated && (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              **IMPORTANT:** Save your **Secret Key (nsec)** somewhere safe (password manager). If
              you lose it, you lose access to your account. **Do not share it with anyone.**
            </Alert>
            <TextField
              InputProps={{
                endAdornment: (
                  <IconButton
                    edge="end"
                    onClick={() => copyToClipboard(npub, "Public Key")}
                    title="Copy Public Key"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                ),
                readOnly: true,
              }}
              fullWidth
              helperText="Share this publicly. Others use it to find you."
              label="Public Key (npub)"
              margin="normal"
              size="small"
              value={npub}
              variant="outlined"
            />
            <TextField
              InputProps={{
                endAdornment: (
                  <IconButton
                    edge="end"
                    onClick={() => copyToClipboard(nsec, "Secret Key")}
                    title="Copy Secret Key"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                ),
                readOnly: true,
              }}
              fullWidth
              helperText="KEEP THIS SECRET! Needed to log in."
              label="Secret Key (nsec)"
              margin="normal"
              size="small"
              sx={{ mb: 2 }}
              type="password" // Mask the key
              value={nsec}
              variant="outlined"
            />
            <Box sx={{ display: "flex", gap: 1, justifyContent: "space-between" }}>
              <Button
                color="primary"
                disabled={isLoggingIn || isGenerating}
                onClick={handleLoginWithGeneratedKey}
                variant="contained"
              >
                {isLoggingIn ? (
                  <CircularProgress color="inherit" size={24} />
                ) : (
                  "Login with this New Key"
                )}
              </Button>
              <Button
                disabled={isLoggingIn || isGenerating}
                onClick={generateKeys}
                variant="outlined"
              >
                Regenerate
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Modal>
  );
}
