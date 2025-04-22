// src/contexts/NdkContext.tsx - Delay profile fetch until after NIP-65 check
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import NDK, { NDKNip07Signer, NDKPrivateKeySigner, NDKUser, NDKEvent, NDKKind, NDKFilter, NostrEvent, NDKSigner, NDKSubscriptionCacheUsage, NDKUserProfile } from '@nostr-dev-kit/ndk';
import toast from 'react-hot-toast';
import { PaletteMode } from '@mui/material';

const LS_THEME_MODE_KEY = 'zappixThemeMode';

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
    relaySource: 'nip65' | 'default' | 'loading' | 'logged_out';
    nip65Event: NDKEvent | null;
    isPublishingNip65: boolean;
    publishNip65Relays: (readList: string[], writeList: string[]) => Promise<boolean>;
    fetchNip65Relays: (userToFetch: NDKUser) => Promise<void>;
    themeMode: PaletteMode;
    toggleThemeMode: () => void;
}

const NdkContext = createContext<NdkContextProps | undefined>(undefined);

const defaultRelays = [
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://relay.snort.social',
    'wss://purplepag.es',
    'wss://nostr.wine',
    'wss://relay.nostr.band',
    'wss://nos.lol',
];

export const NdkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [ndk, setNdk] = useState<NDK | null>(null);
    const [signer, setSigner] = useState<NDKSigner | null>(null);
    const [user, setUser] = useState<NDKUser | null>(null);
    const [loggedInUserProfile, setLoggedInUserProfile] = useState<NDKUserProfile | null>(null);
    const [readRelays, setReadRelays] = useState<string[]>(defaultRelays);
    const [writeRelays, setWriteRelays] = useState<string[]>(defaultRelays);
    const [explicitRelayUrls, setExplicitRelayUrls] = useState<string[]>(defaultRelays);
    const [relaySource, setRelaySource] = useState<'nip65' | 'default' | 'loading' | 'logged_out'>('logged_out');
    const [nip65Event, setNip65Event] = useState<NDKEvent | null>(null);
    const [isPublishingNip65, setIsPublishingNip65] = useState(false);
    const [themeMode, setThemeMode] = useState<PaletteMode>(() => {
        const storedMode = localStorage.getItem(LS_THEME_MODE_KEY);
        return (storedMode === 'dark' || storedMode === 'light') ? storedMode : 'light';
    });

    // NDK Initialization Effect
    useEffect(() => {
        const instance = new NDK({
            explicitRelayUrls: explicitRelayUrls,
            signer: signer || undefined,
            debug: false,
        });
        instance.pool.on('relay:connect', (relay) => console.log(`✅ Connected to relay: ${relay.url}`));
        instance.pool.on('relay:disconnect', (relay) => console.log(`❌ Disconnected from relay: ${relay.url}`));
        instance.pool.on('relay:error', (relay, error) => console.error(`⚠️ Error with relay ${relay.url}:`, error));
        setNdk(instance);
        instance.connect().catch(err => console.error("NDK connect() error:", err));
        return () => {
            instance.pool?.removeAllListeners();
            instance.pool?.relays.forEach(relay => relay.disconnect());
        };
    }, [explicitRelayUrls, signer]);

    // Update explicitRelayUrls when read/write lists change
    useEffect(() => {
        const combined = Array.from(new Set([...readRelays, ...writeRelays]));
        setExplicitRelayUrls(combined);
    }, [readRelays, writeRelays]);

    // Logout Function (memoized)
    const logout = useCallback(() => {
        setSigner(null);
        setUser(null);
        setLoggedInUserProfile(null); // Clear profile on logout
        setNip65Event(null);
        setReadRelays(defaultRelays);
        setWriteRelays(defaultRelays);
        setRelaySource('logged_out');
        toast.success('Logged out');
    }, []);

    // Fetch NIP-65 Relays (memoized)
    const fetchNip65Relays = useCallback(async (userToFetch: NDKUser) => {
        if (!ndk) return;
        console.log("Fetching NIP-65 for", userToFetch.pubkey);
        setRelaySource('loading'); // Set state to loading
        setNip65Event(null);
        try {
            const filter: NDKFilter = { kinds: [10002], authors: [userToFetch.pubkey], limit: 1 };
            const latestNip65 = await ndk.fetchEvent(filter, { cacheUsage: NDKSubscriptionCacheUsage.NETWORK_FIRST });
            if (latestNip65) {
                console.log("Found NIP-65 event:", latestNip65.id);
                setNip65Event(latestNip65);
                const readSet = new Set<string>();
                const writeSet = new Set<string>();
                latestNip65.tags.forEach(tag => {
                    if (tag[0] === 'r' && tag[1]?.startsWith('wss://')) {
                        const marker = tag[2]?.toLowerCase();
                        if (marker === 'read') readSet.add(tag[1]);
                        else if (marker === 'write') writeSet.add(tag[1]);
                        else { readSet.add(tag[1]); writeSet.add(tag[1]); }
                    }
                });
                const parsedRead = Array.from(readSet);
                const parsedWrite = Array.from(writeSet);
                if (parsedRead.length > 0 || parsedWrite.length > 0) {
                    setReadRelays(parsedRead);
                    setWriteRelays(parsedWrite);
                    setRelaySource('nip65'); // Update state
                } else {
                    setReadRelays(defaultRelays);
                    setWriteRelays(defaultRelays);
                    setRelaySource('default'); // Update state
                }
            } else {
                console.log("No NIP-65 event found, using defaults.");
                setReadRelays(defaultRelays);
                setWriteRelays(defaultRelays);
                setRelaySource('default'); // Update state
            }
        } catch (error) {
            console.error("Error fetching NIP-65:", error);
            setReadRelays(defaultRelays);
            setWriteRelays(defaultRelays);
            setRelaySource('default'); // Update state on error
            setNip65Event(null);
        }
    }, [ndk]);

    // Login Functions (memoized)
    const loginWithNip07 = useCallback(async () => {
        if (!ndk) throw new Error("NDK not initialized");
        try {
            const nip07signer = new NDKNip07Signer();
            const localNdkUser = await nip07signer.user();
            if (!localNdkUser?.pubkey) throw new Error("No pubkey from NIP-07");
            localNdkUser.ndk = ndk;
            setSigner(nip07signer);
            setUser(localNdkUser); // Set user first
            toast.success('Logged in with extension!');
            // Now fetch relays (profile fetch moved to useEffect below)
            await fetchNip65Relays(localNdkUser);
        } catch (error) {
            console.error("NIP-07 login failed:", error);
            logout();
            toast.error(`NIP-07 Login failed: ${error}`);
            throw error;
        }
    }, [ndk, fetchNip65Relays, logout]);

    const loginWithNsec = useCallback(async (nsec: string) => {
        if (!ndk) throw new Error("NDK not initialized");
        try {
            const pkSigner = new NDKPrivateKeySigner(nsec);
            const localNdkUser = await pkSigner.user();
            if (!localNdkUser?.pubkey) throw new Error("No pubkey from NSEC");
            localNdkUser.ndk = ndk;
            setSigner(pkSigner);
            setUser(localNdkUser); // Set user first
            toast.success('Logged in with NSEC!');
            // Now fetch relays (profile fetch moved to useEffect below)
            await fetchNip65Relays(localNdkUser);
        } catch (error) {
            console.error("NSEC login failed:", error);
            logout();
            toast.error(`NSEC Login failed: ${error}`);
            throw error;
        }
    }, [ndk, fetchNip65Relays, logout]);


    // *** NEW Effect: Fetch profile *after* user is set and NIP-65 check is done ***
    useEffect(() => {
        // Only run if we have a user and the relay source check isn't actively loading
        if (user && relaySource !== 'loading') {
             console.log(`NdkContext: User logged in (${user.pubkey}) and relay source settled (${relaySource}). Fetching profile...`);
            user.fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.ONLY_NETWORK })
                .then(profile => {
                    console.log("NdkContext: Delayed fetchProfile succeeded. Profile:", profile);
                    if (profile) { // Check if profile is not null
                         console.log("NdkContext: Setting loggedInUserProfile state now...");
                         setLoggedInUserProfile(profile); // Update profile state
                         console.log("NdkContext: State setter called.");
                    } else {
                        console.log("NdkContext: Delayed fetchProfile returned null, not updating state.");
                        setLoggedInUserProfile(null); // Ensure state is null if fetch returns null
                    }
                })
                .catch(err => {
                    console.error("NdkContext: Delayed fetchProfile failed:", err);
                    setLoggedInUserProfile(null); // Set to null on error
                });
        } else if (!user) {
            // If user becomes null (logout), clear the profile state
            setLoggedInUserProfile(null);
        }
    }, [user, relaySource]); // Dependencies: user object, relaySource status


    // Publish NIP-65 Relays (memoized) - Unchanged
    const publishNip65Relays = useCallback(async (readList: string[], writeList: string[]): Promise<boolean> => {
        if (!ndk || !signer || !user) {
            toast.error("Cannot publish relays: NDK, signer, or user not available.");
            return false;
        }
        setIsPublishingNip65(true);
        try {
            const event = new NDKEvent(ndk);
            event.kind = 10002;
            event.created_at = Math.floor(Date.now() / 1000);
            event.pubkey = user.pubkey;
            readList.forEach(url => event.tags.push(['r', url, 'read']));
            writeList.forEach(url => event.tags.push(['r', url, 'write']));
            event.tags = Array.from(new Map(event.tags.map(tag => [`${tag[0]}:${tag[1]}`, tag])).values());
            await event.sign(signer);
            const publishedRelays = await event.publish();
            if (publishedRelays.size > 0) {
                toast.success(`Relay list published to ${publishedRelays.size} relays.`);
                setReadRelays(readList);
                setWriteRelays(writeList);
                setNip65Event(event);
                setRelaySource('nip65');
                return true;
            } else {
                toast.error("Failed to publish relay list to any connected write relays.");
                return false;
            }
        } catch (error) {
            console.error("Error publishing NIP-65:", error);
            toast.error(`Failed to publish relay list: ${error}`);
            return false;
        } finally {
            setIsPublishingNip65(false);
        }
    }, [ndk, signer, user]);

    // Toggle Theme Mode (memoized) - Unchanged
    const toggleThemeMode = useCallback(() => {
        setThemeMode(prevMode => {
            const newMode = prevMode === 'light' ? 'dark' : 'light';
            localStorage.setItem(LS_THEME_MODE_KEY, newMode);
            return newMode;
        });
    }, []);

    // Context Value (memoized) - Unchanged
    const contextValue = useMemo(() => ({
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
    }), [
        ndk, user, signer, loggedInUserProfile,
        loginWithNip07, loginWithNsec, logout, readRelays, writeRelays,
        explicitRelayUrls, relaySource, nip65Event, isPublishingNip65,
        publishNip65Relays, fetchNip65Relays, themeMode, toggleThemeMode
    ]);

    return <NdkContext.Provider value={contextValue}>{children}</NdkContext.Provider>;
};

// Hook to use the context - Unchanged
export const useNdk = () => {
    const context = useContext(NdkContext);
    if (context === undefined) {
        throw new Error('useNdk must be used within an NdkProvider');
    }
    return context;
};
