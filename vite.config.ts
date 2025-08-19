import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    // Memory optimization settings
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Use single thread to reduce memory usage
        maxThreads: 1, // Limit to 1 thread
      },
    },
    isolate: false, // Don't isolate tests to reduce memory overhead
    maxWorkers: 1, // Limit workers to reduce memory usage
    minWorkers: 1,
    hookTimeout: 10000, // Increase timeout for slower operations
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));