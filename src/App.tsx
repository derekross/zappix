// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from "@unhead/react/client";
import { InferSeoMetaPlugin } from "@unhead/addons";
import { Suspense } from "react";
import NostrProvider from "@/components/NostrProvider";
import { OutboxEnhancer } from "@/components/OutboxEnhancer";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NostrLoginProvider } from "@nostrify/react/login";
import { AppProvider } from "@/components/AppProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
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
      gcTime: Infinity,
    },
  },
});

const defaultConfig: AppConfig = {
  theme: "light",
};

const defaultRelays = [
  { url: "wss://relay.nostr.band", name: "Nostr.Band" },
  { url: "wss://relay.primal.net", name: "Primal" },
  { url: "wss://relay.olas.app", name: "Olas" },
  { url: "wss://nos.lol", name: "nos.lol" },
  { url: "wss://relay.snort.social", name: "Snort" },
  { url: "wss://purplepag.es", name: "Purple Pages" },
  { url: "wss://relay.damus.io", name: "Damus" },
  { url: "wss://ditto.pub/relay", name: "Ditto" },
];

export function App() {
  return (
    <UnheadProvider head={head}>
      <AppProvider
        storageKey="nostr:app-config"
        defaultConfig={defaultConfig}
        defaultRelays={defaultRelays}
      >
        <QueryClientProvider client={queryClient}>
          <NostrLoginProvider storageKey="nostr:login">
            <NostrProvider>
              <OutboxEnhancer />
              <NotificationProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <Suspense>
                    <AppRouter />
                  </Suspense>
                </TooltipProvider>
              </NotificationProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </QueryClientProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default App;
