import { lazy } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Secondary routes are code-split; the Suspense boundary in App.tsx shows a
// spinner while a chunk loads.
const PostPage = lazy(() => import("./pages/PostPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy })));
const RemoteLoginSuccess = lazy(() => import("./pages/RemoteLoginSuccess").then((m) => ({ default: m.RemoteLoginSuccess })));
const CurrentUserProfilePage = lazy(() => import("./components/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const EditProfilePage = lazy(() => import("./components/EditProfilePage").then((m) => ({ default: m.EditProfilePage })));
const BookmarksPage = lazy(() => import("./components/BookmarksPage").then((m) => ({ default: m.BookmarksPage })));

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
