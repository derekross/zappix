import { type NostrEvent, type NostrMetadata } from '@nostrify/nostrify';
import { useAuthor } from './useAuthor';
import { useProfileCache } from './useProfileCache';
import { genUserName } from '@/lib/genUserName';
import { useMemo } from 'react';

/**
 * Fast author hook that provides instant access to cached profile data
 * Falls back to regular useAuthor for uncached profiles
 */
export function useAuthorFast(pubkey: string | undefined) {
  const { getCachedProfile } = useProfileCache();
  const authorQuery = useAuthor(pubkey);
  
  // Get cached data immediately if available
  const cachedProfile = useMemo(() => {
    return pubkey ? getCachedProfile(pubkey) : undefined;
  }, [pubkey, getCachedProfile]);

  // Use cached data if available, otherwise fall back to query data
  const effectiveData = cachedProfile || authorQuery.data;
  
  // Always provide fallback values
  const displayName = effectiveData?.metadata?.name ?? genUserName(pubkey || '');
  const profileImage = effectiveData?.metadata?.picture;
  const metadata = effectiveData?.metadata;
  const event = effectiveData?.event;
  
  return {
    // Original query state for advanced usage
    ...authorQuery,
    // Enhanced data that might come from cache
    data: effectiveData,
    // Convenient fallback values that are always available
    displayName,
    profileImage,
    metadata,
    event,
    // Helper to check if we have actual profile data (not just fallback)
    hasProfileData: !!metadata,
    // Helper to check if data came from cache
    isFromCache: !!cachedProfile,
    // Helper to check if loading failed but we have fallbacks
    isUsingFallback: !authorQuery.isLoading && !metadata && !!pubkey,
  };
}

/**
 * Hook for loading multiple authors with instant cache access
 */
export function useAuthorsFast(pubkeys: string[]) {
  const { getCachedProfiles } = useProfileCache();
  
  // Get cached profiles immediately
  const cachedProfiles = useMemo(() => {
    return getCachedProfiles(pubkeys);
  }, [pubkeys, getCachedProfiles]);

  // Create a map with fallback values for all requested pubkeys
  const authorsWithFallbacks = useMemo(() => {
    return pubkeys.reduce((acc, pubkey) => {
      const cachedData = cachedProfiles[pubkey];
      acc[pubkey] = {
        displayName: cachedData?.metadata?.name ?? genUserName(pubkey),
        profileImage: cachedData?.metadata?.picture,
        metadata: cachedData?.metadata,
        event: cachedData?.event,
        hasProfileData: !!cachedData?.metadata,
        isFromCache: !!cachedData,
        isUsingFallback: !cachedData?.metadata,
      };
      return acc;
    }, {} as Record<string, {
      displayName: string;
      profileImage?: string;
      metadata?: NostrMetadata;
      event?: NostrEvent;
      hasProfileData: boolean;
      isFromCache: boolean;
      isUsingFallback: boolean;
    }>);
  }, [pubkeys, cachedProfiles]);
  
  return {
    // Enhanced data with instant cache access
    data: authorsWithFallbacks,
    // Helper to check how many profiles are cached
    cachedCount: Object.values(authorsWithFallbacks).filter(a => a.isFromCache).length,
    // Helper to check how many profiles loaded successfully
    loadedCount: Object.values(authorsWithFallbacks).filter(a => a.hasProfileData).length,
    totalCount: pubkeys.length,
    // All profiles are considered "loaded" since we provide fallbacks
    isLoading: false,
    isError: false,
  };
}