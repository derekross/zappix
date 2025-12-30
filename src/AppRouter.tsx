import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import PostPage from "./pages/PostPage";
import NotFound from "./pages/NotFound";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { RemoteLoginSuccess } from "./pages/RemoteLoginSuccess";
import { ProfilePage as CurrentUserProfilePage } from "./components/ProfilePage";
import { EditProfilePage } from "./components/EditProfilePage";
import { BookmarksPage } from "./components/BookmarksPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Index />} />
        <Route path="/videos" element={<Index />} />
        <Route path="/discover" element={<Index />} />
        <Route path="/location/:location" element={<Index />} />
        <Route path="/profile" element={<CurrentUserProfilePage />} />
        <Route path="/profile/edit" element={<EditProfilePage />} />
        <Route path="/bookmarks" element={<BookmarksPage />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/remoteloginsuccess" element={<RemoteLoginSuccess />} />
        <Route path="/:nip19" element={<PostPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
