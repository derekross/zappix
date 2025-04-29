import * as React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app";
import { NdkProvider } from "./contexts/NdkContext";
import { ThemeProvider } from "./contexts/theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <NdkProvider>
          <App />
        </NdkProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
