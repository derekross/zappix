import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export function useCapacitorStatusBar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupStatusBar = async () => {
      try {
        // Set status bar style to light content (white icons) for dark background
        await StatusBar.setStyle({ style: Style.Dark });

        // Make status bar overlay the WebView for edge-to-edge content
        // This allows our CSS safe-area-inset-top to work correctly
        await StatusBar.setOverlaysWebView({ overlay: true });
      } catch (error) {
        console.error('Failed to configure status bar:', error);
      }
    };

    setupStatusBar();
  }, []);
}
