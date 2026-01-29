import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useRef, useMemo } from 'react';
import type { NostrMetadata } from '@nostrify/nostrify';
import { genUserName } from '@/lib/genUserName';

interface OptimizedProfileCacheOptions {
  staleTime?: number;
  gcTime?: number;
  prefetchThreshold?: number;
}

interface CachedProfile {
  pubkey: string;
  metadata?: NostrMetadata;
  displayName: string;
  profileImage?: string;
  bannerImage?: string;
  about?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
  cachedAt: number;
  lastUpdated: number;
}

// LRU Cache for frequently accessed profiles
class ProfileLRUCache {
  private cache = new Map<string, CachedProfile>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(pubkey: string): CachedProfile | undefined {
    const profile = this.cache.get(pubkey);
    if (profile) {
      // Move to end (most recently used)
      this.cache.delete(pubkey);
      this.cache.set(pubkey, profile);
    }
    return profile;
  }

  set(pubkey: string, profile: CachedProfile): void {
    if (this.cache.has(pubkey)) {
      this.cache.delete(pubkey);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(pubkey, profile);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Global LRU cache instance
const globalProfileCache = new ProfileLRUCache(200);

export function useOptimizedProfileCache(options: OptimizedProfileCacheOptions = {}) {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    gcTime = 30 * 60 * 1000, // 30 minutes
    prefetchThreshold = 3, // Prefetch when profile is accessed 3 times
  } = options;

  const queryClient = useQueryClient();
  const accessCountRef = useRef<Map<string, number>>(new Map());
  const prefetchQueueRef = useRef<Set<string>>(new Set());

  // Optimized single profile fetch
  const useProfile = (pubkey: string) => {
    const query = useQuery({
      queryKey: ['optimized-profile', pubkey],
      queryFn: async ({ signal }) => {
        // Check LRU cache first
        const cached = globalProfileCache.get(pubkey);
        if (cached && Date.now() - cached.cachedAt < staleTime) {
          return cached;
        }

        // Fetch from network
        const response = await fetch(`/api/profiles/${pubkey}`, {
          signal,
          headers: {
            'Cache-Control': 'max-age=300',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const metadata = await response.json();
        const profile: CachedProfile = {
          pubkey,
          metadata,
          displayName: metadata?.name || genUserName(pubkey),
          profileImage: metadata?.picture,
          bannerImage: metadata?.banner,
          about: metadata?.about,
          website: metadata?.website,
          nip05: metadata?.nip05,
          lud16: metadata?.lud16,
          cachedAt: Date.now(),
          lastUpdated: metadata?.created_at || Date.now(),
        };

        // Update LRU cache
        globalProfileCache.set(pubkey, profile);

        // Track access count for prefetching
        const currentCount = accessCountRef.current.get(pubkey) || 0;
        accessCountRef.current.set(pubkey, currentCount + 1);

        return profile;
      },
      staleTime,
      gcTime,
      enabled: !!pubkey,
      retry: (failureCount, error) => {
        if (error.name === 'AbortError') return false;
        return failureCount < 2;
      },
    });

    return query;
  };

  // Optimized batch profile fetch
  const useBatchProfiles = (pubkeys: string[]) => {
    const uniquePubkeys = useMemo(() => [...new Set(pubkeys)], [pubkeys]);

    const query = useInfiniteQuery({
      queryKey: ['optimized-profiles-batch', uniquePubkeys.slice(0, 10)], // Limit batch size
      queryFn: async ({ pageParam, signal }) => {
        const batchSize = 20;
        const startIndex = (pageParam as number) * batchSize;
        const batch = uniquePubkeys.slice(startIndex, startIndex + batchSize);

        if (batch.length === 0) {
          return { profiles: [], hasMore: false };
        }

        // Check LRU cache first
        const uncachedPubkeys = batch.filter(pubkey => {
          const cached = globalProfileCache.get(pubkey);
          return !cached || Date.now() - cached.cachedAt > staleTime;
        });

        let profiles: CachedProfile[] = [];

        // Fetch uncached profiles
        if (uncachedPubkeys.length > 0) {
          const response = await fetch('/api/profiles/batch', {
            method: 'POST',
            signal,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pubkeys: uncachedPubkeys }),
          });

          if (response.ok) {
            const results = await response.json();
            profiles = results.map((metadata: NostrMetadata, index: number) => {
              const pubkey = uncachedPubkeys[index];
              const profile: CachedProfile = {
                pubkey,
                metadata,
                displayName: metadata?.name || genUserName(pubkey),
                profileImage: metadata?.picture,
                bannerImage: metadata?.banner,
                about: metadata?.about,
                website: metadata?.website,
                nip05: metadata?.nip05,
                lud16: metadata?.lud16,
                cachedAt: Date.now(),
                lastUpdated: Date.now(),
              };

              // Update LRU cache
              globalProfileCache.set(pubkey, profile);

              return profile;
            });
          }
        }

        // Combine cached and fetched profiles
        const allProfiles = batch.map(pubkey => {
          const cached = globalProfileCache.get(pubkey);
          if (cached && Date.now() - cached.cachedAt < staleTime) {
            return cached;
          }
          return profiles.find(p => p.pubkey === pubkey);
        }).filter(Boolean) as CachedProfile[];

        return {
          profiles: allProfiles,
          hasMore: startIndex + batchSize < uniquePubkeys.length,
        };
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage: { profiles: CachedProfile[]; hasMore: boolean }) => 
        lastPage.hasMore ? (lastPage.profiles.length / 20) + 1 : undefined,
      staleTime,
      gcTime,
      enabled: uniquePubkeys.length > 0,
    });

    // Flatten and deduplicate results
    const profiles = useMemo(() => {
      if (!query.data?.pages) return [];
      
      const allProfiles = query.data.pages.flatMap((page: { profiles: CachedProfile[]; hasMore: boolean }) => page.profiles);
      const uniqueProfiles = allProfiles.filter(
        (profile, index, self) => 
          index === self.findIndex(p => p.pubkey === profile.pubkey)
      );
      
      return uniqueProfiles;
    }, [query.data?.pages]);

    return { ...query, profiles };
  };

  // Prefetch profiles based on access patterns
  const prefetchProfile = useCallback((pubkey: string) => {
    const accessCount = accessCountRef.current.get(pubkey) || 0;
    
    if (accessCount >= prefetchThreshold && !prefetchQueueRef.current.has(pubkey)) {
      prefetchQueueRef.current.add(pubkey);
      
      // Debounce prefetching
      setTimeout(() => {
        queryClient.prefetchQuery({
          queryKey: ['optimized-profile', pubkey],
          queryFn: async ({ signal }) => {
            const response = await fetch(`/api/profiles/${pubkey}`, { signal });
            if (!response.ok) throw new Error('Prefetch failed');
            
            const metadata = await response.json();
            const profile: CachedProfile = {
              pubkey,
              metadata,
              displayName: metadata?.name || genUserName(pubkey),
              profileImage: metadata?.picture,
              bannerImage: metadata?.banner,
              about: metadata?.about,
              website: metadata?.website,
              nip05: metadata?.nip05,
              lud16: metadata?.lud16,
              cachedAt: Date.now(),
              lastUpdated: metadata?.created_at || Date.now(),
            };

            globalProfileCache.set(pubkey, profile);
            return profile;
          },
          staleTime: staleTime * 2, // Longer stale time for prefetched data
          gcTime: gcTime * 2,
        });
        
        prefetchQueueRef.current.delete(pubkey);
      }, 1000);
    }
  }, [queryClient, prefetchThreshold, staleTime, gcTime]);

  // Batch prefetch for lists of profiles
  const prefetchProfiles = useCallback((pubkeys: string[]) => {
    const uniquePubkeys = [...new Set(pubkeys)];
    
    // Prioritize frequently accessed profiles
    const prioritized = uniquePubkeys.sort((a, b) => {
      const countA = accessCountRef.current.get(a) || 0;
      const countB = accessCountRef.current.get(b) || 0;
      return countB - countA;
    }).slice(0, 10); // Limit to top 10

    prioritized.forEach(pubkey => {
      if (!prefetchQueueRef.current.has(pubkey)) {
        prefetchProfile(pubkey);
      }
    });
  }, [prefetchProfile]);

  // Clear cache when needed
  const clearCache = useCallback(() => {
    globalProfileCache.clear();
    accessCountRef.current.clear();
    prefetchQueueRef.current.clear();
    queryClient.removeQueries({ queryKey: ['optimized-profile'] });
    queryClient.removeQueries({ queryKey: ['optimized-profiles-batch'] });
  }, [queryClient]);

  return {
    useProfile,
    useBatchProfiles,
    prefetchProfile,
    prefetchProfiles,
    clearCache,
    cacheStats: {
      lruSize: globalProfileCache.size,
      accessCounts: Object.fromEntries(accessCountRef.current),
    },
  };
}