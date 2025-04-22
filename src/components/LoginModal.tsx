// src/components/LoginModal.tsx
// FIX: Add useEffect back to the import
import { useState, ChangeEvent, useCallback, useEffect } from "react";
import { useNdk } from "../contexts/NdkContext";
// MUI Imports
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import PasswordIcon from "@mui/icons-material/Password";
import ExtensionIcon from "@mui/icons-material/Extension";
import Modal from "@mui/material/Modal";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import toast from "react-hot-toast";
import Stack from "@mui/material/Stack";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  const { loginWithNip07, loginWithNsec } = useNdk();
  const [error, setError] = useState<string | null>(null);
  const [nsecInput, setNsecInput] = useState<string>("");
  const [loginMethodLoading, setLoginMethodLoading] = useState<
    "nip07" | "nsec" | null
  >(null);

  const handleNip07Login = useCallback(async () => {
    setError(null);
    setLoginMethodLoading("nip07");
    const toastId = toast.loading("Connecting...");
    try {
      await loginWithNip07();
      toast.success("Logged in!", { id: toastId });
      onClose();
    } catch (err: any) {
      const msg = err.message || "NIP-07 failed";
      setError(msg);
      toast.error(`Login Fail: ${msg}`, { id: toastId });
    } finally {
      setLoginMethodLoading(null);
    }
  }, [loginWithNip07, onClose]);

  const handleNsecLogin = useCallback(async () => {
    setError(null);
    if (!nsecInput.trim() || !nsecInput.startsWith("nsec1")) {
      setError("Invalid NSEC format");
      return;
    }
    setLoginMethodLoading("nsec");
    const toastId = toast.loading("Logging in...");
    try {
      await loginWithNsec(nsecInput.trim());
      toast.success("Logged in!", { id: toastId });
      setNsecInput("");
      onClose();
    } catch (err: any) {
      const msg = err.message || "NSEC failed";
      setError(msg);
      toast.error(`Login Fail: ${msg}`, { id: toastId });
    } finally {
      setLoginMethodLoading(null);
    }
  }, [loginWithNsec, onClose, nsecInput]);

  // Clear error and input when modal opens/closes
  useEffect(() => {
    if (!open) {
      setError(null);
      setNsecInput("");
      setLoginMethodLoading(null);
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} aria-labelledby="login-modal-title">
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: "90%", sm: 450 },
          bgcolor: "background.paper",
          border: "1px solid #ccc",
          boxShadow: 24,
          p: { xs: 2, sm: 3 },
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography id="login-modal-title" variant="h6" component="h2">
            {" "}
            Login Options{" "}
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="close login modal"
          >
            {" "}
            <CloseIcon />{" "}
          </IconButton>
        </Box>
        <Box sx={{ mb: 2 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={
              loginMethodLoading === "nip07" ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <ExtensionIcon />
              )
            }
            onClick={handleNip07Login}
            disabled={!!loginMethodLoading}
          >
            {" "}
            Login with Extension (Recommended){" "}
          </Button>
          <Typography
            variant="caption"
            display="block"
            sx={{ mt: 1, textAlign: "center", color: "text.secondary" }}
          >
            {" "}
            Uses Alby, nos2x, etc.{" "}
          </Typography>
        </Box>
        <Divider sx={{ my: 2 }}>OR</Divider>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Login with Secret Key (nsec):
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems="stretch"
          >
            <TextField
              id="nsecInput"
              type="password"
              label="NSEC Key"
              size="small"
              value={nsecInput}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setNsecInput(e.target.value)
              }
              placeholder="nsec1..."
              sx={{ flexGrow: 1 }}
              disabled={!!loginMethodLoading}
              error={!!error && !error.includes("NIP-07")}
            />
            <Button
              variant="outlined"
              startIcon={
                loginMethodLoading === "nsec" ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <PasswordIcon />
                )
              }
              onClick={handleNsecLogin}
              disabled={!!loginMethodLoading || !nsecInput.startsWith("nsec1")}
              sx={{ flexShrink: 0 }}
            >
              {" "}
              Login{" "}
            </Button>
          </Stack>
          <Typography
            variant="caption"
            display="block"
            sx={{ mt: 1, color: "error.main" }}
          >
            {" "}
            ⚠️ Warning: Less secure. Use extensions if possible.{" "}
          </Typography>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>
    </Modal>
  );
}
