import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { BrowserRouter } from 'react-router-dom';
import { NostrLoginProvider } from '@nostrify/react/login';
import NostrProvider from '@/components/NostrProvider';
import { AppProvider } from '@/components/AppProvider';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { AppConfig } from '@/contexts/AppContext';

interface TestAppProps {
  children: React.ReactNode;
}

// Create a single query client instance for all tests to avoid memory leaks
let queryClient: QueryClient | null = null;

function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0, // Clear cache immediately after test
        },
        mutations: {
          retry: false,
          gcTime: 0, // Clear cache immediately after test
        },
      },
    });
  }
  return queryClient;
}

// Function to clean up query client between tests
export function cleanupQueryClient() {
  if (queryClient) {
    queryClient.clear();
    queryClient = null;
  }
}

const defaultConfig: AppConfig = {
  theme: 'light',
  relayMetadata: {
    relays: [
      { url: 'wss://relay.ditto.pub', read: true, write: true },
      { url: 'wss://relay.primal.net', read: true, write: true },
    ],
    updatedAt: Date.now(),
  },
};

const defaultRelays = [
  { url: 'wss://relay.ditto.pub', name: 'Ditto' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
  { url: 'wss://relay.olas.app', name: 'Olas' },
  { url: 'wss://nos.lol', name: 'nos.lol' },
];

export function TestApp({ children }: TestAppProps) {
  const head = createHead();
  const client = getQueryClient();

  return (
    <UnheadProvider head={head}>
      <AppProvider storageKey='test-app-config' defaultConfig={defaultConfig} defaultRelays={defaultRelays}>
        <QueryClientProvider client={client}>
          <NostrLoginProvider storageKey='test-login'>
            <NostrProvider>
              <NotificationProvider>
                <BrowserRouter>
                  {children}
                </BrowserRouter>
              </NotificationProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </QueryClientProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default TestApp;