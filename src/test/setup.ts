import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { cleanupQueryClient } from './TestApp';
import { resetNostrProviderState } from '@/components/NostrProvider';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation((_callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation((_callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // Clean up DOM - this is crucial for preventing multiple elements with same test id
  cleanup();
  
  // Clean up React Testing Library
  vi.clearAllMocks();

  // Clean up query client
  cleanupQueryClient();

  // Reset NostrProvider global state
  resetNostrProviderState();

  // Force garbage collection if available
  if (typeof global.gc === 'function') {
    global.gc();
  }
});