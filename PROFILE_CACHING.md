# Profile Caching System

This document describes the enhanced profile caching system implemented to improve loading performance for social posts, notifications, and comments.

## Overview

The profile caching system provides multiple layers of optimization:

1. **Extended Cache Duration**: Profiles are cached for 30 minutes (stale time) and kept in memory for 2 hours
2. **Instant Cache Access**: Fast hooks provide immediate access to cached profile data
3. **Smart Prefetching**: Automatic prefetching of profiles for feeds and notifications
4. **Batch Loading**: Efficient batch queries for multiple profiles
5. **Fallback Handling**: Always provides display names even when profiles fail to load

## Key Components

### 1. Enhanced Author Hooks

#### `useAuthorFast(pubkey)`
- Provides instant access to cached profile data
- Falls back to regular `useAuthor` for uncached profiles
- Always returns display name and profile image (with fallbacks)

```tsx
import { useAuthorFast } from '@/hooks/useAuthorFast';

function UserProfile({ pubkey }) {
  const { displayName, profileImage, isFromCache } = useAuthorFast(pubkey);
  
  return (
    <div>
      <img src={profileImage} alt={displayName} />
      <span>{displayName}</span>
      {isFromCache && <span>⚡ Cached</span>}
    </div>
  );
}
```

#### `useAuthorsFast(pubkeys)`
- Batch loading with instant cache access for multiple profiles
- Efficient for feeds with many different authors

```tsx
import { useAuthorsFast } from '@/hooks/useAuthorFast';

function UserList({ pubkeys }) {
  const { data: authors, cachedCount, totalCount } = useAuthorsFast(pubkeys);
  
  return (
    <div>
      <p>{cachedCount}/{totalCount} profiles cached</p>
      {pubkeys.map(pubkey => (
        <div key={pubkey}>
          {authors[pubkey].displayName}
        </div>
      ))}
    </div>
  );
}
```

### 2. Profile Cache Management

#### `useProfileCache()`
- Direct cache manipulation and inspection
- Useful for advanced use cases and debugging

```tsx
import { useProfileCache } from '@/hooks/useProfileCache';

function CacheManager() {
  const { getCacheStats, prefetchProfiles } = useProfileCache();
  const stats = getCacheStats();
  
  return (
    <div>
      <p>Cached profiles: {stats.totalCached}</p>
      <p>With data: {stats.withData}</p>
      <button onClick={() => prefetchProfiles(['pubkey1', 'pubkey2'])}>
        Prefetch Profiles
      </button>
    </div>
  );
}
```

### 3. Automatic Prefetching

#### `useProfilePrefetch()`
- Smart prefetching for feeds, notifications, and comments
- Batches requests and deduplicates

```tsx
import { useProfilePrefetch } from '@/hooks/useProfilePrefetch';

function NotificationPanel({ notifications }) {
  const { prefetchProfilesForNotifications } = useProfilePrefetch();
  
  useEffect(() => {
    prefetchProfilesForNotifications(notifications);
  }, [notifications, prefetchProfilesForNotifications]);
  
  // ... render notifications
}
```

#### `useAutomaticProfilePrefetch(data)`
- Automatically prefetches profiles when data changes
- Perfect for feeds and lists

```tsx
import { useAutomaticProfilePrefetch } from '@/hooks/useProfilePrefetch';

function PostFeed({ posts }) {
  // Automatically prefetch profiles for all post authors
  useAutomaticProfilePrefetch(posts);
  
  return (
    <div>
      {posts.map(post => <Post key={post.id} event={post} />)}
    </div>
  );
}
```

## Updated Components

The following components have been updated to use the new caching system:

### Posts
- `ImagePost` - Uses `useAuthorFast` for instant profile loading
- `VideoPost` - Uses `useAuthorFast` for instant profile loading

### Feeds
- `ImageFeed` - Uses automatic prefetching for all post authors
- `VideoFeed` - (Can be updated similarly)

### Notifications
- `NotificationItem` - Uses `useAuthorFast` for instant profile loading
- `NotificationList` - Automatically prefetches profiles for all notification authors

## Performance Benefits

### Before Caching
- Each profile loaded individually with network requests
- 10-minute stale time, 30-minute garbage collection
- No prefetching or batch loading
- Loading states for every profile

### After Caching
- **30-minute stale time, 2-hour garbage collection** - Profiles stay fresh longer
- **Instant cache access** - No loading states for cached profiles
- **Smart prefetching** - Profiles loaded before they're needed
- **Batch loading** - Multiple profiles loaded in single requests
- **Persistent fallbacks** - Always shows display names

### Expected Improvements
- **90% faster** profile loading for cached profiles
- **Reduced network requests** through batching and prefetching
- **Better UX** with instant display names and profile images
- **Reduced loading states** in feeds and notifications

## Cache Configuration

### Current Settings
```typescript
// Individual profiles
staleTime: 30 * 60 * 1000,     // 30 minutes
gcTime: 2 * 60 * 60 * 1000,    // 2 hours

// Batch profiles  
staleTime: 30 * 60 * 1000,     // 30 minutes
gcTime: 2 * 60 * 60 * 1000,    // 2 hours
```

### Prefetch Settings
- **Debounce**: 100ms for batching requests
- **Timeout**: 5 seconds for prefetch requests
- **Batch size**: No limit (handles large feeds efficiently)

## Background Profile Management

### Silent Background Processing
The app includes a silent background profile manager that:
- **Automatically cancels** stuck profile queries after 15 seconds
- **Automatically retries** failed profile queries after 5 minutes
- **Runs silently** without any user-facing notifications or popups
- **Logs activity** only in development mode for debugging

### Development Logging
Profile management includes console logging in development mode:
- Prefetch batch sizes and success rates
- Cache hit/miss statistics
- Background query management (cancellations and retries)
- Performance timing information

### No More Annoying Popups!
The previous profile loading debugger with popup notifications has been completely removed. Profile loading issues are now handled silently in the background, providing a much better user experience.

## Migration Guide

### For Existing Components

1. **Replace `useAuthor` with `useAuthorFast`**:
```tsx
// Before
const author = useAuthor(pubkey);
const displayName = author.data?.metadata?.name ?? genUserName(pubkey);
const profileImage = author.data?.metadata?.picture;

// After  
const { displayName, profileImage } = useAuthorFast(pubkey);
```

2. **Add automatic prefetching to feeds**:
```tsx
import { useAutomaticProfilePrefetch } from '@/hooks/useProfilePrefetch';

function MyFeed({ posts }) {
  useAutomaticProfilePrefetch(posts); // Add this line
  // ... rest of component
}
```

3. **Use batch loading for multiple profiles**:
```tsx
// Before - multiple individual queries
const authors = pubkeys.map(pubkey => useAuthor(pubkey));

// After - single batch query
const { data: authors } = useAuthorsFast(pubkeys);
```

## Best Practices

1. **Use `useAuthorFast` for individual profiles** in posts, comments, notifications
2. **Use `useAuthorsFast` for multiple profiles** in user lists, leaderboards
3. **Add automatic prefetching** to any component that displays multiple users
4. **Leverage cache inspection** for debugging performance issues
5. **Monitor cache hit rates** in development to optimize prefetching

The profile caching system significantly improves the user experience by reducing loading times and providing instant access to frequently accessed profile data.