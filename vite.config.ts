// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    // Add this section
    exclude: ["nostr-tools"], // Exclude nostr-tools from pre-bundling
  },
  plugins: [react()],
});
