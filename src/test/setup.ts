import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { cleanupQueryClient } from './TestApp';

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

// Mock IntersectionObserver — report observed elements as intersecting,
// since jsdom has no layout and lazy-loaded content should render in tests
global.IntersectionObserver = vi.fn().mockImplementation((callback: IntersectionObserverCallback) => {
  const instance: IntersectionObserver = {
    observe: vi.fn((element: Element) => {
      callback(
        [{
          isIntersecting: true,
          intersectionRatio: 1,
          target: element,
          boundingClientRect: element.getBoundingClientRect(),
          intersectionRect: element.getBoundingClientRect(),
          rootBounds: null,
          time: 0,
        } as IntersectionObserverEntry],
        instance,
      );
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
    root: null,
    rootMargin: '',
    thresholds: [],
  };
  return instance;
});

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

  // Force garbage collection if available
  if (typeof global.gc === 'function') {
    global.gc();
  }
});