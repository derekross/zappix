import { FormInput } from "@/components/form-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from "@/components/ui/dialog";
import { Loader, WarningIcon } from "@/components/ui/icons";
import { Copy } from "lucide-react";
import { getPublicKey, nip19 } from "nostr-tools";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useNdk } from "../../contexts/NdkContext";

export type SignUpModalProps = {
  trigger: React.ReactNode;
};

export const SignUpModal: React.FC<SignUpModalProps> = (props) => {
  const { trigger } = props;

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
    } catch (err: any) {
      toast.error(`Login failed: ${err.message || "Unknown error"}`, {
        id: toastId,
      });
    } finally {
      setIsLoggingIn(false);
    }
  }, [loginWithNsec, nsec]);

  return (
    <Dialog
      onOpenChange={(open) => {
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
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>Generate New Keys</DialogHeader>

        {isGenerating && <Loader />}

        {!isGenerating && !generated && (
          // Show button only if explicitly not generated and not generating
          <Button disabled={isGenerating} onClick={generateKeys}>
            Generate Keys
          </Button>
        )}

        {generated && (
          <>
            <Alert>
              <WarningIcon />
              <AlertTitle>Secure Your Keys</AlertTitle>
              <AlertDescription>
                <p>
                  <span className="font-semibold">IMPORTANT</span>: Save your{" "}
                  <span className="font-semibold">Secret Key (nsec)</span> somewhere safe (password
                  manager). If you lose it, you lose access to your account.{" "}
                  <span className="font-semibold">Do not share it with anyone.</span>
                </p>
              </AlertDescription>
            </Alert>
            <FormInput
              label="Public Key (npub)"
              readOnly
              trailing={
                <Button
                  onClick={() => {
                    copyToClipboard(npub, "Public Key");
                  }}
                  variant="tertiary"
                >
                  <Copy />
                </Button>
              }
              value={npub}
            />
            <FormInput
              label="Secret Key (nsec)"
              readOnly
              trailing={
                <Button
                  onClick={() => {
                    copyToClipboard(nsec, "Secret Key");
                  }}
                  variant="tertiary"
                >
                  <Copy />
                </Button>
              }
              type="password"
              value={nsec}
            />
            <Button disabled={isLoggingIn || isGenerating} onClick={handleLoginWithGeneratedKey}>
              {isLoggingIn ? <Loader /> : "Login with this New Key"}
            </Button>
            <Button
              disabled={isLoggingIn || isGenerating}
              onClick={generateKeys}
              variant="secondary"
            >
              Regenerate
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
