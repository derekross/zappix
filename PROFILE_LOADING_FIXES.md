# Profile Loading and Notification Fixes

## Issues Identified

The application was experiencing two interconnected problems:

1. **Profile Loading Failures**: Queries to load profile names and avatars sometimes didn't complete, causing skeleton names to be used indefinitely
2. **Notification Loading Blocking**: When profile loading failed, notifications would also fail to finish loading

## Root Causes

### 1. Aggressive Timeouts
- **Problem**: Short timeouts (2-3 seconds) were insufficient for slower relays
- **Impact**: Profile queries would timeout before completing, leaving skeleton names
- **Fix**: Increased timeouts to 8-10 seconds for better reliability across different relay speeds

### 2. Query Dependency Chains
- **Problem**: Notification loading was indirectly dependent on profile loading success
- **Impact**: When profiles failed to load, it could cascade and affect notification queries
- **Fix**: Made queries more independent and added better error isolation

### 3. Insufficient Error Handling
- **Problem**: Failed queries would retry aggressively, potentially blocking other queries
- **Impact**: Resource contention and cascading failures
- **Fix**: Implemented smarter retry logic with exponential backoff and timeout-specific handling

### 4. Query Client Configuration
- **Problem**: Default retry behavior was too aggressive for profile queries
- **Impact**: Failed profile queries would keep retrying, consuming resources
- **Fix**: Customized retry logic to be less aggressive for timeout/abort errors

## Implemented Fixes

### 1. Enhanced Query Timeouts
```typescript
// Before: 2-3 second timeouts
const timeoutSignal = AbortSignal.timeout(2000);

// After: Longer, more realistic timeouts
const timeoutSignal = AbortSignal.timeout(8000); // Single profiles
const timeoutSignal = AbortSignal.timeout(10000); // Batch queries
const timeoutSignal = AbortSignal.timeout(15000); // Notifications
```

### 2. Improved Retry Logic
```typescript
// Smart retry logic that doesn't retry timeout errors
retry: (failureCount, error) => {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return false; // Don't retry timeouts
  }
  return failureCount < 2; // Allow up to 2 retries for other errors
},
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
```

### 3. Error Isolation
- Added `throwOnError: false` to prevent query failures from blocking the UI
- Enhanced error logging for better debugging
- Graceful fallback to skeleton names when profiles fail to load

### 4. Profile Loading Monitoring
Created new hooks and components to detect and resolve profile loading issues:

#### `useProfileLoadingStatus`
- Monitors query status and detects stuck queries
- Identifies when profile queries have been loading for too long (>10 seconds)
- Provides methods to cancel stuck queries and retry failed ones

#### `ProfileLoadingDebugger`
- Automatically cancels stuck queries after 15 seconds
- Shows alerts when profile loading issues are detected
- Provides manual controls to retry or cancel problematic queries

#### `useAuthorWithFallback`
- Enhanced version of `useAuthor` that always provides fallback values
- Doesn't block rendering when profile loading fails
- Includes helpers to detect when fallback values are being used

### 5. Query Client Improvements
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry timeout errors aggressively
      retry: (failureCount, error) => {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      throwOnError: false, // Don't block UI on query failures
    },
  },
});
```

## Benefits

### 1. Improved Reliability
- Profile queries now have sufficient time to complete on slower relays
- Better handling of network variability and relay performance differences

### 2. Better Error Recovery
- Stuck queries are automatically detected and cancelled
- Failed queries can be retried without affecting other operations
- Graceful degradation when profile data isn't available

### 3. Enhanced User Experience
- Skeleton names are replaced with actual names more reliably
- Notifications load independently of profile loading status
- No more indefinite loading states

### 4. Better Debugging
- Clear visibility into profile loading issues
- Automatic resolution of common problems
- Manual controls for advanced troubleshooting

## Monitoring and Debugging

The `ProfileLoadingDebugger` component is now included in the app and will:

1. **Automatically detect** when profile queries are stuck (loading >10 seconds)
2. **Auto-cancel** stuck queries after 15 seconds to prevent blocking
3. **Show alerts** when profile loading issues are detected
4. **Provide controls** to manually retry or cancel problematic queries

In development, you can enable debug information to see detailed status:
```tsx
<ProfileLoadingDebugger showDebugInfo={true} />
```

## Testing the Fixes

To verify the fixes are working:

1. **Monitor the console** for profile loading warnings
2. **Check for alerts** if profile loading issues are detected
3. **Verify** that skeleton names are replaced with actual names
4. **Confirm** that notifications load even when some profiles fail
5. **Test** on slower network connections to ensure reliability

## Future Improvements

1. **Relay Health Monitoring**: Track which relays are performing poorly for profile queries
2. **Intelligent Relay Selection**: Prefer faster relays for profile queries
3. **Profile Caching**: Implement more aggressive caching for frequently accessed profiles
4. **Background Refresh**: Periodically refresh profile data in the background