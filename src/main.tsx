import { createRoot } from "react-dom/client";

// Import polyfills first
import "./lib/polyfills.ts";

import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerSW";

// Register service worker for PWA support
registerServiceWorker();

// Using system fonts for optimal performance

createRoot(document.getElementById("root")!).render(<App />);
