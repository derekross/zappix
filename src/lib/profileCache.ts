import type { NostrMetadata } from '@nostrify/nostrify';

interface CachedProfile {
  metadata: NostrMetadata;
  updatedAt: number;
}

interface ProfileCacheData {
  profiles: Record<string, CachedProfile>;
  version: number;
}

const CACHE_KEY = 'nostr:profile-cache';
const CACHE_VERSION = 1;
const MAX_CACHE_SIZE = 500; // Maximum number of profiles to cache
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

class ProfileCache {
  private cache: Map<string, CachedProfile> = new Map();
  private initialized = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (!stored) {
        this.initialized = true;
        return;
      }

      const data: ProfileCacheData = JSON.parse(stored);

      // Check version compatibility
      if (data.version !== CACHE_VERSION) {
        localStorage.removeItem(CACHE_KEY);
        this.initialized = true;
        return;
      }

      // Load profiles into memory cache
      const now = Date.now();
      for (const [pubkey, profile] of Object.entries(data.profiles)) {
        // Skip expired profiles
        if (now - profile.updatedAt < CACHE_TTL) {
          this.cache.set(pubkey, profile);
        }
      }

      this.initialized = true;
    } catch {
      // If parsing fails, start with empty cache
      localStorage.removeItem(CACHE_KEY);
      this.initialized = true;
    }
  }

  private saveToStorage(): void {
    try {
      const profiles: Record<string, CachedProfile> = {};

      // Convert Map to object, limiting size
      const entries = Array.from(this.cache.entries());

      // Sort by updatedAt descending (most recent first)
      entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);

      // Take only the most recent MAX_CACHE_SIZE profiles
      const toSave = entries.slice(0, MAX_CACHE_SIZE);

      for (const [pubkey, profile] of toSave) {
        profiles[pubkey] = profile;
      }

      const data: ProfileCacheData = {
        profiles,
        version: CACHE_VERSION,
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // Storage might be full, try to clear old data
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {
        // Ignore
      }
    }
  }

  get(pubkey: string): NostrMetadata | null {
    const cached = this.cache.get(pubkey);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.updatedAt > CACHE_TTL) {
      this.cache.delete(pubkey);
      return null;
    }

    return cached.metadata;
  }

  set(pubkey: string, metadata: NostrMetadata): void {
    this.cache.set(pubkey, {
      metadata,
      updatedAt: Date.now(),
    });

    // Debounce storage writes
    this.scheduleSave();
  }

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    // Save after 2 seconds of inactivity
    this.saveTimeout = setTimeout(() => {
      this.saveToStorage();
      this.saveTimeout = null;
    }, 2000);
  }

  // Get multiple profiles at once
  getMultiple(pubkeys: string[]): Map<string, NostrMetadata> {
    const result = new Map<string, NostrMetadata>();
    const now = Date.now();

    for (const pubkey of pubkeys) {
      const cached = this.cache.get(pubkey);
      if (cached && now - cached.updatedAt < CACHE_TTL) {
        result.set(pubkey, cached.metadata);
      }
    }

    return result;
  }

  // Set multiple profiles at once
  setMultiple(profiles: Map<string, NostrMetadata>): void {
    const now = Date.now();
    for (const [pubkey, metadata] of profiles) {
      this.cache.set(pubkey, { metadata, updatedAt: now });
    }
    this.scheduleSave();
  }

  // Get pubkeys that are not in cache or are expired
  getMissingPubkeys(pubkeys: string[]): string[] {
    const now = Date.now();
    return pubkeys.filter(pubkey => {
      const cached = this.cache.get(pubkey);
      return !cached || now - cached.updatedAt > CACHE_TTL;
    });
  }

  // Check if a profile needs refresh (older than 1 hour)
  needsRefresh(pubkey: string): boolean {
    const cached = this.cache.get(pubkey);
    if (!cached) return true;

    const ONE_HOUR = 60 * 60 * 1000;
    return Date.now() - cached.updatedAt > ONE_HOUR;
  }

  // Clear all cached profiles
  clear(): void {
    this.cache.clear();
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // Ignore
    }
  }

  // Get cache stats for debugging
  getStats(): { size: number; initialized: boolean } {
    return {
      size: this.cache.size,
      initialized: this.initialized,
    };
  }
}

// Singleton instance
export const profileCache = new ProfileCache();
