import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import PostPage from "./pages/PostPage";
import NotFound from "./pages/NotFound";
import { ProfilePage } from "./components/ProfilePage";
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
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<EditProfilePage />} />
        <Route path="/bookmarks" element={<BookmarksPage />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="/npub*" element={<PostPage />} />
        <Route path="/note*" element={<PostPage />} />
        <Route path="/nevent*" element={<PostPage />} />
        <Route path="/naddr*" element={<PostPage />} />
        <Route path="/nprofile*" element={<PostPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
