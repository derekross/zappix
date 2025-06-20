import { useEffect, useState, useCallback } from 'react';

interface PWAUpdateState {
  updateAvailable: boolean;
  isUpdating: boolean;
  updateError: string | null;
  currentVersion: string | null;
  newVersion: string | null;
}

interface PWAUpdateActions {
  checkForUpdate: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

export function usePWAUpdate(): PWAUpdateState & PWAUpdateActions {
  const [state, setState] = useState<PWAUpdateState>({
    updateAvailable: false,
    isUpdating: false,
    updateError: null,
    currentVersion: null,
    newVersion: null,
  });

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Get the current registration
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          setRegistration(reg);
          
          // Check if there's already a waiting worker
          if (reg.waiting) {
            setWaitingWorker(reg.waiting);
            setState(prev => ({
              ...prev,
              updateAvailable: true,
              newVersion: 'New version available'
            }));
          }

          // Listen for new service worker installations
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker is installed and ready
                  setWaitingWorker(newWorker);
                  setState(prev => ({
                    ...prev,
                    updateAvailable: true,
                    newVersion: 'New version available'
                  }));
                }
              });
            }
          });
        }
      });

      // Listen for messages from the service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          console.log('Service Worker updated:', event.data.payload);
          setState(prev => ({
            ...prev,
            currentVersion: event.data.payload.version,
            isUpdating: false
          }));
          
          // Reload the page to get the latest version
          window.location.reload();
        }
      });

      // Listen for controller changes (when a new SW takes control)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service Worker controller changed');
        // The page will be reloaded by the SW_UPDATED message handler
      });
    }
  }, []);

  const checkForUpdate = useCallback(async (): Promise<void> => {
    if (!registration) return;

    try {
      await registration.update();
    } catch (error) {
      console.error('Failed to check for updates:', error);
      setState(prev => ({
        ...prev,
        updateError: 'Failed to check for updates'
      }));
    }
  }, [registration]);

  const applyUpdate = async (): Promise<void> => {
    if (!waitingWorker) return;

    setState(prev => ({ ...prev, isUpdating: true, updateError: null }));

    try {
      // Tell the waiting service worker to skip waiting and become active
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // The service worker will send a message when it's ready,
      // and we'll reload the page in the message handler
    } catch (error) {
      console.error('Failed to apply update:', error);
      setState(prev => ({
        ...prev,
        isUpdating: false,
        updateError: 'Failed to apply update'
      }));
    }
  };

  const dismissUpdate = (): void => {
    setState(prev => ({
      ...prev,
      updateAvailable: false,
      updateError: null,
      newVersion: null
    }));
  };

  // Auto-check for updates every 30 seconds when the page is visible
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
        interval = setInterval(checkForUpdate, 30000); // Check every 30 seconds
      } else {
        clearInterval(interval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial check
    if (document.visibilityState === 'visible') {
      checkForUpdate();
      interval = setInterval(checkForUpdate, 30000);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [registration, checkForUpdate]);

  return {
    ...state,
    checkForUpdate,
    applyUpdate,
    dismissUpdate,
  };
}