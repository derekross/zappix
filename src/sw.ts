/**
 * Service Worker for PWA functionality
 * 
 * This service worker handles:
 * - PWA caching and offline functionality (via Workbox)
 * - Update prompts when new versions are available
 */

/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

// Clean up old caches automatically
cleanupOutdatedCaches();

// Precache and route assets (injected by VitePWA)
precacheAndRoute(self.__WB_MANIFEST);

/**
 * Listen for SKIP_WAITING message from the main thread
 * This is sent when the user clicks "Update" in the PWAUpdatePrompt
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Take control of all clients as soon as the service worker is activated
clientsClaim();
