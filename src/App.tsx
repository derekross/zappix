// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from "@unhead/react/client";
import { InferSeoMetaPlugin } from "@unhead/addons";
import { Suspense } from "react";
import NostrProvider from "@/components/NostrProvider";
import { NostrSync } from "@/components/NostrSync";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NostrLoginProvider } from "@nostrify/react/login";
import { AppProvider } from "@/components/AppProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { NWCProvider } from "@/contexts/NWCContext";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { BackgroundProfileManager } from "@/components/BackgroundProfileManager";
import { useMemoryMonitor } from "@/hooks/useMemoryMonitor";
import { useCapacitorStatusBar } from "@/hooks/useCapacitorStatusBar";

import { AppConfig } from "@/contexts/AppContext";
import AppRouter from "./AppRouter";

const head = createHead({
  plugins: [InferSeoMetaPlugin()],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (was Infinity - major memory leak!)
      // Don't retry profile queries aggressively to prevent blocking
      retry: (failureCount, error) => {
        // Don't retry timeout errors for profile queries
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
          return false;
        }
        // Allow up to 2 retries for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      // Don't throw errors to prevent blocking the UI
      throwOnError: false,
    },
    mutations: {
      // Allow more retries for mutations (user actions)
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});

const defaultConfig: AppConfig = {
  theme: "light",
  relayMetadata: {
    relays: [
      { url: "wss://relay.primal.net", read: true, write: true },
      { url: "wss://nos.lol", read: true, write: true },
      { url: "wss://relay.damus.io", read: true, write: true },
      { url: "wss://relay.divine.video", read: true, write: true },
    ],
    updatedAt: 0,
  },
};

const defaultRelays = [
  { url: "wss://relay.primal.net", name: "Primal" },
  { url: "wss://relay.olas.app", name: "Olas" },
  { url: "wss://nos.lol", name: "nos.lol" },
  { url: "wss://relay.snort.social", name: "Snort" },
  { url: "wss://purplepag.es", name: "Purple Pages" },
  { url: "wss://relay.damus.io", name: "Damus" },
  { url: "wss://ditto.pub/relay", name: "Ditto" },
];

function MemoryMonitorWrapper({ children }: { children: React.ReactNode }) {
  useMemoryMonitor();
  useCapacitorStatusBar();
  return <>{children}</>;
}

export function App() {
  return (
    <UnheadProvider head={head}>
      <AppProvider
        storageKey="nostr:app-config"
        defaultConfig={defaultConfig}
        defaultRelays={defaultRelays}
      >
        <QueryClientProvider client={queryClient}>
          <MemoryMonitorWrapper>
            <NostrLoginProvider storageKey="nostr:login">
              <NostrProvider>
                <NostrSync />
                <NotificationProvider>
                  <NWCProvider>
                    <TooltipProvider>
                      <Toaster />
                      <Sonner />
                      <PWAUpdatePrompt />
                      <BackgroundProfileManager />
                      <Suspense>
                        <AppRouter />
                      </Suspense>
                    </TooltipProvider>
                  </NWCProvider>
                </NotificationProvider>
              </NostrProvider>
            </NostrLoginProvider>
          </MemoryMonitorWrapper>
        </QueryClientProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default App;