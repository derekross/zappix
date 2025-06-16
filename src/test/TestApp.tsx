import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { BrowserRouter } from 'react-router-dom';
import { NostrLoginProvider } from '@nostrify/react/login';
import NostrProvider from '@/components/NostrProvider';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';

interface TestAppProps {
  children: React.ReactNode;
}

export function TestApp({ children }: TestAppProps) {
  const head = createHead();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const defaultConfig: AppConfig = {
    theme: 'light',
  };

  const defaultRelays = [
    { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
    { url: 'wss://relay.primal.net', name: 'Primal' },
    { url: 'wss://relay.olas.app', name: 'Olas' },
    { url: 'wss://nos.lol', name: 'nos.lol' },
  ];

  return (
    <UnheadProvider head={head}>
      <AppProvider storageKey='test-app-config' defaultConfig={defaultConfig} defaultRelays={defaultRelays}>
        <QueryClientProvider client={queryClient}>
          <NostrLoginProvider storageKey='test-login'>
            <NostrProvider>
              <BrowserRouter>
                {children}
              </BrowserRouter>
            </NostrProvider>
          </NostrLoginProvider>
        </QueryClientProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default TestApp;