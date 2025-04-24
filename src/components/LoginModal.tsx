import CloseIcon from "@mui/icons-material/Close";
import ExtensionIcon from "@mui/icons-material/Extension";
import PasswordIcon from "@mui/icons-material/Password";
import Alert from "@mui/material/Alert";
// MUI Imports
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Modal from "@mui/material/Modal";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// src/components/LoginModal.tsx
// FIX: Add useEffect back to the import
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNdk } from "../contexts/NdkContext";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ onClose, open }: LoginModalProps) {
  const { loginWithNip07, loginWithNsec } = useNdk();
  const [error, setError] = useState<null | string>(null);
  const [nsecInput, setNsecInput] = useState<string>("");
  const [loginMethodLoading, setLoginMethodLoading] = useState<null | "nip07" | "nsec">(null);

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
    <Modal aria-labelledby="login-modal-title" onClose={onClose} open={open}>
      <Box
        sx={{
          bgcolor: "background.paper",
          border: "1px solid #ccc",
          borderRadius: 2,
          boxShadow: 24,
          left: "50%",
          p: { sm: 3, xs: 2 },
          position: "absolute",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: { sm: 450, xs: "90%" },
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
          <Typography component="h2" id="login-modal-title" variant="h6">
            {" "}
            Login Options{" "}
          </Typography>
          <IconButton aria-label="close login modal" onClick={onClose} size="small">
            {" "}
            <CloseIcon />{" "}
          </IconButton>
        </Box>
        <Box sx={{ mb: 2 }}>
          <Button
            disabled={!!loginMethodLoading}
            fullWidth
            onClick={handleNip07Login}
            startIcon={
              loginMethodLoading === "nip07" ? (
                <CircularProgress color="inherit" size={20} />
              ) : (
                <ExtensionIcon />
              )
            }
            variant="contained"
          >
            {" "}
            Login with Extension (Recommended){" "}
          </Button>
          <Typography
            display="block"
            sx={{ color: "text.secondary", mt: 1, textAlign: "center" }}
            variant="caption"
          >
            {" "}
            Uses Alby, nos2x, etc.{" "}
          </Typography>
        </Box>
        <Divider sx={{ my: 2 }}>OR</Divider>
        <Box sx={{ mt: 2 }}>
          <Typography gutterBottom variant="body2">
            Login with Secret Key (nsec):
          </Typography>
          <Stack alignItems="stretch" direction={{ sm: "row", xs: "column" }} spacing={1}>
            <TextField
              disabled={!!loginMethodLoading}
              error={!!error && !error.includes("NIP-07")}
              id="nsecInput"
              label="NSEC Key"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNsecInput(e.target.value)}
              placeholder="nsec1..."
              size="small"
              sx={{ flexGrow: 1 }}
              type="password"
              value={nsecInput}
            />
            <Button
              disabled={!!loginMethodLoading || !nsecInput.startsWith("nsec1")}
              onClick={handleNsecLogin}
              startIcon={
                loginMethodLoading === "nsec" ? (
                  <CircularProgress color="inherit" size={20} />
                ) : (
                  <PasswordIcon />
                )
              }
              sx={{ flexShrink: 0 }}
              variant="outlined"
            >
              {" "}
              Login{" "}
            </Button>
          </Stack>
          <Typography display="block" sx={{ color: "error.main", mt: 1 }} variant="caption">
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
