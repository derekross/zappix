import { useQueryClient } from '@tanstack/react-query';
import { type NostrEvent, type NostrMetadata } from '@nostrify/nostrify';
import { useCallback } from 'react';

export interface CachedProfile {
  event?: NostrEvent;
  metadata?: NostrMetadata;
  displayName: string;
  profileImage?: string;
  cachedAt: number;
}

/**
 * Hook for managing profile cache operations
 */
export function useProfileCache() {
  const queryClient = useQueryClient();

  /**
   * Get a profile from cache if available
   */
  const getCachedProfile = useCallback((pubkey: string): CachedProfile | undefined => {
    const queryData = queryClient.getQueryData<{ event?: NostrEvent; metadata?: NostrMetadata }>(['author', pubkey]);
    
    if (queryData) {
      return {
        ...queryData,
        displayName: queryData.metadata?.name || generateFallbackName(pubkey),
        profileImage: queryData.metadata?.picture,
        cachedAt: Date.now(),
      };
    }
    
    return undefined;
  }, [queryClient]);

  /**
   * Set profile data in cache
   */
  const setCachedProfile = useCallback((pubkey: string, data: { event?: NostrEvent; metadata?: NostrMetadata }) => {
    queryClient.setQueryData(['author', pubkey], data);
  }, [queryClient]);

  /**
   * Batch set multiple profiles in cache
   */
  const setCachedProfiles = useCallback((profiles: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }>) => {
    Object.entries(profiles).forEach(([pubkey, data]) => {
      queryClient.setQueryData(['author', pubkey], data);
    });
  }, [queryClient]);

  /**
   * Prefetch profiles for a list of pubkeys
   */
  const prefetchProfiles = useCallback(async (pubkeys: string[]) => {
    // Only prefetch profiles that aren't already cached or are stale
    const uncachedPubkeys = pubkeys.filter(pubkey => {
      const queryState = queryClient.getQueryState(['author', pubkey]);
      return !queryState || !queryState.data;
    });

    if (uncachedPubkeys.length === 0) return;

    // Use the batch authors query to prefetch multiple profiles efficiently
    await queryClient.prefetchQuery({
      queryKey: ['authors', ...uncachedPubkeys.sort()],
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  }, [queryClient]);

  /**
   * Get multiple cached profiles
   */
  const getCachedProfiles = useCallback((pubkeys: string[]): Record<string, CachedProfile | undefined> => {
    return pubkeys.reduce((acc, pubkey) => {
      acc[pubkey] = getCachedProfile(pubkey);
      return acc;
    }, {} as Record<string, CachedProfile | undefined>);
  }, [getCachedProfile]);

  /**
   * Check if a profile is cached and fresh
   */
  const isProfileCached = useCallback((pubkey: string): boolean => {
    const queryState = queryClient.getQueryState(['author', pubkey]);
    return !!queryState && !!queryState.data;
  }, [queryClient]);

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    const queries = queryClient.getQueryCache().getAll();
    const authorQueries = queries.filter(query => 
      Array.isArray(query.queryKey) && query.queryKey[0] === 'author'
    );
    
    return {
      totalCached: authorQueries.length,
      withData: authorQueries.filter(query => !!query.state.data).length,
      withoutData: authorQueries.filter(query => !query.state.data).length,
    };
  }, [queryClient]);

  return {
    getCachedProfile,
    setCachedProfile,
    setCachedProfiles,
    prefetchProfiles,
    getCachedProfiles,
    isProfileCached,
    getCacheStats,
  };
}

/**
 * Generate a fallback display name for a pubkey
 */
function generateFallbackName(pubkey: string): string {
  // Simple fallback name generation
  // This will be replaced by the actual genUserName in components
  return `User ${pubkey.slice(0, 8)}`;
}