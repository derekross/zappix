// src/main.tsx
// FIX: Remove unused React import
// import React from 'react'
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css"; // Optional global styles
import { BrowserRouter } from "react-router-dom";
import { NdkProvider } from "./contexts/NdkContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // <React.StrictMode> // Temporarily commented out for diagnosing NDKProvider re-mounts
  <BrowserRouter>
    <NdkProvider>
      <App />
    </NdkProvider>
  </BrowserRouter>,
  // </React.StrictMode>,
);
