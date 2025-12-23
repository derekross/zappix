import { type NostrEvent, type NostrMetadata } from '@nostrify/nostrify';
import { useAuthor } from './useAuthor';
import { useAuthors } from './useAuthors';
import { genUserName } from '@/lib/genUserName';
import { useMemo } from 'react';

/**
 * Enhanced author hook that provides fallback values and never blocks rendering.
 * Uses localStorage caching via useAuthor for instant loading of cached profiles.
 */
export function useAuthorFast(pubkey: string | undefined) {
  const authorQuery = useAuthor(pubkey);

  // Always provide fallback values
  const displayName = authorQuery.data?.metadata?.name ?? genUserName(pubkey || '');
  const profileImage = authorQuery.data?.metadata?.picture;
  const metadata = authorQuery.data?.metadata;
  const event = authorQuery.data?.event;

  return {
    // Original query state for advanced usage
    ...authorQuery,
    // Convenient fallback values that are always available
    displayName,
    profileImage,
    metadata,
    event,
    // Helper to check if we have actual profile data (not just fallback)
    hasProfileData: !!metadata,
    // Helper to check if loading failed but we have fallbacks
    isUsingFallback: !authorQuery.isLoading && !metadata && !!pubkey,
  };
}

/**
 * Hook for loading multiple authors with fallback handling.
 * Uses localStorage caching via useAuthors for instant loading of cached profiles.
 */
export function useAuthorsFast(pubkeys: string[]) {
  const authorsQuery = useAuthors(pubkeys);

  // Create a map with fallback values for all requested pubkeys
  const authorsWithFallbacks = useMemo(() => {
    return pubkeys.reduce((acc, pubkey) => {
      const authorData = authorsQuery.data?.[pubkey];
      acc[pubkey] = {
        displayName: authorData?.metadata?.name ?? genUserName(pubkey),
        profileImage: authorData?.metadata?.picture,
        metadata: authorData?.metadata,
        event: authorData?.event,
        hasProfileData: !!authorData?.metadata,
        isUsingFallback: !authorsQuery.isLoading && !authorData?.metadata,
      };
      return acc;
    }, {} as Record<string, {
      displayName: string;
      profileImage?: string;
      metadata?: NostrMetadata;
      event?: NostrEvent;
      hasProfileData: boolean;
      isUsingFallback: boolean;
    }>);
  }, [pubkeys, authorsQuery.data, authorsQuery.isLoading]);

  return {
    // Original query state
    ...authorsQuery,
    // Enhanced data with fallbacks
    data: authorsWithFallbacks,
    // Helper to check how many profiles loaded successfully
    loadedCount: Object.values(authorsWithFallbacks).filter(a => a.hasProfileData).length,
    totalCount: pubkeys.length,
  };
}