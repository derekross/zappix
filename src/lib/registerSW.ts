import { Capacitor } from '@capacitor/core';

export function registerServiceWorker() {
  // Skip service worker registration on native apps - caching is handled differently
  if (Capacitor.isNativePlatform()) {
    console.log('Skipping service worker registration on native platform');
    return;
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "ServiceWorker registration successful with scope: ",
            registration.scope
          );

          // Check for updates immediately
          registration.update();

          // Set up periodic update checks
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              console.log('New service worker found, installing...');
              
              newWorker.addEventListener('statechange', () => {
                console.log('Service worker state changed:', newWorker.state);
                
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New service worker installed and ready');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.log("ServiceWorker registration failed: ", error);
        });
    });
  }
}
