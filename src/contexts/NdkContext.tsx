// src/contexts/NdkContext.tsx - Delay profile fetch until after NIP-65 check
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
// FIX 1 & 2: Removed unused NDKKind, NostrEvent
import NDK, {
  NDKNip07Signer,
  NDKPrivateKeySigner,
  NDKUser,
  NDKEvent,
  NDKFilter,
  NDKSigner,
  NDKSubscriptionCacheUsage,
  NDKUserProfile,
} from "@nostr-dev-kit/ndk";
import toast from "react-hot-toast";
import { PaletteMode } from "@mui/material"; // Keep PaletteMode if used by Theme context elsewhere

const LS_THEME_MODE_KEY = "zappixThemeMode";

interface NdkContextProps {
  ndk: NDK | null;
  user: NDKUser | null;
  signer: NDKSigner | null;
  loggedInUserProfile: NDKUserProfile | null;
  loginWithNip07: () => Promise<void>;
  loginWithNsec: (nsec: string) => Promise<void>;
  logout: () => void;
  readRelays: string[];
  writeRelays: string[];
  explicitRelayUrls: string[];
  defaultRelays: string[];
  relaySource: "nip65" | "default" | "loading" | "logged_out";
  nip65Event: NDKEvent | null;
  isPublishingNip65: boolean;
  publishNip65Relays: (
    readList: string[],
    writeList: string[]
  ) => Promise<boolean>;
  fetchNip65Relays: (userToFetch: NDKUser) => Promise<void>;
  themeMode: PaletteMode;
  toggleThemeMode: () => void;
}

const NdkContext = createContext<NdkContextProps | undefined>(undefined);

const defaultRelays = [
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://relay.snort.social",
  // "wss://purplepag.es",
  "wss://nostr.wine",
  "wss://relay.nostr.band",
  "wss://nos.lol",
];

const LOCAL_STORAGE_KEYS = {
  NPUB: "npub",
  NSEC: "nsec",
};

export const NdkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [ndk, setNdk] = useState<NDK | null>(null);
  const [signer, setSigner] = useState<NDKSigner | null>(null);
  const [user, setUser] = useState<NDKUser | null>(null);
  const [loggedInUserProfile, setLoggedInUserProfile] =
    useState<NDKUserProfile | null>(null);
  const [readRelays, setReadRelays] = useState<string[]>(defaultRelays);
  const [writeRelays, setWriteRelays] = useState<string[]>(defaultRelays);
  const [explicitRelayUrls, setExplicitRelayUrls] =
    useState<string[]>(defaultRelays);
  const [relaySource, setRelaySource] = useState<
    "nip65" | "default" | "loading" | "logged_out"
  >("logged_out");
  const [nip65Event, setNip65Event] = useState<NDKEvent | null>(null);
  const [isPublishingNip65, setIsPublishingNip65] = useState(false);
  const [themeMode, setThemeMode] = useState<PaletteMode>(() => {
    const storedMode = localStorage.getItem(LS_THEME_MODE_KEY);
    return storedMode === "dark" || storedMode === "light"
      ? storedMode
      : "light";
  });

  // NDK Initialization Effect
  useEffect(() => {
    const instance = new NDK({
      explicitRelayUrls: explicitRelayUrls,
      signer: signer || undefined,
      // FIX 3: Removed debug property
    });
    // Standard pool events
    instance.pool.on("relay:connect", (relay) =>
      console.log(`✅ Connected to relay: ${relay.url}`)
    );
    instance.pool.on("relay:disconnect", (relay) =>
      console.log(`❌ Disconnected from relay: ${relay.url}`)
    );
    // FIX 4: Removed unsupported 'relay:error' listener
    setNdk(instance);
    instance
      .connect(5000)
      .catch((err) => console.error("NDK connect() error:", err)); // Added timeout example
    return () => {
      // Cleanup listeners and disconnect relays
      instance.pool?.removeAllListeners();
      // Use disconnect method if available, otherwise fallback may not be needed if pool manages connections
      instance.pool?.relays.forEach((relay) => {
        try {
          relay.disconnect();
        } catch (e) {
          console.warn(`Error disconnecting ${relay.url}`, e);
        }
      });
      setNdk(null); // Ensure NDK instance is cleared
    };
  }, [explicitRelayUrls, signer]); // Dependencies are correct

  // Update explicitRelayUrls when read/write lists change
  useEffect(() => {
    const combined = Array.from(new Set([...readRelays, ...writeRelays]));
    setExplicitRelayUrls(combined);
  }, [readRelays, writeRelays]);

  // Logout Function (memoized)
  const logout = useCallback(() => {
    setSigner(null);
    setUser(null);
    setLoggedInUserProfile(null);
    setNip65Event(null);

    setReadRelays(defaultRelays);
    setWriteRelays(defaultRelays);
    setRelaySource("logged_out");
    
    localStorage.removeItem(LOCAL_STORAGE_KEYS.NPUB);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.NSEC);
    
    toast.success("Logged out");
  }, []);

  // Fetch NIP-65 Relays (memoized)
  const fetchNip65Relays = useCallback(
    async (userToFetch: NDKUser) => {
      if (!ndk) return;
      console.log("Fetching NIP-65 for", userToFetch.pubkey);
      setRelaySource("loading");
      setNip65Event(null);
      try {
        // Use literal kind number as NDKKind was removed
        const filter: NDKFilter = {
          kinds: [10002],
          authors: [userToFetch.pubkey],
          limit: 1,
        };
        // FIX 5: Use CACHE_FIRST workaround for NDKSubscriptionCacheUsage
        const latestNip65 = await ndk.fetchEvent(filter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        if (latestNip65) {
          console.log("Found NIP-65 event:", latestNip65.id);
          setNip65Event(latestNip65);
          const readSet = new Set<string>();
          const writeSet = new Set<string>();
          latestNip65.tags.forEach((tag) => {
            if (tag[0] === "r" && tag[1]?.startsWith("wss://")) {
              const marker = tag[2]?.toLowerCase();
              if (marker === "read") readSet.add(tag[1]);
              else if (marker === "write") writeSet.add(tag[1]);
              else {
                readSet.add(tag[1]);
                writeSet.add(tag[1]);
              } // Default to both if no marker
            }
          });
          const parsedRead = Array.from(readSet);
          const parsedWrite = Array.from(writeSet);
          if (parsedRead.length > 0 || parsedWrite.length > 0) {
            setReadRelays(parsedRead.length > 0 ? parsedRead : defaultRelays); // Fallback if only write found
            setWriteRelays(
              parsedWrite.length > 0 ? parsedWrite : defaultRelays
            ); // Fallback if only read found
            setRelaySource("nip65");
          } else {
            setReadRelays(defaultRelays);
            setWriteRelays(defaultRelays);
            setRelaySource("default"); // Empty NIP-65 uses defaults
          }
        } else {
          console.log("No NIP-65 event found, using defaults.");
          setReadRelays(defaultRelays);
          setWriteRelays(defaultRelays);
          setRelaySource("default");
        }
      } catch (error) {
        console.error("Error fetching NIP-65:", error);
        setReadRelays(defaultRelays);
        setWriteRelays(defaultRelays);
        setRelaySource("default");
        setNip65Event(null);
      }
    },
    [ndk]
  ); // Removed defaultRelays from deps, they don't change

  // Login Functions (memoized)
  const loginWithNip07 = useCallback(async () => {
    if (!ndk) throw new Error("NDK not initialized");
    try {
      const nip07signer = new NDKNip07Signer();
      // Wait for user confirmation if needed
      await nip07signer.blockUntilReady(); // Important for NIP-07
      const localNdkUser = await nip07signer.user(); // Fetch user after ready
      if (!localNdkUser?.pubkey) throw new Error("No pubkey from NIP-07");
      localNdkUser.ndk = ndk; // Associate NDK instance
      setSigner(nip07signer);
      setUser(localNdkUser);

      // Get currently stored npub from localstorage.
      const localStoragePub = localStorage.getItem(LOCAL_STORAGE_KEYS.NPUB);
      // If no npub was previously stored in localstorage, display a login message to the user.
      if (localStoragePub == null) {
        toast.success("Logged in with extension!");
      }
      // Store the logged in user's npub in localstorage.
      localStorage.setItem(LOCAL_STORAGE_KEYS.NPUB, localNdkUser.npub);

      await fetchNip65Relays(localNdkUser); // Fetch relays after user is set
    } catch (error) {
      console.error("NIP-07 login failed:", error);
      logout(); // Ensure logout state on failure
      toast.error(
        `NIP-07 Login failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error; // Re-throw if needed by caller
    }
  }, [ndk, fetchNip65Relays, logout]);

  const loginWithNsec = useCallback(
    async (nsec: string) => {
      if (!ndk) throw new Error("NDK not initialized");
      try {
        const pkSigner = new NDKPrivateKeySigner(nsec);
        const localNdkUser = await pkSigner.user();
        if (!localNdkUser?.pubkey) throw new Error("No pubkey from NSEC");
        localNdkUser.ndk = ndk;
        setSigner(pkSigner);
        setUser(localNdkUser);

        // Get currently stored npub from localstorage.
        const localStoragePub = localStorage.getItem(LOCAL_STORAGE_KEYS.NPUB);
        // If no npub was previously stored in localstorage, display a login message to the user.
        if (localStoragePub == null) {
          toast.success("Logged in with NSEC!");
        }
        // Store the logged in user's npub and nsec in localstorage.
        localStorage.setItem(LOCAL_STORAGE_KEYS.NPUB, localNdkUser.npub);
        localStorage.setItem(LOCAL_STORAGE_KEYS.NSEC, nsec);

        await fetchNip65Relays(localNdkUser);
      } catch (error) {
        console.error("NSEC login failed:", error);
        logout();
        toast.error(
          `NSEC Login failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },
    [ndk, fetchNip65Relays, logout]
  );

  useEffect(() => {
    // Get public and secret keys from localstorage.
    const localStoragePub = localStorage.getItem(LOCAL_STORAGE_KEYS.NPUB);
    const localStorageSec = localStorage.getItem(LOCAL_STORAGE_KEYS.NSEC);

    // Autologin should be attempted if ndk is initialized and no user object is available.
    const shouldAttemptAutoLogin = ndk != null && user == null;
    // User has previously logged in with nsec if it is available in localstorage.
    const isUserLoggedInWithNsec = localStorageSec != null;
    // User has previously logged in with a browser extension if the npub is available
    // but the nsec is not.
    const isUserLoggedInWithExtension =
      !isUserLoggedInWithNsec && localStoragePub != null;

    if (shouldAttemptAutoLogin) {
      if (isUserLoggedInWithNsec) {
        loginWithNsec(localStorageSec);
      }

      if (isUserLoggedInWithExtension) {
        loginWithNip07();
      }
    }
  }, [ndk, user, loginWithNsec, loginWithNip07]);

  // Effect: Fetch profile *after* user is set and NIP-65 check is done
  useEffect(() => {
    if (user && relaySource !== "loading") {
      console.log(
        `NdkContext: User logged in (${user.pubkey}) and relay source settled (${relaySource}). Fetching profile...`
      );
      // Use CACHE_FIRST for profile fetch as well, might be slightly stale but avoids potential type issues
      user
        .fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
        .then((profile) => {
          console.log(
            "NdkContext: Delayed fetchProfile succeeded. Profile:",
            profile
          );
          setLoggedInUserProfile(profile); // Set profile (null is valid)
        })
        .catch((err) => {
          console.error("NdkContext: Delayed fetchProfile failed:", err);
          setLoggedInUserProfile(null);
        });
    } else if (!user) {
      setLoggedInUserProfile(null); // Clear on logout
    }
  }, [user, relaySource]); // Dependencies

  // Publish NIP-65 Relays (memoized)
  const publishNip65Relays = useCallback(
    async (readList: string[], writeList: string[]): Promise<boolean> => {
      if (!ndk || !signer || !user) {
        toast.error(
          "Cannot publish relays: NDK, signer, or user not available."
        );
        return false;
      }
      setIsPublishingNip65(true);
      try {
        const event = new NDKEvent(ndk);
        event.kind = 10002; // Use literal number
        event.created_at = Math.floor(Date.now() / 1000);
        event.pubkey = user.pubkey;

        // Deduplicate tags based on relay URL only for 'r' tags
        const relayTags = new Map<string, string[]>();
        readList.forEach((url) => relayTags.set(url, ["r", url, "read"]));
        writeList.forEach((url) => {
          // If already marked as read, don't overwrite, just add write implicitly (or could mark both explicitly)
          if (!relayTags.has(url)) {
            relayTags.set(url, ["r", url, "write"]);
          } else {
            // Optionally mark as read & write if needed, or just let default handle it
            // If a relay is in both lists, assume read+write (no marker needed)
            relayTags.set(url, ["r", url]);
          }
        });
        // Handle case where a relay is ONLY in writeList but also appears in readList
        // The logic above prioritizes read marker or no marker if in both.
        // A more explicit way if needed:
        /*
             const tagMap = new Map<string, {read: boolean, write: boolean}>();
             readList.forEach(url => tagMap.set(url, {...tagMap.get(url), read: true}));
             writeList.forEach(url => tagMap.set(url, {...tagMap.get(url), write: true}));
             event.tags = Array.from(tagMap.entries()).map(([url, markers]) => {
                if (markers.read && markers.write) return ['r', url];
                if (markers.read) return ['r', url, 'read'];
                if (markers.write) return ['r', url, 'write'];
                return ['r', url]; // Should not happen
             });
             */

        event.tags = Array.from(relayTags.values());

        await event.sign(signer);
        const publishedRelays = await event.publish(); // Publish to write relays configured in NDK instance

        if (publishedRelays.size > 0) {
          toast.success(
            `Relay list published to ${publishedRelays.size} relays.`
          );
          // Update context state immediately
          setReadRelays(readList);
          setWriteRelays(writeList);
          setNip65Event(event); // Store the newly published event
          setRelaySource("nip65");
          return true;
        } else {
          toast.error(
            "Failed to publish relay list to any connected write relays."
          );
          return false;
        }
      } catch (error) {
        console.error("Error publishing NIP-65:", error);
        toast.error(
          `Failed to publish relay list: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return false;
      } finally {
        setIsPublishingNip65(false);
      }
    },
    [ndk, signer, user]
  );

  // Toggle Theme Mode (memoized)
  const toggleThemeMode = useCallback(() => {
    setThemeMode((prevMode) => {
      const newMode = prevMode === "light" ? "dark" : "light";
      localStorage.setItem(LS_THEME_MODE_KEY, newMode);
      return newMode;
    });
  }, []);

  // Context Value (memoized)
  const contextValue = useMemo(
    () => ({
      ndk,
      user,
      signer,
      loggedInUserProfile,
      loginWithNip07,
      loginWithNsec,
      logout,
      readRelays,
      writeRelays,
      explicitRelayUrls,
      defaultRelays,
      relaySource,
      nip65Event,
      isPublishingNip65,
      publishNip65Relays,
      fetchNip65Relays,
      themeMode,
      toggleThemeMode,
    }),
    [
      ndk,
      user,
      signer,
      loggedInUserProfile,
      loginWithNip07,
      loginWithNsec,
      logout,
      readRelays,
      writeRelays,
      explicitRelayUrls,
      defaultRelays, // Include defaultRelays here as it's returned
      relaySource,
      nip65Event,
      isPublishingNip65,
      publishNip65Relays,
      fetchNip65Relays,
      themeMode,
      toggleThemeMode,
    ]
  ); // Added defaultRelays to dependency array

  return (
    <NdkContext.Provider value={contextValue}>{children}</NdkContext.Provider>
  );
};

// Hook to use the context
export const useNdk = () => {
  const context = useContext(NdkContext);
  if (context === undefined) {
    throw new Error("useNdk must be used within an NdkProvider");
  }
  return context;
};
