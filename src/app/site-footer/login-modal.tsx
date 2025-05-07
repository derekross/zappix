import { FormInput } from "@/components/form-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from "@/components/ui/dialog";
import { ErrorIcon, Loader, WarningIcon } from "@/components/ui/icons";
import { Blocks, LockKeyhole } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useNdk } from "../../contexts/NdkContext";

export type LoginModalProps = {
  trigger: React.ReactNode;
};

export const LoginModal: React.FC<LoginModalProps> = (props) => {
  const { trigger } = props;
  const [open, setOpen] = React.useState(false);

  const { loginWithNip07, loginWithNsec } = useNdk();
  const [error, setError] = React.useState<null | string>(null);
  const [nsecInput, setNsecInput] = React.useState<string>("");
  const [loginMethodLoading, setLoginMethodLoading] = React.useState<null | "nip07" | "nsec">(null);

  const handleNip07Login = React.useCallback(async () => {
    setError(null);
    setLoginMethodLoading("nip07");
    const toastId = toast.loading("Connecting...");
    try {
      await loginWithNip07();
      toast.success("Logged in!", { id: toastId });
      setOpen(false);
    } catch (err: Error | unknown) {
      const msg = err instanceof Error ? err.message : "NIP-07 failed";
      setError(msg);
      toast.error(`Login Fail: ${msg}`, { id: toastId });
    } finally {
      setLoginMethodLoading(null);
    }
  }, [loginWithNip07]);

  const handleNsecLogin = React.useCallback(async () => {
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
      setOpen(false);
    } catch (err: Error | unknown) {
      const msg = err instanceof Error ? err.message : "NSEC failed";
      setError(msg);
      toast.error(`Login Fail: ${msg}`, { id: toastId });
    } finally {
      setLoginMethodLoading(null);
    }
  }, [loginWithNsec, nsecInput]);

  // Clear error and input when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setError(null);
      setNsecInput("");
      setLoginMethodLoading(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>Login</DialogHeader>
        <div className="flex flex-col gap-2">
          {error != null && (
            <Alert>
              <ErrorIcon />
              <AlertTitle>Login Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            className="flex items-center justify-center gap-1"
            disabled={!!loginMethodLoading}
            onClick={handleNip07Login}
          >
            {loginMethodLoading === "nip07" ? <Loader /> : <Blocks />}
            Login with Extension (Recommended)
          </Button>
          <p className="text-center text-gray-500">uses Alby, nos2x, etc.</p>
          <hr />
          <FormInput
            disabled={!!loginMethodLoading}
            id="nsecInput"
            label="Login with Secret Key (nsec)"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNsecInput(e.target.value)}
            placeholder="nsec1..."
            type="password"
            value={nsecInput}
          />
          <Button
            className="flex items-center justify-center gap-1"
            onClick={handleNsecLogin}
            variant="secondary"
          >
            {loginMethodLoading === "nsec" ? <Loader /> : <LockKeyhole />}
            Login
          </Button>
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <WarningIcon />
            <span>Warning: Less secure. use extensions if possible.</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
