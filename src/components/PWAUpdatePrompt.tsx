/**
 * PWA Update Prompt Component
 * 
 * This component listens for service worker updates and prompts the user
 * to reload the app when a new version is available.
 * 
 * NOTE: This component only works when PWA is enabled in vite.config.ts.
 * When PWA is disabled, importing this component will cause build errors
 * due to missing virtual modules.
 * 
 * NOTE: This component is disabled on native Capacitor apps since they
 * receive updates through the app store, not via service worker cache.
 * 
 * To use: Import and render this component in App.tsx when PWA is enabled.
 */

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '@/hooks/useToast';
import { ToastAction } from '@/components/ui/toast';

export function PWAUpdatePrompt() {
  const { toast } = useToast();
  const [showReload, setShowReload] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Skip service worker registration on native apps - they update via app store
  const isNativeApp = Capacitor.isNativePlatform();

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: !isNativeApp, // Don't register immediately on native
    onRegistered(r) {
      // Skip on native apps
      if (isNativeApp) return;
      
      if (r) {
        // Check for updates periodically (every hour)
        // Note: We don't call r.update() immediately on page load because
        // the browser already checks for SW updates when the page loads.
        // Calling it immediately would trigger false "update available" prompts.
        intervalRef.current = setInterval(() => {
          r.update();
        }, 60 * 60 * 1000); // 1 hour
      }
    },
    onRegisterError(error) {
      // Don't log errors on native apps
      if (!isNativeApp) {
        console.error('SW registration error', error);
      }
    },
  });

  useEffect(() => {
    // Don't show update prompts on native apps
    if (isNativeApp) return;
    
    if (needRefresh && !showReload) {
      setShowReload(true);
      
      const { dismiss } = toast({
        title: "Update Available",
        description: "A new version of Zappix is available. Click to update.",
        duration: Infinity, // Don't auto-dismiss
        action: (
          <ToastAction
            altText="Update now"
            onClick={async () => {
              await updateServiceWorker(true);
              setNeedRefresh(false);
              setShowReload(false);
              dismiss();
            }}
          >
            Update
          </ToastAction>
        ),
      });
    }
  }, [needRefresh, showReload, toast, updateServiceWorker, setNeedRefresh, isNativeApp]);

  // This component doesn't render anything
  return null;
}
