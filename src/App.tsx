import * as React from "react";
import { BrowserRouter } from "react-router-dom";
import { NwcProvider } from "./contexts/NwcContext";
import { NdkProvider } from "./contexts/NdkContext";
import { ThemeProvider } from "./contexts/theme";
import { Routes, Route } from "react-router-dom";
import { SettingsPage } from "./pages/page-settings";
import { GlobalFeed } from "./pages/page-feed/global-feed";
import { Container } from "./components/container";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <NdkProvider>
          <NwcProvider>
            <Container>
              <Routes>
                <Route path="/" element={<GlobalFeed />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Container>
          </NwcProvider>
        </NdkProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};
