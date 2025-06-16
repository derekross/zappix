import { useState, useCallback, useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { LN } from "@getalby/sdk";

export interface NWCConnection {
  isConnected: boolean;
  walletType: "nwc" | "webln" | "none";
  connect: (connectionString: string) => Promise<void>;
  disconnect: () => void;
  sendPayment: (invoice: string) => Promise<string>;
}

// Declare WebLN interface for browser extensions
declare global {
  interface Window {
    webln?: {
      enable: () => Promise<void>;
      sendPayment: (invoice: string) => Promise<{ preimage: string }>;
      getBalance: () => Promise<{ balance: number }>;
      isEnabled: boolean;
    };
  }
}

export function useNWC(): NWCConnection {
  const [nwcString] = useLocalStorage("nwc-string", "");
  const [isConnected, setIsConnected] = useState(false);
  const [walletType, setWalletType] = useState<"nwc" | "webln" | "none">(
    "none"
  );
  const [lnClient, setLnClient] = useState<LN | null>(null);

  const connect = useCallback(async (connectionString: string) => {
    try {
      // Validate connection string format
      if (!connectionString) {
        throw new Error("No connection string provided");
      }

      if (
        !connectionString.startsWith("nostrwalletconnect://") &&
        !connectionString.startsWith("nostr+walletconnect://")
      ) {
        throw new Error("Invalid connection string format");
      }

      // Create LN client
      const client = new LN(connectionString);

      setLnClient(client);
      setIsConnected(true);
      setWalletType("nwc");
    } catch (error) {
      setIsConnected(false);
      setWalletType("none");
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setWalletType("none");
    setLnClient(null);
  }, []);

  // Attempt connection when NWC string changes
  useEffect(() => {
    const sessionKey = "nwc-has-tried-auto-connect";

    // Clear session storage when NWC string changes
    if (nwcString) {
      sessionStorage.removeItem(sessionKey);
    }

    // Only attempt connection if not already connected
    if (
      !isConnected &&
      nwcString &&
      (nwcString.startsWith("nostrwalletconnect://") ||
        nwcString.startsWith("nostr+walletconnect://"))
    ) {
      connect(nwcString).catch(() => {
        // Connection failed silently
      });
    }
    // Only fall back to WebLN if NWC is not available
    else if (!nwcString && window.webln && window.webln.isEnabled) {
      setIsConnected(true);
      setWalletType("webln");
    }
  }, [nwcString, isConnected, connect]);

  const sendPayment = useCallback(
    async (invoice: string) => {
      if (!lnClient) {
        throw new Error("Wallet not connected");
      }

      const response = await lnClient.pay(invoice);
      return response.preimage;
    },
    [lnClient]
  );

  return {
    isConnected,
    walletType,
    connect,
    disconnect,
    sendPayment,
  };
}
