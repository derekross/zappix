# PWA Auto-Update System

This project implements an automatic Progressive Web App (PWA) update system that ensures users always have the latest version of the application.

## How It Works

### 1. Service Worker Updates

The service worker (`public/sw.js`) is automatically updated with a new cache version on every build:

- **Build-time Version Update**: The `scripts/update-sw-version.js` script runs during build and updates the `CACHE_VERSION` with a timestamp-based version string
- **Immediate Activation**: New service workers skip waiting and immediately take control of all clients
- **Cache Cleanup**: Old caches are automatically deleted when a new version activates

### 2. Automatic Update Detection

The `usePWAUpdate` hook provides automatic update detection and management:

- **Periodic Checks**: Checks for updates every 30 seconds when the page is visible
- **Visibility-based**: Pauses update checks when the page is hidden to save resources
- **Event-driven**: Listens for service worker lifecycle events to detect new versions

### 3. User Experience

#### Automatic Updates
- Updates are detected and applied automatically in the background
- Users see a brief notification when an update is available
- The page reloads automatically after the update is applied

#### Manual Control
- Users can manually check for updates in Settings > App
- Update status is displayed with current version information
- Manual update button available for immediate updates

### 4. Update Flow

```
1. New version deployed → 2. Service worker detects change → 3. Update notification shown
                                                                          ↓
6. Page reloads with new version ← 5. Service worker activates ← 4. User clicks "Update"
```

## Components

### Core Files

- **`public/sw.js`**: Service worker with auto-update logic
- **`src/hooks/usePWAUpdate.ts`**: React hook for update management
- **`src/components/PWAUpdateNotification.tsx`**: Update notification UI
- **`src/components/AppSettings.tsx`**: Settings page with manual update controls
- **`scripts/update-sw-version.js`**: Build script for version management

### Integration

The update system is integrated into the main app:

```tsx
// In App.tsx
<PWAUpdateNotification />

// In SettingsPage.tsx
<AppSettings />
```

## Configuration

### Update Frequency

Update checks occur:
- Every 30 seconds when the page is visible
- Immediately when the page becomes visible
- On service worker registration
- Manually via the settings page

### Cache Versioning

Cache versions follow the pattern: `v{package.version}-{timestamp}`

Example: `v0.0.0-1750380032793`

## Development

### Testing Updates

1. **Trigger Update**: Run `npm run dev:update-sw` to generate a new service worker version
2. **Verify Detection**: The app should detect the update within 30 seconds
3. **Apply Update**: Click the update notification or use the settings page

### Build Process

The build automatically updates the service worker version:

```bash
npm run build
# Runs: node scripts/update-sw-version.js && vite build
```

## Browser Support

The PWA update system works in all modern browsers that support:
- Service Workers
- Cache API
- Promises
- ES6+ features

## Benefits

- **Always Up-to-date**: Users automatically get the latest features and security fixes
- **Seamless Experience**: Updates happen in the background with minimal user interruption
- **Offline Resilience**: Cached content ensures the app works offline
- **Performance**: Faster loading with cached resources
- **User Control**: Manual update options for users who prefer control

## Troubleshooting

### Updates Not Detected

1. Check browser developer tools > Application > Service Workers
2. Verify the service worker is registered and active
3. Check console for error messages
4. Try a hard refresh (Ctrl+Shift+R)

### Update Fails

1. Check network connectivity
2. Verify service worker registration
3. Clear browser cache and reload
4. Check browser console for errors

### Manual Recovery

If automatic updates fail, users can:
1. Hard refresh the page (Ctrl+Shift+R)
2. Clear browser cache
3. Reinstall the PWA