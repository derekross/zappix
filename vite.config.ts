import { execSync } from "node:child_process";
import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from "vitest/config";

/**
 * Generate version string from git commit info.
 * Format: YYYY.MM.DD+<short-hash> (e.g., 2026.01.19+abc1234)
 */
function getVersion(): string {
  try {
    const gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
    const commitTimestamp = execSync('git log -1 --format=%ct').toString().trim();
    const commitDate = new Date(parseInt(commitTimestamp) * 1000);
    const utcDate = commitDate.toISOString().split('T')[0].replace(/-/g, '.');
    return `${utcDate}+${gitCommit}`;
  } catch {
    return new Date().toISOString().split('T')[0].replace(/-/g, '.');
  }
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    'import.meta.env.VERSION': JSON.stringify(getVersion()),
  },
  plugins: [
    react(),
    // PWA Configuration
    // - Service worker for offline functionality
    // - Update notifications via PWAUpdatePrompt component
    // - App installation prompt
    VitePWA({
      // 'prompt' - Shows update notification to user (user-controlled updates)
      // 'autoUpdate' - Updates silently without user interaction
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: false, // Use the manifest.webmanifest from public/ folder
      // Use injectManifest strategy to include custom service worker logic
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 2*5242880,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      }
    }),
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