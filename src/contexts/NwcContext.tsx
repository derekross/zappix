import * as React from "react";
import { nwc } from "@getalby/sdk";

interface NwcContextType {
  nwcClient: nwc.NWCClient | null;
  isConnected: boolean;
  error: string | null;
  isInitializing: boolean;
  connect: (connectionString: string) => Promise<nwc.NWCClient>;
  disconnect: () => void;
}

const defaultContext: NwcContextType = {
  nwcClient: null,
  isConnected: false,
  error: null,
  isInitializing: true,
  connect: async () => {
    throw new Error("useNwc must be used within an NwcProvider");
  },
  disconnect: () => {
    throw new Error("useNwc must be used within an NwcProvider");
  },
};

const NwcContext = React.createContext<NwcContextType>(defaultContext);

export const useNwc = () => {
  const context = React.useContext(NwcContext);
  if (context === defaultContext) {
    throw new Error("useNwc must be used within an NwcProvider");
  }
  return context;
};

interface NwcProviderProps {
  children: React.ReactNode;
}

export const NwcProvider: React.FC<NwcProviderProps> = ({ children }) => {
  const [nwcClient, setNwcClient] = React.useState<nwc.NWCClient | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isInitializing, setIsInitializing] = React.useState(true);

  // Debug effect to log state changes
  React.useEffect(() => {
    console.log("NWC State Update:", {
      hasClient: !!nwcClient,
      isConnected,
      error,
      isInitializing,
    });
  }, [nwcClient, isConnected, error, isInitializing]);

  // Load saved connection string on mount
  React.useEffect(() => {
    let mounted = true;

    const initializeNWC = async () => {
      console.log("NWC: Starting initialization...");
      try {
        const savedConnectionString = localStorage.getItem("nwc_connection_string");
        console.log("NWC: Saved connection string found:", !!savedConnectionString);

        if (!savedConnectionString) {
          console.log("NWC: No saved connection string, skipping initialization");
          if (mounted) {
            setIsInitializing(false);
          }
          return;
        }

        console.log("NWC: Creating client with saved connection string...");
        const client = new nwc.NWCClient({
          nostrWalletConnectUrl: savedConnectionString,
        });

        console.log("NWC: Testing connection...");
        const info = await client.getInfo();
        console.log("NWC: Connection successful, info:", info);

        if (mounted) {
          console.log("NWC: Updating state with connected client");
          setNwcClient(client);
          setIsConnected(true);
          setIsInitializing(false);
        }
      } catch (err) {
        console.error("NWC: Failed to initialize:", err);
        if (mounted) {
          setError("Failed to initialize NWC");
          setIsConnected(false);
          setNwcClient(null);
          setIsInitializing(false);
          localStorage.removeItem("nwc_connection_string");
        }
      }
    };

    initializeNWC();

    return () => {
      mounted = false;
    };
  }, []);

  const connect = React.useCallback(async (connectionString: string) => {
    console.log("NWC: Starting connection process...");
    let client: nwc.NWCClient | null = null;

    try {
      setError(null);

      if (!connectionString) {
        throw new Error("Connection string is required");
      }

      console.log("NWC: Validating connection string format...");

      // Trim whitespace and validate format
      const trimmedString = connectionString.trim();
      if (!trimmedString.match(/^(nostr\+?walletconnect:\/\/).+/)) {
        throw new Error(
          "Invalid NWC connection string format. Must start with 'nostrwalletconnect://' or 'nostr+walletconnect://'",
        );
      }

      // Normalize the connection string to use nostrwalletconnect://
      const normalizedConnectionString = trimmedString.replace(
        "nostr+walletconnect://",
        "nostrwalletconnect://",
      );

      console.log("NWC: Creating client with normalized connection string");
      client = new nwc.NWCClient({
        nostrWalletConnectUrl: normalizedConnectionString,
      });

      if (!client) {
        throw new Error("Failed to create NWC client");
      }

      console.log("NWC: Testing connection...");
      const info = await Promise.race([
        client.getInfo(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 10000),
        ),
      ]);

      if (!info) {
        throw new Error("Failed to get wallet info");
      }

      console.log("NWC: Connection successful, info:", info);

      // Save connection string first
      localStorage.setItem("nwc_connection_string", normalizedConnectionString);
      console.log("NWC: Connection string saved to localStorage");

      // Then update state
      console.log("NWC: Updating state...");
      setNwcClient(client);
      setIsConnected(true);
      console.log("NWC: Connection process complete");

      return client;
    } catch (err) {
      console.error("NWC: Connection failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to connect to NWC";
      setError(errorMessage);
      setIsConnected(false);
      setNwcClient(null);
      localStorage.removeItem("nwc_connection_string");
      throw err;
    }
  }, []);

  const disconnect = React.useCallback(() => {
    console.log("NWC: Disconnecting...");
    if (nwcClient) {
      nwcClient.close();
    }
    setNwcClient(null);
    setIsConnected(false);
    localStorage.removeItem("nwc_connection_string");
    console.log("NWC: Disconnected");
  }, [nwcClient]);

  const contextValue = React.useMemo(
    () => ({
      nwcClient,
      isConnected,
      error,
      isInitializing,
      connect,
      disconnect,
    }),
    [nwcClient, isConnected, error, isInitializing, connect, disconnect],
  );

  return <NwcContext.Provider value={contextValue}>{children}</NwcContext.Provider>;
};
